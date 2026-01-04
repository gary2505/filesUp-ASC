/**
 * This is src/lib/utils/path-id.ts
 * Used by: src/lib/P3/FolderTreePanel.svelte, src/lib/P2/FolderTreePanel.svelte, src/lib/keyboard/panels-nav-glue.normalized.ts
 * Purpose: Normalizes paths for stable IDs across platforms
 * Trigger: Called to create consistent path identifiers
 * Event Flow: Normalizes slashes, case, trailing slashes
 * List of functions: normalizePathId, pathEq, idsFromItems
 */

// src/lib/ids/path-id.ts
// Stable ID generator + equality for file system paths across OSes/views.
// Use this if your IDs are `path` strings to avoid issues with case & slashes.

export interface NormalizeOpts {
  caseInsensitive?: boolean; // default: auto-detect from the path (drive letter or backslashes => true)
  keepTrailingSlash?: boolean; // default: false (except for root)
}

/** Heuristics to guess if a path is Windows-like */
function looksWindows(p: string) {
  return /^[a-zA-Z]:[\\/]/.test(p) || /\\/.test(p) || /^\\\\/.test(p);
}

/**
 * Normalize a path to a stable ID string.
 * - Converts backslashes to '/'
 * - Collapses duplicate slashes
 * - Removes trailing slash (except root) unless keepTrailingSlash
 * - Case-folds if caseInsensitive
 */
export function normalizePathId(raw: string, opts: NormalizeOpts = {}): string {
  if (!raw) return "";

  const caseInsensitive = opts.caseInsensitive ?? looksWindows(raw);

  // Preserve UNC/network prefix: \\\\server\share => //server/share
  let p = raw.replace(/\\/g, "/");
  if (p.startsWith("////")) p = "//" + p.replace(/^\/+/, ""); // collapse 4+ leading slashes to 2
  // Collapse multiple slashes in the middle
  p = p.replace(/\/+/g, "/");

  // Handle trailing slash (but keep root like '/' or 'C:/')
  if (!opts.keepTrailingSlash) {
    if (p.length > 1 && !/^[a-zA-Z]:\/$/.test(p)) {
      p = p.replace(/\/$/, "");
    }
  }

  // Lowercase for case-insensitive file systems (Windows, most macOS volumes)
  if (caseInsensitive) p = p.toLowerCase();

  return p;
}

export function pathEq(a: string, b: string, opts?: NormalizeOpts) {
  return normalizePathId(a, opts) === normalizePathId(b, opts);
}

// Convenience helpers to map data to IDs
export function idsFromItems<T extends { path: string }>(items: T[], opts?: NormalizeOpts) {
  return items.map((i) => normalizePathId(i.path, opts));
}

// —————————————————————————————————————————
// DROP-IN USAGE
//
// import { normalizePathId, idsFromItems } from '$lib/ids/path-id';
//
// // P3 list options:
// getOrderIds: () => idsFromItems(items),
//
// // P1/P2 tree flatten:
// order.push(normalizePathId(node.item.path));
//
// // Selection toggle / lookups:
// const id = normalizePathId(item.path);
// selection.update(s => ({ ...s, selected: new Set(s.selected).add(id), focusedId: id }));
