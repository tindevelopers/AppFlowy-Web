mod auth;
mod doctor;
mod server;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "tin-mcp", about = "MCP server for projects.tinconnect.com")]
struct Cli {
  #[command(subcommand)]
  command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
  /// Start the MCP server (for IDE / agent integration)
  Serve,
  /// Configure authentication
  Auth {
    #[command(subcommand)]
    subcommand: AuthCommands,
  },
  /// Verify connectivity and authentication
  Doctor,
}

#[derive(Subcommand)]
enum AuthCommands {
  /// Set the afk_ API key
  SetKey {
    /// API key (starts with afk_). If omitted, prompts securely.
    key: Option<String>,
  },
  /// Show current configuration
  Status,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
  let cli = Cli::parse();

  match cli.command.unwrap_or(Commands::Serve) {
    Commands::Serve => {
      let cfg = tin_doc_core::config::Config::load();
      if cfg.resolve_key().is_none() {
        anyhow::bail!("no API key configured. Run: tin-mcp auth set-key");
      }
      let srv = server::TinMcpServer { config: cfg };
      let transport = rmcp::transport::io::stdio();
      rmcp::serve_server(srv, transport).await?;
    }
    Commands::Auth { subcommand } => match subcommand {
      AuthCommands::SetKey { key } => {
        let k = match key {
          Some(k) => k,
          None => rpassword::prompt_password("Enter afk_ API key: ")?,
        };
        auth::run_set_key(&k)?;
      }
      AuthCommands::Status => auth::run_status(),
    },
    Commands::Doctor => {
      doctor::run().await?;
    }
  }
  Ok(())
}
