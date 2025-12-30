#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Central update module (TUF + version FS + update manager).
// You will add the actual implementation in src-tauri/src/update/*.rs
mod update;
mod ai_bundle;

use crate::update::{ApplyResult, DownloadResult, UpdateCheckResult};
use crate::ai_bundle::{write_latest_bundle, write_debug_bundle};

/// Entry point for the Tauri application.
/// - Registers all Tauri commands (hello, debug bundle, folder listing, TUF updates).
/// - For mobile builds, uses the mobile entry point attribute.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      hello,
      read_debug_bundle,
      list_dir,
      tuf_check_for_updates,
      tuf_download_update,
      tuf_apply_update,
      write_latest_bundle,
      write_debug_bundle
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Simple test command to verify that the backend is alive.
/// You can call this from the frontend via:
///   invoke('hello', { name: 'World' })
#[tauri::command]
fn hello(name: &str) -> String {
  format!("Hello, {}! ASC ready.", name)
}

/// Read the latest debug bundle that ASC wrote.
///
/// The bundle path is fixed:
///   .ai/bundles/latest.bundle.md
///
/// This is the single canonical source of truth for the AI agent.
/// Frontend can call:
///   invoke<string>('read_debug_bundle')
#[tauri::command]
fn read_debug_bundle() -> Result<String, String> {
  let bundle_path = std::path::Path::new(".ai/bundles/latest.bundle.md");
  std::fs::read_to_string(bundle_path)
    .map_err(|e| format!("Failed to read bundle: {}", e))
}

/// File entry used by the folder listing API.
/// - `name`: file or directory name
/// - `is_dir`: true if this entry is a directory
/// - `size`: file size in bytes (0 for directories)
/// - `modified`: last modified timestamp (seconds since UNIX_EPOCH as string)
#[derive(serde::Serialize)]
pub struct FileEntry {
  name: String,
  is_dir: bool,
  size: u64,
  modified: String,
}

/// List directory contents for a given filesystem path.
///
/// Safety rules:
/// - Validates that path exists and is a directory.
/// - Returns a simple, serializable structure (FileEntry).
/// - Sorts directories first, then files, both alphabetically by name.
///
/// Frontend can call:
///   invoke<FileEntry[]>('list_dir', { path: 'C:\\' })
#[tauri::command]
fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
  let dir_path = std::path::Path::new(&path);
  
  if !dir_path.exists() {
    return Err(format!("Path does not exist: {}", path));
  }
  
  if !dir_path.is_dir() {
    return Err(format!("Path is not a directory: {}", path));
  }

  let mut entries = Vec::new();

  match std::fs::read_dir(dir_path) {
    Ok(entries_iter) => {
      for entry in entries_iter {
        if let Ok(entry) = entry {
          let metadata = entry.metadata();
          if let Ok(meta) = metadata {
            let name = entry
              .file_name()
              .into_string()
              .unwrap_or_else(|_| "?".to_string());
            
            let modified = meta
              .modified()
              .ok()
              .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
              .map(|d| d.as_secs().to_string())
              .unwrap_or_else(|| "0".to_string());

            entries.push(FileEntry {
              name,
              is_dir: meta.is_dir(),
              size: meta.len(),
              modified,
            });
          }
        }
      }
    }
    Err(e) => {
      return Err(format!("Failed to read directory: {}", e));
    }
  }

  // Directories first, then files, within each group sort by name.
  entries.sort_by(|a, b| {
    match (a.is_dir, b.is_dir) {
      (true, false) => std::cmp::Ordering::Less,
      (false, true) => std::cmp::Ordering::Greater,
      _ => a.name.cmp(&b.name),
    }
  });

  Ok(entries)
}

/// TUF: check if a newer signed update is available.
///
/// - `current_version`: the version currently running (e.g. "0.0.1").
/// - `platform_id`: platform string used in TUF targets
///   (e.g. "desktop-windows-x86_64", "desktop-macos-aarch64").
///
/// Returns:
///   { current_version, latest_version, update_available }
///
/// Frontend ASC flow should call this via a Task and Contract.
#[tauri::command]
async fn tuf_check_for_updates(
  app: tauri::AppHandle,
  current_version: String,
  platform_id: String,
) -> Result<UpdateCheckResult, String> {
  update::check_for_updates(&app, current_version, platform_id)
    .await
    .map_err(|e| e.to_string())
}

/// TUF: download and verify the latest signed update bundle.
///
/// - Uses TUF repository configured in update/tuf_config.rs.
/// - Verifies signatures, metadata freshness, and target hashes.
/// - Saves the ZIP bundle into the local targets cache.
///
/// Returns:
///   { version, bundle_path }
///
/// Bundle is not applied automatically; a separate step is needed.
#[tauri::command]
async fn tuf_download_update(
  app: tauri::AppHandle,
  platform_id: String,
) -> Result<DownloadResult, String> {
  update::download_update_bundle(&app, platform_id)
    .await
    .map_err(|e| e.to_string())
}

/// Apply a previously downloaded update bundle.
///
/// - Extracts the ZIP into `versions/<version>/`.
/// - Updates version_state.json (current / previous).
/// - Does NOT restart the app; you can decide how to switch.
///
/// Frontend ASC flow can:
///   1) call tuf_download_update()
///   2) call tuf_apply_update()
///   3) optionally ask user to restart or let a launcher handle it.
#[tauri::command]
fn tuf_apply_update(
  app: tauri::AppHandle,
  bundle_path: String,
  new_version: String,
) -> Result<ApplyResult, String> {
  update::apply_staged_update(&app, bundle_path, new_version)
    .map_err(|e| e.to_string())
}
