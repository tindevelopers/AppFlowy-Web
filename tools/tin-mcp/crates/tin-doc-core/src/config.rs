use std::env;
use std::fs;
use std::path::PathBuf;

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};

pub const DEFAULT_BASE_URL: &str = "https://projects.tinconnect.com";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConfigFile {
  pub api_key: Option<String>,
  pub base_url: Option<String>,
  pub default_workspace_id: Option<String>,
  pub timeout_secs: Option<u64>,
  pub backup: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct Config {
  pub api_key: Option<String>,
  pub base_url: String,
  pub default_workspace_id: Option<String>,
  pub timeout_secs: u64,
  pub backup: bool,
}

impl Config {
  pub fn load() -> Config {
    let file = Self::read_config_file().unwrap_or_default();

    let api_key = env::var("TIN_MCP_API_KEY")
      .ok()
      .filter(|s| !s.is_empty())
      .or_else(|| env::var("APPFLOWY_API_KEY").ok().filter(|s| !s.is_empty()))
      .or(file.api_key);

    let mut base_url = env::var("TIN_MCP_BASE_URL")
      .ok()
      .filter(|s| !s.is_empty())
      .or(file.base_url)
      .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
    base_url = base_url.trim_end_matches('/').to_string();

    // Refuse http:// unless the user explicitly opts in (local dev only).
    if base_url.starts_with("http://")
      && env::var("TIN_MCP_ALLOW_INSECURE").ok().as_deref() != Some("1")
    {
      base_url = DEFAULT_BASE_URL.to_string();
    }

    let default_workspace_id = env::var("TIN_MCP_WORKSPACE")
      .ok()
      .filter(|s| !s.is_empty())
      .or(file.default_workspace_id);

    let timeout_secs = env::var("TIN_MCP_TIMEOUT")
      .ok()
      .and_then(|s| s.parse().ok())
      .or(file.timeout_secs)
      .unwrap_or(30);

    let backup = env::var("TIN_MCP_BACKUP")
      .ok()
      .and_then(|s| s.parse().ok())
      .or(file.backup)
      .unwrap_or(true);

    Config {
      api_key,
      base_url,
      default_workspace_id,
      timeout_secs,
      backup,
    }
  }

  pub fn resolve_key(&self) -> Option<String> {
    self.api_key.clone()
  }

  /// Display-safe prefix (first 12 chars). The full key is never logged.
  pub fn key_prefix(&self) -> Option<String> {
    self.api_key.as_ref().map(|k| k.chars().take(12).collect())
  }

  pub fn config_path() -> PathBuf {
  directories::ProjectDirs::from("com", "tin", "tin-mcp")
      .map(|d| d.config_dir().join("config.toml"))
      .unwrap_or_else(|| PathBuf::from(".tin-mcp-config.toml"))
  }

  pub fn data_dir() -> PathBuf {
  directories::ProjectDirs::from("com", "tin", "tin-mcp")
      .map(|d| d.data_dir().to_path_buf())
      .unwrap_or_else(|| PathBuf::from(".tin-mcp-data"))
  }

  fn read_config_file() -> Option<ConfigFile> {
    let content = fs::read_to_string(Self::config_path()).ok()?;
    toml::from_str(&content).ok()
  }

  /// Writes `api_key` to the config file with 0600 permissions. Returns the path.
  pub fn save_api_key(key: &str) -> anyhow::Result<PathBuf> {
    if !key.starts_with("afk_") {
      return Err(anyhow!("key must start with afk_"));
    }
    let path = Self::config_path();
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent).context("create config dir")?;
    }
    let mut file = Self::read_config_file().unwrap_or_default();
    file.api_key = Some(key.to_string());
    let serialized = toml::to_string_pretty(&file).context("serialize config")?;
    fs::write(&path, serialized).context("write config")?;

    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
        .context("chmod 0600 config")?;
    }
    Ok(path)
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::env;

  // Serialize env-mutating tests; tests share a process.
  fn with_env<F: FnOnce()>(vars: &[(&str, Option<&str>)], f: F) {
    let saved: Vec<_> = vars.iter().map(|(k, _)| (*k, env::var(k).ok())).collect();
    for (k, v) in vars {
      match v {
        Some(v) => env::set_var(k, v),
        None => env::remove_var(k),
      }
    }
    f();
    for (k, old) in saved {
      match old {
        Some(v) => env::set_var(k, v),
        None => env::remove_var(k),
      }
    }
  }

  #[test]
  fn default_base_url_is_tinconnect() {
    with_env(
      &[("TIN_MCP_BASE_URL", None), ("TIN_MCP_API_KEY", None)],
      || {
        let cfg = Config::load();
        assert_eq!(cfg.base_url, "https://projects.tinconnect.com");
      },
    );
  }

  #[test]
  fn env_key_alias_works() {
    with_env(
      &[
        ("TIN_MCP_API_KEY", None),
        ("APPFLOWY_API_KEY", Some("afk_aliaskey")),
      ],
      || {
        let cfg = Config::load();
        assert_eq!(cfg.resolve_key().as_deref(), Some("afk_aliaskey"));
      },
    );
  }

  #[test]
  fn http_rejected_without_insecure_flag() {
    with_env(
      &[
        ("TIN_MCP_BASE_URL", Some("http://localhost:8000")),
        ("TIN_MCP_ALLOW_INSECURE", None),
      ],
      || {
        let cfg = Config::load();
        assert_eq!(cfg.base_url, "https://projects.tinconnect.com");
      },
    );
    with_env(
      &[
        ("TIN_MCP_BASE_URL", Some("http://localhost:8000")),
        ("TIN_MCP_ALLOW_INSECURE", Some("1")),
      ],
      || {
        let cfg = Config::load();
        assert_eq!(cfg.base_url, "http://localhost:8000");
      },
    );
  }

  #[test]
  fn key_prefix_is_first_12_chars() {
    with_env(
      &[
        ("TIN_MCP_API_KEY", Some("afk_abcdefghijklmnop")),
        ("APPFLOWY_API_KEY", None),
      ],
      || {
        let cfg = Config::load();
        assert_eq!(cfg.key_prefix().as_deref(), Some("afk_abcdefgh"));
      },
    );
  }
}
