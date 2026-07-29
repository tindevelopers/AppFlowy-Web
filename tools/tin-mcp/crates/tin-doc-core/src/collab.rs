use std::collections::HashMap;

use anyhow::{anyhow, Context};
use client_api::entity::{CreateCollabParams, QueryCollab, QueryCollabParams};
use client_api::{Client, ClientConfiguration};
use collab::core::collab::DataSource;
use collab::core::origin::CollabOrigin;
use collab_document::blocks::DocumentData;
use collab_document::document::Document;
use collab::preclude::Collab;
use collab_entity::CollabType;
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::backup;
use crate::merge;

pub struct PageRead {
  pub view_id: String,
  pub markdown: String,
  pub truncated: bool,
  /// SHA-256 hex of the fetched encode_collab.doc_state. Used as the
  /// optimistic-concurrency token for `update_page_section`.
  pub doc_state_hash: String,
}

/// Return value for write operations on sections.
#[derive(Debug, Clone, Serialize)]
pub struct SectionWriteResult {
  pub view_id: String,
  pub section_key: String,
  pub dry_run: bool,
  pub old_doc_state_hash: String,
  pub new_doc_state_hash: String,
  pub replaced: bool,
  pub message: String,
}

pub struct DocClient {
  client: Client,
}

impl DocClient {
  /// Token-seed pattern verified against projects.tinconnect.com by collab-sync.
  /// The afk_ key goes in as access_token; the server's afk_ branch authenticates
  /// it before any JWT validation, so the placeholder user object is never used.
  pub fn connect(base_url: &str, api_key: &str) -> anyhow::Result<DocClient> {
    let base = base_url.trim_end_matches('/').to_string();
    let gotrue_url = format!("{}/gotrue", base);
    let ws_base_url = format!("{}/ws/v1", base.replacen("https://", "wss://", 1));
    let device_id = Uuid::new_v4().to_string();

    let client = Client::new(
      &base,
      &ws_base_url,
      &gotrue_url,
      &device_id,
      ClientConfiguration::default(),
      "0.9.4",
    );

    let now_secs = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)?
      .as_secs();
    let token_json = serde_json::json!({
      "access_token": api_key,
      "token_type": "bearer",
      "expires_in": 3600,
      "expires_at": now_secs + 31_536_000,
      "refresh_token": "",
      "user": {
        "id": Uuid::new_v4().to_string(),
        "aud": "authenticated",
        "role": "authenticated",
        "email": "",
        "phone": "",
        "app_metadata": { "provider": "api_key", "providers": ["api_key"] },
        "user_metadata": {},
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
      }
    })
    .to_string();
    client.restore_token(&token_json).context("restore_token failed")?;
    Ok(DocClient { client })
  }

  pub async fn fetch_doc_state(
    &self,
    workspace_id: &str,
    object_id: &str,
  ) -> anyhow::Result<Vec<u8>> {
    let params = QueryCollabParams {
      workspace_id: Uuid::parse_str(workspace_id).context("bad workspace_id")?,
      inner: QueryCollab::new(
        Uuid::parse_str(object_id).context("bad object_id")?,
        CollabType::Document,
      ),
    };
    let encoded = self
      .client
      .get_collab(params)
      .await
      .context("get_collab failed")?
      .encode_collab;
    Ok(encoded.doc_state.to_vec())
  }

  pub async fn read_page_markdown(
    &self,
    workspace_id: &str,
    view_id: &str,
    max_chars: usize,
  ) -> anyhow::Result<PageRead> {
    let bytes = self.fetch_doc_state(workspace_id, view_id).await?;
    let hash = doc_state_hash(&bytes);
    let data = document_from_doc_state(view_id, bytes)?;
    let mut markdown = export_markdown(&data);
    let mut truncated = false;
    if markdown.len() > max_chars {
      markdown.truncate(max_chars);
      truncated = true;
    }
    Ok(PageRead {
      view_id: view_id.to_string(),
      markdown,
      truncated,
      doc_state_hash: hash,
    })
  }

  // ── Write path ─────────────────────────────────────────────────────────

  /// Encode `DocumentData` and upload it to the server.
  async fn upload_collab(
    &self,
    workspace_id: &str,
    object_id: &str,
    data: DocumentData,
  ) -> anyhow::Result<()> {
    let doc = Document::create(object_id, data).context("Document::create failed")?;
    let encoded = doc.encode_collab().context("encode_collab failed")?;
    let params = CreateCollabParams {
      workspace_id: Uuid::parse_str(workspace_id).context("bad workspace_id")?,
      object_id: Uuid::parse_str(object_id).context("bad object_id")?,
      encoded_collab_v1: encoded.encode_to_bytes().context("encode_to_bytes failed")?,
      collab_type: CollabType::Document,
    };
    self
      .client
      .create_collab(params)
      .await
      .context("create_collab failed")?;
    Ok(())
  }

  /// Seed a new page with initial markdown content.
  pub async fn seed_page(
    &self,
    workspace_id: &str,
    view_id: &str,
    markdown: &str,
  ) -> anyhow::Result<String> {
    let data = merge::import_markdown(markdown)?;
    self.upload_collab(workspace_id, view_id, data).await?;
    tracing::info!(view_id, "page seeded");
    Ok(view_id.to_string())
  }

  /// Replace a marked section in an existing page.
  ///
  /// 1. Fetches the current doc_state.
  /// 2. Optionally checks that the `if_unmodified` hash matches (optimistic concurrency).
  /// 3. Finds the BEGIN/END GENERATED markers for `section_key`.
  /// 4. If `dry_run`, returns the would-be diff without writing.
  /// 5. Backs up the old doc_state locally.
  /// 6. Merges the new content into the old and uploads.
  pub async fn replace_section(
    &self,
    workspace_id: &str,
    view_id: &str,
    section_key: &str,
    new_markdown: &str,
    dry_run: bool,
    if_unmodified: Option<&str>,
    backup_enabled: bool,
  ) -> anyhow::Result<SectionWriteResult> {
    // 1. Fetch current doc.
    let old_bytes = self.fetch_doc_state(workspace_id, view_id).await?;
    let old_hash = doc_state_hash(&old_bytes);
    let old_data = document_from_doc_state(view_id, old_bytes)?;

    // 2. Optimistic concurrency check.
    if let Some(expected) = if_unmodified {
      if expected != old_hash {
        return Ok(SectionWriteResult {
          view_id: view_id.to_string(),
          section_key: section_key.to_string(),
          dry_run,
          old_doc_state_hash: old_hash.clone(),
          new_doc_state_hash: String::new(),
          replaced: false,
          message: format!(
            "optimistic concurrency: page was modified (expected hash {}, got {})",
            expected, old_hash
          ),
        });
      }
    }

    // 3. Find markers.
    let sections = merge::find_sections(&old_data);
    let section = sections
      .iter()
      .find(|s| s.key == section_key)
      .with_context(|| {
        let available: Vec<&str> = sections.iter().map(|s| s.key.as_str()).collect();
        format!(
          "section '{}' not found on this page. Available sections: {:?}",
          section_key, available
        )
      })?;

    // 4. Build new data and merge.
    let new_data = merge::import_markdown(new_markdown)?;
    let merged = merge::merge_replacement(
      &old_data,
      &section.begin_block_id,
      &section.end_block_id,
      new_data,
    )?;

    if dry_run {
      return Ok(SectionWriteResult {
        view_id: view_id.to_string(),
        section_key: section_key.to_string(),
        dry_run: true,
        old_doc_state_hash: old_hash,
        new_doc_state_hash: String::new(),
        replaced: false,
        message: "dry run: section merge would have succeeded".into(),
      });
    }

    // 5. Backup before write.
    if backup_enabled {
      let encoded = old_data_to_bytes(view_id, &old_data)?;
      backup::save_backup(view_id, &old_hash, &encoded)?;
    }

    // 6. Encode and upload.
    self.upload_collab(workspace_id, view_id, merged).await?;

    // Compute new hash for response.
    let new_bytes = self.fetch_doc_state(workspace_id, view_id).await?;
    let new_hash = doc_state_hash(&new_bytes);

    Ok(SectionWriteResult {
      view_id: view_id.to_string(),
      section_key: section_key.to_string(),
      dry_run: false,
      old_doc_state_hash: old_hash,
      new_doc_state_hash: new_hash,
      replaced: true,
      message: "section replaced successfully".into(),
    })
  }

  /// Append a new marked section to the end of a page's content.
  /// The section markers are prepended/appended automatically.
  pub async fn insert_section(
    &self,
    workspace_id: &str,
    view_id: &str,
    section_key: &str,
    md_content: &str,
    backup_enabled: bool,
  ) -> anyhow::Result<SectionWriteResult> {
    // 1. Fetch current doc and export as markdown.
    let old_bytes = self.fetch_doc_state(workspace_id, view_id).await?;
    let old_hash = doc_state_hash(&old_bytes);

    let page = self
      .read_page_markdown(workspace_id, view_id, usize::MAX)
      .await?;

    // 2. Append the new section to the exported markdown and re-import.
    let appended = format!(
      "{}\n<!-- BEGIN GENERATED:{} -->\n{}\n<!-- END GENERATED:{} -->\n",
      page.markdown, section_key, md_content, section_key
    );
    let new_data = merge::import_markdown(&appended)?;

    // 3. Backup.
    if backup_enabled {
      let old_bytes_clone = self.fetch_doc_state(workspace_id, view_id).await?;
      backup::save_backup(view_id, &old_hash, &old_bytes_clone)?;
    }

    // 4. Upload.
    self.upload_collab(workspace_id, view_id, new_data).await?;

    let new_bytes = self.fetch_doc_state(workspace_id, view_id).await?;
    let new_hash = doc_state_hash(&new_bytes);

    Ok(SectionWriteResult {
      view_id: view_id.to_string(),
      section_key: section_key.to_string(),
      dry_run: false,
      old_doc_state_hash: old_hash,
      new_doc_state_hash: new_hash,
      replaced: true,
      message: "section inserted successfully".into(),
    })
  }

  /// Restore a page from a previously saved backup.
  pub async fn restore_backup(
    &self,
    workspace_id: &str,
    view_id: &str,
    backup_ident: &str,
  ) -> anyhow::Result<()> {
    let bytes = backup::read_backup(view_id, backup_ident)?;
    let data = document_from_doc_state(view_id, bytes)?;
    self.upload_collab(workspace_id, view_id, data).await?;
    Ok(())
  }
}

pub fn doc_state_hash(bytes: &[u8]) -> String {
  hex_encode(&Sha256::digest(bytes))
}

fn hex_encode(bytes: &[u8]) -> String {
  bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Verified decode path from collab-sync (DocStateV1 → Document::open).
pub fn document_from_doc_state(object_id: &str, bytes: Vec<u8>) -> anyhow::Result<DocumentData> {
  let collab = Collab::new_with_source(
    CollabOrigin::Empty,
    object_id,
    DataSource::DocStateV1(bytes),
    vec![],
    false,
  )
  .map_err(|e| anyhow!("rebuild collab from doc_state failed: {:?}", e))?;
  let document = Document::open(collab).context("Document::open failed")?;
  document.get_document_data().context("get_document_data failed")
}

/// Minimal markdown export: walks the block tree top-down, rendering block
/// text content. Marker comments (paragraph blocks whose text matches
/// BEGIN/END GENERATED) pass through verbatim so Phase 2's section tools can
/// find them. Read fidelity is not byte-perfect; write fidelity (Phase 2)
/// goes through MDImporter.
pub fn export_markdown(data: &DocumentData) -> String {
  let mut out = String::new();
  walk_blocks(&data.page_id, data, data.meta.text_map.as_ref(), &mut out);
  out
}

fn walk_blocks(
  id: &str,
  data: &DocumentData,
  text_map: Option<&HashMap<String, String>>,
  out: &mut String,
) {
  if let Some(children) = data.meta.children_map.get(id) {
    for child_id in children {
      if let Some(block) = data.blocks.get(child_id) {
        let text = block
          .external_id
          .as_ref()
          .and_then(|ext| text_map.and_then(|tm| tm.get(ext)))
          .cloned()
          .unwrap_or_default();
        let line = match block.ty.as_str() {
          "heading" => format!("## {}\n\n", text),
          "paragraph" => format!("{}\n\n", text),
          "quote" => format!("> {}\n\n", text),
          "code" => format!("```\n{}\n```\n\n", text),
          _ => {
            if text.is_empty() {
              String::new()
            } else {
              format!("{}\n\n", text)
            }
          },
        };
        out.push_str(&line);
      }
      walk_blocks(child_id, data, text_map, out);
    }
  }
}

/// Encode DocumentData → doc_state bytes (for backup snapshots).
fn old_data_to_bytes(object_id: &str, data: &DocumentData) -> anyhow::Result<Vec<u8>> {
  let doc = Document::create(object_id, data.clone()).context("Document::create for backup")?;
  let encoded = doc.encode_collab().context("encode_collab for backup")?;
  Ok(encoded.encode_to_bytes().context("encode_to_bytes for backup")?.to_vec())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn doc_state_hash_is_stable_hex() {
    let h = doc_state_hash(b"hello");
    assert_eq!(h.len(), 64);
    assert_eq!(h, doc_state_hash(b"hello"));
    assert_ne!(h, doc_state_hash(b"world"));
  }
}
