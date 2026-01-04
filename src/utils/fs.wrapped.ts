
/**
 * This is src/lib/utils/fs.wrapped.ts
 * Used by: src/lib/utils/startupOrchestrator.ts, src/lib/P2/services/fs.service.ts, src/lib/P3/services/fs.service.ts, src/lib/P1/MyPCPanel.svelte, src/lib/layout/tabs/Tab1Layout.svelte, src/lib/components/panels/MainPanels.svelte, src/lib/components/navigation/Breadcrumb.svelte, src/lib/boot/bootOrchestrator_notUsed.ts
 * Purpose: Safe wrappers for filesystem operations with timeouts and fallbacks
 * Trigger: Called when performing FS operations like checking files/dirs, reading dirs, getting drives
 * Event Flow: Uses invokeSafe with timeouts, handles errors gracefully
 * List of functions: isFile, isDir, readDir, getDrives, getDirectoryContents, getFileInfo, getDirectoryInfo, getDriveInfo
 */

/**
 * fs.wrapped.v2.ts
 * Safer wrappers with per-call timeouts and typed fallbacks.
 */
import { invokeSafe } from './invokeSafe';
import { singleFlight } from './singleFlight';
import type { DriveInfo, FileItem } from '$lib/utils/types';

let firstDrivesCall = true;

export async function isFile(path: string, timeoutMs = 5000): Promise<boolean> {
  const res = await invokeSafe<boolean>('fs_is_file', { path }, { timeoutMs });
  return !!res;
}

export async function isDir(path: string, timeoutMs = 5000): Promise<boolean> {
  const res = await invokeSafe<boolean>('fs_is_dir', { path }, { timeoutMs });
  return !!res;
}

export interface DirEntry {
  name: string;
  path: string;
  kind: 'file' | 'dir' | 'symlink' | 'other';
  size?: number;
  modifiedMs?: number;
}

export async function readDir(path: string, depth = 1, timeoutMs = 12000): Promise<DirEntry[]> {
  const res = await invokeSafe<DirEntry[]>('fs_read_dir', { path, depth }, { timeoutMs });
  return Array.isArray(res) ? res : [];
}

export async function getDrives(timeoutMs = 12000): Promise<DriveInfo[]> {
  const key = 'get_drives';
  return singleFlight(key, async () => {
    // ✅ First call gets extra budget for Windows cold boot (15s minimum)
    const budget = firstDrivesCall ? Math.max(timeoutMs, 15000) : timeoutMs;
    firstDrivesCall = false;

    // Silent - getDrives internal operations (too noisy)
    
    try {
      // ✅ Use simplified invokeSafe with timeout
      const res = await invokeSafe<DriveInfo[]>('get_drives', {}, { 
        timeoutMs: budget
      });
      
      if (!Array.isArray(res)) {
        console.warn('[fs.wrapped] get_drives returned non-array or undefined:', res, typeof res);
        return [];
      }
      
      // Silent - getDrives success (too noisy, repeated calls)
      return res;
      
    } catch (error) {
      console.error('[fs.wrapped] getDrives error:', error);
      // ✅ Don't re-throw; return empty array for graceful degradation
      return [];
    }
  });
}

export async function getDirectoryContents(path: string, timeoutMs = 10000): Promise<FileItem[]> {
  // ✅ FIXED: Use 'list_dir' instead of 'get_directory_contents'
  //    - Returns FileItem with proper mtime/ctime (u64 milliseconds)
  //    - Fixes "----" date display bug (was getting DirectoryEntry with string seconds)
  const res = await invokeSafe<FileItem[]>('list_dir', { path }, { timeoutMs });
  
  // Unified logger for directory loading
  if (Array.isArray(res)) {
    const folderCount = res.filter(item => item.kind === 'Folder').length;
    const fileCount = res.filter(item => item.kind === 'File').length;
    const totalSize = res.reduce((acc, item) => acc + (item.size || 0), 0);
    
    // Summary at debug level
    import('$lib/core/logging/unified-logger').then(({ logger }) => {
      logger.debug(
        { scope: 'fs', component: 'DirLoader', action: 'load.complete' },
        'Directory loaded',
        {
          path,
          totalItems: res.length,
          folders: folderCount,
          files: fileCount,
          totalBytes: totalSize
        }
      );
      
      // Detailed items dump only at trace level and only for small dirs in dev
      if (import.meta.env.DEV && res.length <= 100) {
        logger.trace(
          { scope: 'fs', component: 'DirLoader', action: 'items.dump' },
          'Dumping directory items',
          {
            path,
            items: res.slice(0, 10).map(item => ({
              name: item.name,
              kind: item.kind,
              size: item.size,
              isEmpty: item.isEmpty
            }))
          }
        );
      }
    });
  }
  
  return Array.isArray(res) ? res : [];
}

function formatBytesSimple(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
