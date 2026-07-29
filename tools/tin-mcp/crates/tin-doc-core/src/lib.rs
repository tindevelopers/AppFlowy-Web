//! tin-doc-core — shared document read/REST access for tin-mcp
//!
//! Extracted from `tools/doc-sync/collab-sync/src/main.rs`. Provides:
//! - config: env/file precedence with 0600 key storage
//! - rest: structural REST endpoints (workspace, page-view, space, profile)
//! - collab: document read path via the pinned client-api + collab_document
//! - error: structured auth/http/transport errors

pub mod backup;
pub mod collab;
pub mod config;
pub mod error;
pub mod merge;
pub mod rest;
