use anyhow::Context;
use tin_doc_core::config::Config;

pub fn run_set_key(key: &str) -> anyhow::Result<()> {
  let path = Config::save_api_key(key).context("saving api key")?;
  eprintln!("API key saved to {}", path.display());
  eprintln!("Permissions: 0600 (owner read/write only)");
  Ok(())
}

pub fn run_status() {
  let cfg = Config::load();
  println!("Base URL:     {}", cfg.base_url);
  match cfg.key_prefix() {
    Some(prefix) => println!("API key:      {}...", prefix),
    None => println!("API key:      (not configured)"),
  }
  println!("Timeout:      {}s", cfg.timeout_secs);
  println!("Backup:       {}", cfg.backup);
  println!("Config file:  {}", Config::config_path().display());
}
