// src/qaTaskFlow/tasks/checkUpdatesTask.ts
//
// ASC-friendly task that calls the Tauri TUF commands.
// The task is intentionally small and pure so the agent
// can reason about it easily.

import { invoke } from '@tauri-apps/api/core';

export interface UpdateCheckResult {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
}

export interface DownloadResult {
  version: string;
  bundle_path: string;
}

export interface ApplyResult {
  from_version: string;
  to_version: string;
}

/**
 * Ask the backend (TUF client) whether a newer version exists.
 *
 * @param currentVersion The version of the code that is currently running.
 * @param platformId     Platform identifier, e.g. "desktop-windows-x86_64".
 */
export async function checkUpdatesTask(
  currentVersion: string,
  platformId: string
): Promise<UpdateCheckResult> {
  const result = await invoke<UpdateCheckResult>('tuf_check_for_updates', {
    currentVersion,
    platformId
  });

  return result;
}

/**
 * Download the latest signed update bundle for this platform.
 * The backend handles all TUF details and returns the local ZIP path.
 */
export async function downloadUpdateTask(
  platformId: string
): Promise<DownloadResult> {
  const result = await invoke<DownloadResult>('tuf_download_update', {
    platformId
  });

  return result;
}

/**
 * Apply a previously downloaded bundle.
 * This extracts the ZIP into versions/<version>/ and updates state.
 */
export async function applyUpdateTask(
  bundlePath: string,
  newVersion: string
): Promise<ApplyResult> {
  const result = await invoke<ApplyResult>('tuf_apply_update', {
    bundlePath,
    newVersion
  });

  return result;
}
