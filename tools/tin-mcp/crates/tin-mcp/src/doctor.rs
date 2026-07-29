use tin_doc_core::config::Config;
use tin_doc_core::rest::RestClient;

pub async fn run() -> anyhow::Result<()> {
  let cfg = Config::load();
  println!("Doctor check against: {}", cfg.base_url);

  // 1. API key presence
  match cfg.key_prefix() {
    Some(prefix) => println!("[OK] API key configured ({}...)", prefix),
    None => {
      println!("[FAIL] No API key. Run: tin-mcp auth set-key");
      return Err(anyhow::anyhow!("no api key"));
    }
  }

  // 2. REST connectivity
  let rest = match RestClient::new(&cfg) {
    Ok(c) => {
      println!("[OK] REST client initialized");
      c
    }
    Err(e) => {
      println!("[FAIL] REST client init: {}", e);
      return Err(anyhow::anyhow!("rest init: {}", e));
    }
  };

  // 3. Server info + profile
  let info = rest.server_info().await?;
  println!("[OK] Server info: {:?}", info);

  let profile = rest.profile().await?;
  println!("[OK] Profile: {:?}", profile);

  // 4. Workspace list
  let workspaces = rest.list_workspaces().await?;
  println!("[OK] {} workspace(s) accessible", workspaces.len());
  for ws in &workspaces {
    println!("  - {} ({})", ws.name, ws.workspace_id);
  }

  println!("\nDoctor check: all clear.");
  Ok(())
}
