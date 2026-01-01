use std::fs;
use std::path::{Path, PathBuf};

// src-tauri/src/ai_bundle.rs
// Used by: src-tauri/src/lib.rs
// Purpose: Provides Tauri commands to write debug bundles (.ai/bundles/latest.bundle.md).
// Trigger: Called via invoke() from frontend TaskFlow runtime.
// Event Flow: Frontend calls write_debug_bundle -> finds repo root -> creates .ai/bundles/ -> writes latest.bundle.md
// Functions:
//   - find_repo_root(): Walks up directories to locate package.json
//   - ensure_parent_dir(): Creates parent directories if needed
//   - write_latest_bundle(): Legacy command that returns path
//   - write_debug_bundle(): New command for TaskFlow runtime (returns ())

/// Find the repository root by walking up directories until package.json is found.
/// Why: Tauri runs from src-tauri/ but we need to write to repo root.
fn find_repo_root() -> PathBuf {
  // Best-effort: walk up a few levels and stop where package.json exists.
  let mut dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
  for _ in 0..6 {
    if dir.join("package.json").exists() {
      return dir;
    }
    if !dir.pop() {
      break;
    }
  }
  std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Create parent directories if they don't exist.
/// Why: Ensures .ai/bundles/ path exists before writing bundle.
fn ensure_parent_dir(path: &Path) -> std::io::Result<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }
  Ok(())
}

/// Write `.ai/bundles/latest.bundle.md` into the repo root (best-effort located).
/// Returns the absolute path written to, as a string.
#[tauri::command]
pub fn write_latest_bundle(markdown: String) -> Result<String, String> {
  let root = find_repo_root();
  let path = root.join(".ai").join("bundles").join("latest.bundle.md");

  ensure_parent_dir(&path).map_err(|e| e.to_string())?;
  fs::write(&path, markdown).map_err(|e| e.to_string())?;

  Ok(path.to_string_lossy().into_owned())
}

/// Alias for write_latest_bundle - writes the debug bundle to disk.
/// Why: TaskFlow runtime needs a consistent command name for bundle evidence.
/// Called by: src/qaTaskFlow/runtime/writeBundle.ts
#[tauri::command]
pub fn write_debug_bundle(md: String) -> Result<(), String> {
  let root = find_repo_root();
  let path = root.join(".ai").join("bundles").join("latest.bundle.md");

  ensure_parent_dir(&path).map_err(|e| e.to_string())?;
  fs::write(&path, md).map_err(|e| e.to_string())?;

  Ok(())
}
