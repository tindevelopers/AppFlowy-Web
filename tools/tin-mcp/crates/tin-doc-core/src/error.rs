use thiserror::Error;

#[derive(Debug, Error)]
pub enum TinError {
  #[error("auth: {0}")]
  Auth(String),

  #[error("http {0}: {1}")]
  Http(u16, String),

  #[error("transport: {0}")]
  Transport(String),
}

impl TinError {
  pub fn from_response(status: u16, body: &str) -> TinError {
    if status == 401 {
      return TinError::Auth(body.to_string());
    }
    TinError::Http(status, body.to_string())
  }
}
