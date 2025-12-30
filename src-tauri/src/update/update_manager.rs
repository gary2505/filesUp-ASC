// src-tauri/src/update/update_manager.rs
//
// High-level operations:
//   - check_for_updates: ask TUF repo if newer version exists
//   - download_update_bundle: download & verify signed ZIP
//   - apply_staged_update: extract ZIP into versions/<version>/ and update state
//
// All TUF correctness (signatures, hashes, rollback protection, expiration)
// is handled by the `tough` library. :contentReference[oaicite:5]{index=5}
//
// This module is intentionally "dumb": it only glues TUF + ZIP + FS layout.

use std::fs::File;

use anyhow::{anyhow, Context, Result};
use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use zip::read::ZipArchive;

use super::tuf_client::{find_latest_update_for_platform, load_repository, save_target_to_cache};
use super::version_fs::{load_version_state, save_version_state, version_dir};
use super::TufConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub version: String,
    pub bundle_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyResult {
    pub from_version: String,
    pub to_version: String,
}

/// Determine whether a newer version exists in TUF repository.
pub async fn check_for_updates(
    app: &AppHandle,
    current_version: String,
    platform_id: String,
) -> Result<UpdateCheckResult> {
    let cfg = TufConfig::default_tuf_config(app)?; // we'll add impl below
    let repo = load_repository(&cfg).await?;

    let current = Version::parse(&current_version)
        .context("Failed to parse current version as semver")?;

    let maybe_latest = find_latest_update_for_platform(&repo, &platform_id)?;

    let (latest_version, update_available) = if let Some(desc) = maybe_latest {
        let newer = desc.version > current;
        (Some(desc.version.to_string()), newer)
    } else {
        (None, false)
    };

    Ok(UpdateCheckResult {
        current_version,
        latest_version,
        update_available,
    })
}

/// Download and verify the update bundle for the given platform.
/// Returns path to the signed ZIP file.
pub async fn download_update_bundle(
    app: &AppHandle,
    platform_id: String,
) -> Result<DownloadResult> {
    let cfg = TufConfig::default_tuf_config(app)?;
    let repo = load_repository(&cfg).await?;

    let desc = find_latest_update_for_platform(&repo, &platform_id)?
        .ok_or_else(|| anyhow!("No update available for platform {}", platform_id))?;

    let bundle_path = save_target_to_cache(&repo, &cfg, &desc).await?;

    Ok(DownloadResult {
        version: desc.version.to_string(),
        bundle_path: bundle_path.to_string_lossy().to_string(),
    })
}

/// Apply a previously downloaded bundle:
///   - Extract ZIP into versions/<version>/
///   - Update version_state.json (current/previous)
///   - Does NOT restart the app; the launcher or user
///     decides when to switch.
///
/// This function is intentionally synchronous (blocking IO) because
/// it's expected to run rarely and we want simple error semantics.
/// You can wrap it in a separate thread if needed.
pub fn apply_staged_update(
    app: &AppHandle,
    bundle_path: String,
    new_version: String,
) -> Result<ApplyResult> {
    let new_ver = Version::parse(&new_version)
        .context("Failed to parse new version as semver")?;
    let target_dir = version_dir(app, &new_ver)?;

    // 1) Extract bundle into a temp folder first (best-effort atomicity).
    let temp_dir = target_dir
        .with_file_name(format!(".{}_tmp", new_ver.to_string()));
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)
            .with_context(|| format!("Failed to clean old temp dir {:?}", temp_dir))?;
    }
    std::fs::create_dir_all(&temp_dir)
        .with_context(|| format!("Failed to create temp dir {:?}", temp_dir))?;

    // 2) Extract ZIP.
    let file = File::open(&bundle_path)
        .with_context(|| format!("Failed to open bundle at {}", bundle_path))?;
    let mut archive = ZipArchive::new(file)
        .context("Failed to open ZIP archive from bundle")?;

    // Safe extraction: ZipArchive::extract() uses enclosed_name() internally,
    // which prevents path traversal and absolute paths. :contentReference[oaicite:6]{index=6}
    archive
        .extract(&temp_dir)
        .with_context(|| format!("Failed to extract ZIP into {:?}", temp_dir))?;

    // 3) Move temp dir into final location.
    if target_dir.exists() {
        // We keep old version folder; just overwrite when ready.
        std::fs::remove_dir_all(&target_dir)
            .with_context(|| format!("Failed to remove old version dir {:?}", target_dir))?;
    }
    std::fs::rename(&temp_dir, &target_dir)
        .with_context(|| format!("Failed to rename {:?} -> {:?}", temp_dir, target_dir))?;

    // 4) Update version state (current/previous).
    let mut state = load_version_state(app)?;
    let prev = state.current.clone();
    state.previous = Some(prev.clone());
    state.current = new_version.clone();
    save_version_state(app, &state)?;

    Ok(ApplyResult {
        from_version: prev,
        to_version: new_version,
    })
}

// Small helper so default_tuf_config can be used via `TufConfig::default_tuf_config(app)`
impl TufConfig {
    pub fn default_tuf_config(app: &AppHandle) -> Result<TufConfig> {
        super::tuf_config::default_tuf_config(app)
    }
}
