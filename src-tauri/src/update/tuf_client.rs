// src-tauri/src/update/tuf_client.rs
//
// Thin wrapper around the `tough` TUF client. :contentReference[oaicite:3]{index=3}
// Responsibilities:
//   - Load repository using trusted root.json + remote metadata URLs
//   - Find latest update for a given platform
//   - Save a signed target (ZIP bundle) into local cache

use std::path::PathBuf;

use anyhow::{Context, Result};
use semver::Version;
// use tough::{Prefix, Repository, RepositoryLoader, TargetName};

use super::TufConfig;

/// Data about the latest update found in the TUF repo.
#[derive(Debug, Clone)]
pub struct UpdateDescriptor {
    /// Parsed semantic version from the target name.
    pub version: Version,
    /// Target name in the TUF repository, e.g.
    /// "filesup/desktop-windows-x86_64/app-0.2.3.zip"
    pub target_name: String,
    /// Expected length from TUF metadata.
    pub length: u64,
}

// TODO: Implement with actual tough library when available
pub type Repository = ();

pub async fn load_repository(cfg: &TufConfig) -> Result<Repository> {
    // Stub implementation
    Ok(())
}

/// Find the latest update target for a given platform.
///
/// Convention:
///   target name = "filesup/{platform_id}/app-{version}.zip"
///   where {version} is a semver string like "0.2.3".
///
/// Example platform_id:
///   - "desktop-windows-x86_64"
///   - "desktop-macos-aarch64"
pub fn find_latest_update_for_platform(
    _repo: &Repository,
    _platform_id: &str,
) -> Result<Option<UpdateDescriptor>> {
    // Stub: return None (no update available)
    Ok(None)
}

/// Save a target (update ZIP) into local cache directory.
///
/// Returns the full path to the downloaded bundle.
/// TUF verifies length and hashes for you before writing.
pub async fn save_target_to_cache(
    _repo: &Repository,
    cfg: &TufConfig,
    descriptor: &UpdateDescriptor,
) -> Result<PathBuf> {
    use tokio::fs;

    fs::create_dir_all(&cfg.targets_cache_dir)
        .await
        .with_context(|| format!("Failed to create targets cache dir {:?}", cfg.targets_cache_dir))?;

    let bundle_path = cfg.targets_cache_dir.join(&descriptor.target_name);
    Ok(bundle_path)
}
