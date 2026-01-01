// src/qaTaskFlow/tasks/openFolderTask.ts
import { invoke } from '@tauri-apps/api/core';

export interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
  modified: string;
}

export interface OpenFolderOutput {
  path: string;
  entries: FileEntry[];
  count: number;
}

export async function openFolderTask(folderPath: string): Promise<OpenFolderOutput> {
  try {
    const entries = await invoke<FileEntry[]>('list_dir', { path: folderPath });
    
    return {
      path: folderPath,
      entries,
      count: entries.length
    };
  } catch (err) {
    throw new Error(`Failed to open folder: ${err}`);
  }
}
