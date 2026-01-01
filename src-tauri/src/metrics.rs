use serde::Serialize;
use std::{cmp::max, thread, time::Duration};
use tauri::{AppHandle, Emitter};
use sysinfo::{CpuExt, DiskExt, System, SystemExt};

use crate::settings::SystemSettings;

#[derive(Serialize, Clone)]
pub struct DiskUsage {
    pub mount_point: String,
    pub used_percent: f32,
}

#[derive(Serialize, Clone)]
pub struct SystemMetrics {
    pub cpu_total: f32,   // 0..100
    pub mem_used: u64,    // bytes 
    pub mem_total: u64,   // bytes
    // max % may be  None, if no disk
    pub disk_max: Option<DiskUsage>,
}

pub fn start_metrics_loop(app: AppHandle, settings: SystemSettings) {
    thread::spawn(move || {
        let mut sys = System::new_all();

        let mut ticks: u64 = 0;
        let step_ms = settings.cpu_mem_interval_ms.max(250);
        let disk_interval_ms = settings.disk_check_interval_sec.max(1) * 1_000;
        let disk_interval_ticks = max(1, disk_interval_ms / step_ms);

     // cache the last value across disks to avoid tugging disks every tick  
        let mut last_disk_max: Option<DiskUsage> = None;

        loop {
            // ==== CPU + RAM ====
            sys.refresh_cpu();
            sys.refresh_memory();

            let cpu_total = sys.global_cpu_info().cpu_usage();
      // sysinfo often returns KiB → convert to bytes to keep things fair 
            let mem_used_kib = sys.used_memory();
            let mem_total_kib = sys.total_memory();
            let mem_used = mem_used_kib * 1024;
            let mem_total = mem_total_kib * 1024;

       // ==== Disk (every N ticks) ====
            if ticks % disk_interval_ticks == 0 {
                sys.refresh_disks_list();
                sys.refresh_disks();

                let mut best: Option<DiskUsage> = None;

                for disk in sys.disks() {
                    let total = disk.total_space() as f32;
                    let avail = disk.available_space() as f32;
                    if total <= 0.0 {
                        continue;
                    }
                    let used = total - avail;
                    let used_percent = (used / total) * 100.0;

                    let mp = disk
                        .mount_point()
                        .to_string_lossy()
                        .to_string();

                    match &best {
                        Some(current) if current.used_percent >= used_percent => {}
                        _ => {
                            best = Some(DiskUsage {
                                mount_point: mp,
                                used_percent,
                            });
                        }
                    }
                }

                last_disk_max = best;
            }

            let metrics = SystemMetrics {
                cpu_total,
                mem_used,
                mem_total,
                disk_max: last_disk_max.clone(),
            };

            if app.emit("system://metrics", &metrics).is_err() {
                // If the window layer is gone, exit the loop gracefully.
                break;
            }

            ticks = ticks.wrapping_add(1);
            thread::sleep(Duration::from_millis(step_ms));
        }
    });
}

/// Get free space on the disk containing the given path
#[derive(Serialize, Clone)]
pub struct DiskSpaceInfo {
    pub free_bytes: u64,
    pub total_bytes: u64,
    pub mount_point: String,
}

#[tauri::command]
pub fn get_disk_free_space(path: String) -> Result<DiskSpaceInfo, String> {
    use std::path::Path;
    
    let target_path = Path::new(&path);
    
    // Normalize to get the drive/mount point
    let target_str = target_path.to_string_lossy().to_uppercase();
    
    let mut sys = System::new();
    sys.refresh_disks_list();
    sys.refresh_disks();
    
    // Find the disk that contains this path
    let mut best_match: Option<DiskSpaceInfo> = None;
    let mut best_match_len = 0;
    
    for disk in sys.disks() {
        let mount = disk.mount_point().to_string_lossy().to_uppercase();
        
        // Check if target path starts with this mount point
        if target_str.starts_with(&mount) && mount.len() > best_match_len {
            best_match_len = mount.len();
            best_match = Some(DiskSpaceInfo {
                free_bytes: disk.available_space(),
                total_bytes: disk.total_space(),
                mount_point: disk.mount_point().to_string_lossy().to_string(),
            });
        }
    }
    
    best_match.ok_or_else(|| format!("Could not find disk for path: {}", path))
}
