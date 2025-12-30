// src-tauri/src/update/tuf_config.rs
//
// TUF client configuration:
// - Where to find remote metadata & targets
// - Where to store local TUF cache (metadata, downloaded targets)
// - Where the initial trusted root.json lives.
//
// You can start with a single production TUF repo like:
//   https://updates.filesup.app/metadata/
//   https://updates.filesup.app/targets/
//
// The repo itself is created & signed outside of the app
// using `tuftool` (or any other TUF tooling). :contentReference[oaicite:2]{index=2}

use std::fs;
use std::path::PathBuf;

use anyhow::{anyhow, Context, Result};
use tauri::AppHandle;
use url::Url;

#[derive(Debug, Clone)]
pub struct TufConfig {
    #[allow(dead_code)]
    pub metadata_base_url: Url,
    #[allow(dead_code)]
    pub targets_base_url: Url,
    pub root_path: PathBuf,
    pub datastore_path: PathBuf,
    pub targets_cache_dir: PathBuf,
}

impl TufConfig {
    /// Helper to ensure that all required directories exist.
    fn ensure_dirs(&self) -> Result<()> {
        if let Some(parent) = self.root_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create TUF root parent dir: {:?}", parent))?;
        }
        fs::create_dir_all(&self.datastore_path)
            .with_context(|| format!("Failed to create TUF datastore dir: {:?}", self.datastore_path))?;
        fs::create_dir_all(&self.targets_cache_dir)
            .with_context(|| format!("Failed to create TUF targets cache dir: {:?}", self.targets_cache_dir))?;
        Ok(())
    }
}

/// Build a default TUF configuration for this app.
///
/// This uses the OS-specific app config directory, for example:
/// - Windows: C:\Users\<you>\AppData\Roaming\FilesUP\
/// - macOS:   ~/Library/Application Support/FilesUP/
/// - Linux:   ~/.config/FilesUP/
///
/// Layout inside config dir:
///   tuf/
///     root.json          (initial trusted root, updated via TUF root rotation)
///     metadata-cache/    (cached metadata: timestamp, snapshot, targets)
///     targets-cache/     (downloaded target files, e.g. update bundles)
pub fn default_tuf_config(app: &AppHandle) -> Result<TufConfig> {
    use tauri::Manager;
    let app_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| anyhow!("App config dir error: {}", e))?;

    let tuf_dir = app_dir.join("tuf");
    let root_path = tuf_dir.join("root.json");
    let datastore_path = tuf_dir.join("metadata-cache");
    let targets_cache_dir = tuf_dir.join("targets-cache");

    // TODO: Change these URLs to your real update infra.
    // Important: metadata and targets must be separate endpoints in TUF.
    let metadata_base_url = Url::parse("https://updates.filesup.app/metadata/")
        .context("Failed to parse TUF metadata base URL")?;
    let targets_base_url = Url::parse("https://updates.filesup.app/targets/")
        .context("Failed to parse TUF targets base URL")?;

    let cfg = TufConfig {
        metadata_base_url,
        targets_base_url,
        root_path,
        datastore_path,
        targets_cache_dir,
    };

    cfg.ensure_dirs()?;
    Ok(cfg)
}

/// Helper used in tests or dev builds to override URLs.
#[allow(dead_code)]
pub fn with_custom_urls(
    app: &AppHandle,
    metadata_url: &str,
    targets_url: &str,
) -> Result<TufConfig> {
    let mut cfg = default_tuf_config(app)?;
    cfg.metadata_base_url = Url::parse(metadata_url)
        .context("Failed to parse custom metadata URL")?;
    cfg.targets_base_url = Url::parse(targets_url)
        .context("Failed to parse custom targets URL")?;
    Ok(cfg)
}
