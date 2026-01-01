// src-tauri/src/folder_scan.rs

use crate::gps_backend::{OperationKind, OperationRegistry};
use serde::Serialize;
use std::path::PathBuf;
use std::time::Instant;
use tauri::{AppHandle, Manager, State};
use tokio::task;
use tokio_util::sync::CancellationToken;
use walkdir::WalkDir;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderScanProgress {
    op_id: String,
    folder_count: u64,
    file_count: u64,
    total_size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderScanCompleted {
    op_id: String,
    status: String, // "ok" | "cancelled" | "error"
    folder_count: u64,
    file_count: u64,
    total_size: u64,
    error_message: Option<String>,
}

/// Command from TS:
/// invoke("start_folder_scan", { opId, path })
#[tauri::command]
pub async fn start_folder_scan(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    op_id: String,
    path: String,
) -> Result<(), String> {
    let path = PathBuf::from(path);

    // 1) Register operation in global registry, get CancellationToken
    let token: CancellationToken = registry.register(&op_id, OperationKind::FolderScan);

    // 2) Spawn the heavy work in background
    //    Use spawn_blocking because WalkDir is synchronous and potentially heavy.
    task::spawn_blocking(move || {
        let res = run_folder_scan_blocking(&app, &op_id, &path, &token);

        // 3) Emit final "completed" event regardless of outcome
        let (status, folder_count, file_count, total_size, error_message) = match res {
            Ok(stats) => ("ok".to_string(), stats.folders, stats.files, stats.size, None),
            Err(FolderScanError::Cancelled(stats)) => (
                "cancelled".to_string(),
                stats.folders,
                stats.files,
                stats.size,
                None,
            ),
            Err(FolderScanError::IoError(e)) => (
                "error".to_string(),
                0,
                0,
                0,
                Some(format!("I/O error: {}", e)),
            ),
        };

        let _ = app.emit_all(
            "fu:folder_scan_completed",
            FolderScanCompleted {
                op_id: op_id.clone(),
                status,
                folder_count,
                file_count,
                total_size,
                error_message,
            },
        );

        // IMPORTANT:
        // Remove from registry AFTER we emitted completed event.
        // (We don't have registry here because we've moved it, so:
        //  - either pass registry.clone() into spawn_blocking,
        //  - or call a separate "finish" command from TS when it sees "completed")
        //
        // Simple approach: TS calls `gps.endProcess(opId)` and doesn't need backend to track.
        //
        // If you want backend finish too, you can pass OperationRegistry clone into closure.
    });

    Ok(())
}

// Stats container for convenience
struct FolderScanStats {
    folders: u64,
    files: u64,
    size: u64,
}

// Rich error type: either cancelled with partial stats, or IO error.
enum FolderScanError {
    Cancelled(FolderScanStats),
    IoError(std::io::Error),
}

fn run_folder_scan_blocking(
    app: &AppHandle,
    op_id: &str,
    root: &PathBuf,
    token: &CancellationToken,
) -> Result<FolderScanStats, FolderScanError> {
    let mut folder_count = 0u64;
    let mut file_count = 0u64;
    let mut total_size = 0u64;

    let mut batch_counter = 0u64;
    let mut last_emit = Instant::now();

    // WalkDir is synchronous; we loop and periodically:
    // - check cancel token
    // - emit progress event
    for entry in WalkDir::new(root).into_iter() {
        if token.is_cancelled() {
            // Return partial stats; TS can show "partial result" message
            return Err(FolderScanError::Cancelled(FolderScanStats {
                folders: folder_count,
                files: file_count,
                size: total_size,
            }));
        }

        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                // We skip problematic entries but don't kill the whole scan.
                // You can log err here if desired.
                eprintln!("[FolderScan] WalkDir error: {err}");
                continue;
            }
        };

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(err) => {
                eprintln!("[FolderScan] Metadata error: {err}");
                continue;
            }
        };

        if metadata.is_dir() {
            folder_count += 1;
        } else if metadata.is_file() {
            file_count += 1;
            total_size = total_size.saturating_add(metadata.len());
        }

        batch_counter += 1;

        // Throttle: don't emit every file; emit every N entries OR every ~100ms
        if batch_counter % 256 == 0 || last_emit.elapsed().as_millis() >= 100 {
            let _ = app.emit_all(
                "fu:folder_scan_progress",
                FolderScanProgress {
                    op_id: op_id.to_string(),
                    folder_count,
                    file_count,
                    total_size,
                },
            );
            last_emit = Instant::now();
        }
    }

    // Final progress update
    let _ = app.emit_all(
        "fu:folder_scan_progress",
        FolderScanProgress {
            op_id: op_id.to_string(),
            folder_count,
            file_count,
            total_size,
        },
    );

    Ok(FolderScanStats {
        folders: folder_count,
        files: file_count,
        size: total_size,
    })
}
