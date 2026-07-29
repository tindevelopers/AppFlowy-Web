use rmcp::handler::server::wrapper::Parameters;
use rmcp::handler::server::ServerHandler;
use rmcp::model::{CallToolResult, ContentBlock};
use rmcp::ErrorData;
use schemars::JsonSchema;
use serde::Deserialize;
use tin_doc_core::config::Config;
use tin_doc_core::{backup, collab, rest};

pub struct TinMcpServer {
  pub config: Config,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct NoParams {}

fn json_result(val: &impl serde::Serialize) -> CallToolResult {
  let text = serde_json::to_string_pretty(val).unwrap_or_else(|e| format!("{{error: {}}}", e));
  CallToolResult::success(vec![ContentBlock::text(text)])
}

fn internal_err(msg: impl std::fmt::Display) -> ErrorData {
  ErrorData::internal_error(msg.to_string(), None)
}

#[rmcp::tool_router]
impl TinMcpServer {
  // ── Read tools ──────────────────────────────────────────────────────────

  #[rmcp::tool(description = "Get server information and identity from the connected AppFlowy-Cloud instance")]
  async fn appflowy_server_info(
    &self,
    Parameters(_p): Parameters<NoParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let client = rest::RestClient::new(&self.config).map_err(internal_err)?;
    let info = client.server_info().await.map_err(internal_err)?;
    Ok(json_result(&info))
  }

  #[rmcp::tool(description = "List all workspaces accessible with the configured API key")]
  async fn appflowy_list_workspaces(
    &self,
    Parameters(_p): Parameters<NoParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let client = rest::RestClient::new(&self.config).map_err(internal_err)?;
    let workspaces = client.list_workspaces().await.map_err(internal_err)?;
    Ok(json_result(&workspaces))
  }

  #[rmcp::tool(description = "Get the page tree for a workspace folder. Use the workspace ID as the parent_view_id for the root.")]
  async fn appflowy_get_page_tree(
    &self,
    Parameters(p): Parameters<PageTreeParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let client = rest::RestClient::new(&self.config).map_err(internal_err)?;
    let tree = client
      .get_page_tree(&p.workspace_id, &p.parent_view_id, p.depth.unwrap_or(4))
      .await
      .map_err(internal_err)?;
    Ok(json_result(&tree))
  }

  #[rmcp::tool(description = "Read a page's content as markdown. Returns the full page text and a doc_state_hash for optimistic concurrency.")]
  async fn appflowy_read_page(
    &self,
    Parameters(p): Parameters<ReadPageParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let dc = connect_doc(&self.config)?;
    let page = dc
      .read_page_markdown(&p.workspace_id, &p.view_id, p.max_chars.unwrap_or(100_000))
      .await
      .map_err(internal_err)?;
    let output = serde_json::json!({
      "view_id": page.view_id,
      "markdown": page.markdown,
      "truncated": page.truncated,
      "doc_state_hash": page.doc_state_hash,
    });
    Ok(json_result(&output))
  }

  // ── Write tools ─────────────────────────────────────────────────────────

  #[rmcp::tool(description = "Create a new space in a workspace")]
  async fn appflowy_create_space(
    &self,
    Parameters(p): Parameters<CreateSpaceParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let client = rest::RestClient::new(&self.config).map_err(internal_err)?;
    let view_id = client
      .create_space(&p.workspace_id, &p.name, &p.icon.unwrap_or_default(), &p.color.unwrap_or_default(), p.permission.unwrap_or(0))
      .await
      .map_err(internal_err)?;
    Ok(json_result(&serde_json::json!({"view_id": view_id})))
  }

  #[rmcp::tool(description = "Create a new page in a workspace, optionally with initial markdown content")]
  async fn appflowy_create_page(
    &self,
    Parameters(p): Parameters<CreatePageParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let view_id = {
      let client = rest::RestClient::new(&self.config).map_err(internal_err)?;
      client
        .create_page(&p.workspace_id, &p.parent_view_id, &p.name, p.layout.unwrap_or(0))
        .await
        .map_err(internal_err)?
    };
    if let Some(ref md) = p.markdown {
      let dc = connect_doc(&self.config)?;
      dc.seed_page(&p.workspace_id, &view_id, md).await.map_err(internal_err)?;
    }
    Ok(json_result(&serde_json::json!({"view_id": view_id})))
  }

  #[rmcp::tool(description = "Replace a marked section within a page. Supports dry-run and optimistic concurrency (if_unmodified hash).\n\nSections are defined by <!-- BEGIN GENERATED:key --> / <!-- END GENERATED:key --> markers in the page content.")]
  async fn appflowy_update_page_section(
    &self,
    Parameters(p): Parameters<UpdateSectionParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let dc = connect_doc(&self.config)?;
    let result = dc
      .replace_section(
        &p.workspace_id,
        &p.view_id,
        &p.section_key,
        &p.markdown,
        p.dry_run.unwrap_or(false),
        p.if_unmodified.as_deref(),
        self.config.backup,
      )
      .await
      .map_err(internal_err)?;
    Ok(json_result(&result))
  }

  #[rmcp::tool(description = "Append a new marked section to a page. The BEGIN/END GENERATED markers are added automatically.")]
  async fn appflowy_insert_section(
    &self,
    Parameters(p): Parameters<InsertSectionParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let dc = connect_doc(&self.config)?;
    let result = dc
      .insert_section(&p.workspace_id, &p.view_id, &p.section_key, &p.markdown, self.config.backup)
      .await
      .map_err(internal_err)?;
    Ok(json_result(&result))
  }

  #[rmcp::tool(description = "List local pre-write backups for a page")]
  async fn appflowy_list_backups(
    &self,
    Parameters(p): Parameters<ListBackupsParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let entries = backup::list_backups(&p.view_id).map_err(internal_err)?;
    Ok(json_result(&entries))
  }

  #[rmcp::tool(description = "Restore a page from a local pre-write backup. Provide the backup timestamp or full filename stem.")]
  async fn appflowy_restore_page(
    &self,
    Parameters(p): Parameters<RestorePageParams>,
  ) -> Result<CallToolResult, ErrorData> {
    let dc = connect_doc(&self.config)?;
    dc.restore_backup(&p.workspace_id, &p.view_id, &p.backup_ident)
      .await
      .map_err(internal_err)?;
    Ok(json_result(&serde_json::json!({"restored": true, "view_id": p.view_id})))
  }
}

fn connect_doc(cfg: &Config) -> Result<collab::DocClient, ErrorData> {
  let key = cfg.resolve_key().ok_or_else(|| internal_err("no api key configured"))?;
  collab::DocClient::connect(&cfg.base_url, &key).map_err(internal_err)
}

#[rmcp::tool_handler]
impl ServerHandler for TinMcpServer {
  fn get_info(&self) -> rmcp::model::ServerInfo {
    let mut capabilities = rmcp::model::ServerCapabilities::default();
    let mut tools = rmcp::model::ToolsCapability::default();
    tools.list_changed = Some(false);
    capabilities.tools = Some(tools);
    rmcp::model::InitializeResult::new(capabilities)
      .with_server_info(rmcp::model::Implementation::new(
        "tin-mcp",
        env!("CARGO_PKG_VERSION"),
      ))
      .with_instructions(
        "Connect to projects.tinconnect.com. Set TIN_MCP_API_KEY to your afk_ key.",
      )
  }
}

// ── Parameter structs ─────────────────────────────────────────────────────

#[derive(Deserialize, JsonSchema, Default)]
pub struct PageTreeParams {
  pub workspace_id: String,
  pub parent_view_id: String,
  pub depth: Option<u32>,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct ReadPageParams {
  pub workspace_id: String,
  pub view_id: String,
  pub max_chars: Option<usize>,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct CreateSpaceParams {
  pub workspace_id: String,
  pub name: String,
  pub icon: Option<String>,
  pub color: Option<String>,
  pub permission: Option<i64>,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct CreatePageParams {
  pub workspace_id: String,
  pub parent_view_id: String,
  pub name: String,
  pub layout: Option<i64>,
  pub markdown: Option<String>,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct UpdateSectionParams {
  pub workspace_id: String,
  pub view_id: String,
  pub section_key: String,
  pub markdown: String,
  pub dry_run: Option<bool>,
  pub if_unmodified: Option<String>,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct InsertSectionParams {
  pub workspace_id: String,
  pub view_id: String,
  pub section_key: String,
  pub markdown: String,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct ListBackupsParams {
  pub view_id: String,
}

#[derive(Deserialize, JsonSchema, Default)]
pub struct RestorePageParams {
  pub workspace_id: String,
  pub view_id: String,
  pub backup_ident: String,
}
