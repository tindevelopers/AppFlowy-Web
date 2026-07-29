use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::Serialize;
use crate::config::Config;

#[derive(Debug, Clone, Serialize)]
pub struct BackupEntry {
  pub view_id: String,
  pub timestamp: String,
  pub doc_state_hash: String,
  pub byte_count: u64,
}

/// Save doc_state bytes as a timestamped backup. Returns the backup path.
pub fn save_backup(view_id: &str, doc_state_hash: &str, bytes: &[u8]) -> Result<PathBuf> {
  let dir = Config::data_dir().join("backups").join(view_id);
  fs::create_dir_all(&dir).context("create backup dir")?;

  let ts = chrono_now();
  let filename = format!("{}-{}.doc_state", ts, &doc_state_hash[..8.min(doc_state_hash.len())]);
  let path = dir.join(filename);
  fs::write(&path, bytes).context("write backup")?;
  Ok(path)
}

/// List all backups for a given view_id, sorted by timestamp descending.
pub fn list_backups(view_id: &str) -> Result<Vec<BackupEntry>> {
  let dir = Config::data_dir().join("backups").join(view_id);
  if !dir.exists() {
    return Ok(vec![]);
  }
  let mut entries = Vec::new();
  for entry in fs::read_dir(&dir).context("read backup dir")? {
    let entry = entry.context("read dir entry")?;
    let path = entry.path();
    if path.extension().and_then(|e| e.to_str()) != Some("doc_state") {
      continue;
    }
    let meta = fs::metadata(&path).context("metadata")?;
    let fname = path
      .file_stem()
      .and_then(|s| s.to_str())
      .unwrap_or("unknown");
    let parts: Vec<&str> = fname.splitn(2, '-').collect();
    let timestamp = parts.first().unwrap_or(&"unknown").to_string();
    let doc_state_hash = parts.get(1).unwrap_or(&"").to_string();
    entries.push(BackupEntry {
      view_id: view_id.to_string(),
      timestamp,
      doc_state_hash,
      byte_count: meta.len(),
    });
  }
  entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
  Ok(entries)
}

/// Read a specific backup file. `ident` can be the full filename stem
/// (e.g., `20260728T120000-a1b2c3d4`) or just the timestamp prefix.
pub fn read_backup(view_id: &str, ident: &str) -> Result<Vec<u8>> {
  let dir = Config::data_dir().join("backups").join(view_id);
  // Try exact match first, then prefix match.
  for entry in fs::read_dir(&dir).context("read backup dir")? {
    let entry = entry.context("read dir entry")?;
    let path = entry.path();
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    if stem == ident || stem.starts_with(ident) {
      return fs::read(&path).context("read backup file");
    }
  }
  anyhow::bail!("backup not found: {} in {}", ident, dir.display());
}

fn chrono_now() -> String {
  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default();
  let secs = now.as_secs();
  // YYYYMMDDThhmmss
  let days_since_epoch = secs / 86400;
  let time_of_day = secs % 86400;
  let hours = time_of_day / 3600;
  let minutes = (time_of_day % 3600) / 60;
  let seconds = time_of_day % 60;

  // Calculate year/month/day from days since epoch (standard civil date).
  let (y, m, d) = civil_from_days(days_since_epoch as i64);
  format!("{:04}{:02}{:02}T{:02}{:02}{:02}", y, m, d, hours, minutes, seconds)
}

/// Convert days since 0000-03-01 to (year, month, day). From Howard Hinnant's algorithms.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
  let z = z + 719_468;
  let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
  let doe = (z - era * 146_097) as u32;
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
  let y = yoe as i64 + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let d = doy - (153 * mp + 2) / 5 + 1;
  let m = if mp < 10 { mp + 3 } else { mp - 9 };
  let y = if m <= 2 { y + 1 } else { y };
  (y, m, d)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn chrono_now_is_reasonable() {
    let ts = chrono_now();
    assert_eq!(ts.len(), 15); // YYYYMMDDThhmmss
    assert!(ts.starts_with("202"));
  }

  #[test]
  fn empty_list_when_no_backups() {
    let entries = list_backups("nonexistent-view-id-12345").unwrap();
    assert!(entries.is_empty());
  }
}
