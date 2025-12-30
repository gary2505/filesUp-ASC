// src-tauri/src/update/version_fs.rs
//
// Filesystem layout for side-by-side versions.
//
// Layout under app config dir:
//   versions/
//
// Each version lives in its own folder:
//   versions/0.2.3/
//
// We keep simple JSON state in version_state.json:
//
//   {
//     "current": "0.2.3",
//     "previous": "0.2.2"
//   }
//
// This module doesn't know HOW the launcher starts different versions,
// it only manages folders + state.

use std::fs;
use std::path::PathBuf;

use anyhow::{anyhow, Context, Result};
use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionState {
    pub current: String,
    pub previous: Option<String>,
}

fn versions_root(app: &AppHandle) -> Result<PathBuf> {
    use tauri::Manager;
    let app_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| anyhow!("App config dir error: {}", e))?;
    Ok(app_dir.join("versions"))
}

fn state_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(versions_root(app)?.join("version_state.json"))
}

pub fn load_version_state(app: &AppHandle) -> Result<VersionState> {
    let path = state_path(app)?;
    if !path.exists() {
        // First run: we don't know actual version, caller should set it.
        return Ok(VersionState {
            current: "0.0.0".to_string(),
            previous: None,
        });
    }

    let data = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read version state at {:?}", path))?;
    let state: VersionState = serde_json::from_str(&data)
        .with_context(|| format!("Failed to parse version state at {:?}", path))?;
    Ok(state)
}

pub fn save_version_state(app: &AppHandle, state: &VersionState) -> Result<()> {
    let path = state_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create version state dir {:?}", parent))?;
    }
    let data = serde_json::to_string_pretty(state)
        .context("Failed to serialize version state to JSON")?;
    fs::write(&path, data)
        .with_context(|| format!("Failed to write version state to {:?}", path))?;
    Ok(())
}

/// Returns the directory where a given version should live.
pub fn version_dir(app: &AppHandle, version: &Version) -> Result<PathBuf> {
    Ok(versions_root(app)?.join(version.to_string()))
}
