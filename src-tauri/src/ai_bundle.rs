use std::fs;
use std::path::{Path, PathBuf};

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
