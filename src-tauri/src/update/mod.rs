// src-tauri/src/update/mod.rs
//
// High-level update module for FilesUP / EmptyBox.
// Uses The Update Framework (TUF) via the `tough` crate to securely
// discover and download signed update bundles.

mod tuf_config;
mod tuf_client;
mod version_fs;
mod update_manager;

pub use tuf_config::TufConfig;
pub use update_manager::{
    check_for_updates,
    download_update_bundle,
    apply_staged_update,
    UpdateCheckResult,
    DownloadResult,
    ApplyResult,
};
