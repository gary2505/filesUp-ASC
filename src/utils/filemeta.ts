/**
 * This is src/lib/utils/filemeta.ts
 * Used by: not used
 * Purpose: Classifies files by extension into groups
 * Trigger: Called to determine file type group
 * Event Flow: Extracts extension, matches against group lists
 * List of functions: classifyFile
 */

import { GROUP_EXTENSIONS } from './filesGroup';

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function classifyFile(name: string): Classified {
  const ext = extOf(name);
  let group: FileGroup = 'other';
  for (const [g, list] of Object.entries(GROUP_EXTENSIONS)) {
    if (list.includes(ext)) {
      group = g as FileGroup;
      break;
    }
  }
  return { group, extension: ext };
}
