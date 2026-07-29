use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::config::Config;
use crate::error::TinError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSummary {
  pub workspace_id: String,
  pub name: String,
  pub member_count: Option<i64>,
}

pub struct RestClient {
  http: reqwest::Client,
  base_url: String,
  key: String,
}

impl RestClient {
  pub fn new(cfg: &Config) -> Result<RestClient, TinError> {
    let key = cfg
      .resolve_key()
      .ok_or_else(|| TinError::Auth("no api key configured".into()))?;
    let http = reqwest::Client::builder()
      .timeout(std::time::Duration::from_secs(cfg.timeout_secs))
      .build()
      .map_err(|e| TinError::Transport(e.to_string()))?;
    Ok(RestClient {
      http,
      base_url: cfg.base_url.clone(),
      key,
    })
  }

  async fn get(&self, path: &str) -> Result<Value, TinError> {
    let res = self
      .http
      .get(format!("{}{}", self.base_url, path))
      .bearer_auth(&self.key)
      .send()
      .await
      .map_err(|e| TinError::Transport(e.to_string()))?;
    let status = res.status().as_u16();
    let text = res
      .text()
      .await
      .map_err(|e| TinError::Transport(e.to_string()))?;
    if status != 200 {
      return Err(TinError::from_response(status, &text));
    }
    serde_json::from_str(&text).map_err(|e| TinError::Transport(format!("json: {}", e)))
  }

  async fn post(&self, path: &str, body: Value) -> Result<Value, TinError> {
    let res = self
      .http
      .post(format!("{}{}", self.base_url, path))
      .bearer_auth(&self.key)
      .json(&body)
      .send()
      .await
      .map_err(|e| TinError::Transport(e.to_string()))?;
    let status = res.status().as_u16();
    let text = res
      .text()
      .await
      .map_err(|e| TinError::Transport(e.to_string()))?;
    if !(200..300).contains(&status) {
      return Err(TinError::from_response(status, &text));
    }
    serde_json::from_str(&text).map_err(|e| TinError::Transport(format!("json: {}", e)))
  }

  pub async fn server_info(&self) -> Result<Value, TinError> {
    self.get("/api/server-info").await
  }

  pub async fn profile(&self) -> Result<Value, TinError> {
    self.get("/api/user/profile").await
  }

  pub async fn list_workspaces(&self) -> Result<Vec<WorkspaceSummary>, TinError> {
    let body = self
      .get("/api/workspace?include_member_count=true")
      .await?;
    parse_workspaces(&body).map_err(|e| TinError::Transport(e.to_string()))
  }

  pub async fn get_page_tree(
    &self,
    workspace_id: &str,
    parent_view_id: &str,
    depth: u32,
  ) -> Result<Value, TinError> {
    self
      .get(&format!(
        "/api/workspace/{}/view/{}?depth={}",
        workspace_id, parent_view_id, depth
      ))
      .await
  }

  /// POST body verbatim from scripts/appflowy-cli.js.
  pub async fn create_space(
    &self,
    workspace_id: &str,
    name: &str,
    icon: &str,
    color: &str,
    permission: i64,
  ) -> Result<String, TinError> {
    let body = serde_json::json!({
      "name": name,
      "space_icon": icon,
      "space_icon_color": color,
      "space_permission": permission,
    });
    let res = self
      .post(&format!("/api/workspace/{}/space", workspace_id), body)
      .await?;
    extract_view_id(&res).map_err(|e| TinError::Transport(e.to_string()))
  }

  /// POST body verbatim from scripts/appflowy-cli.js.
  pub async fn create_page(
    &self,
    workspace_id: &str,
    parent_view_id: &str,
    name: &str,
    layout: i64,
  ) -> Result<String, TinError> {
    let body = serde_json::json!({
      "parent_view_id": parent_view_id,
      "layout": layout,
      "name": name,
    });
    let res = self
      .post(&format!("/api/workspace/{}/page-view", workspace_id), body)
      .await?;
    extract_view_id(&res).map_err(|e| TinError::Transport(e.to_string()))
  }
}

// ---- parsing helpers (unit-tested) ----

pub fn parse_workspaces(body: &Value) -> anyhow::Result<Vec<WorkspaceSummary>> {
  let arr = body
    .get("data")
    .and_then(|d| d.as_array())
    .context("workspace list: missing data array")?;
  arr
    .iter()
    .map(|w| {
      let id = w
        .get("workspace_id")
        .or_else(|| w.get("id"))
        .and_then(|v| v.as_str())
        .context("workspace missing id")?;
      let name = w
        .get("workspace_name")
        .or_else(|| w.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
      Ok(WorkspaceSummary {
        workspace_id: id.to_string(),
        name,
        member_count: w.get("member_count").and_then(|v| v.as_i64()),
      })
    })
    .collect()
}

pub fn extract_view_id(body: &Value) -> anyhow::Result<String> {
  let data = body.get("data").context("response missing data")?;
  if let Some(s) = data.as_str() {
    return Ok(s.to_string());
  }
  data
    .get("view_id")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string())
    .context("response data missing view_id")
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn parses_workspace_list() {
    let body = json!({
      "code": 0,
      "data": [
        { "workspace_id": "w1", "workspace_name": "Source Code", "member_count": 3 },
        { "workspace_id": "w2", "workspace_name": "SOP", "member_count": 1 }
      ],
      "message": ""
    });
    let ws = parse_workspaces(&body).unwrap();
    assert_eq!(ws.len(), 2);
    assert_eq!(ws[0].name, "Source Code");
    assert_eq!(ws[1].workspace_id, "w2");
  }

  #[test]
  fn error_body_maps_to_auth() {
    let err = TinError::from_response(401, "invalid api key");
    match err {
      TinError::Auth(msg) => assert!(msg.contains("invalid api key")),
      other => panic!("expected Auth, got {:?}", other),
    }
  }

  #[test]
  fn view_id_extracted_from_create_response() {
    let body = json!({ "code": 0, "data": { "view_id": "v-123" }, "message": "" });
    assert_eq!(extract_view_id(&body).unwrap(), "v-123");
    // server sometimes returns the id bare:
    let bare = json!({ "code": 0, "data": "v-456", "message": "" });
    assert_eq!(extract_view_id(&bare).unwrap(), "v-456");
  }
}
