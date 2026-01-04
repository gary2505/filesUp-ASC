/**
 * This is src/lib/utils/format.ts
 * Used by: src/lib/P3/utils/tooltipFormatter.ts, src/lib/P3/parts/folderTreePanelClipboard.ts, src/lib/P3/parts/TreeRowDets.svelte, src/lib/P3/parts/TreeRow.svelte, src/lib/P3/parts/deleteDialogs.ts, src/lib/P1/TreeNodeView.svelte, src/lib/P1/parts/DetailsTreeRow.svelte, src/lib/P2/utils/tooltipFormatter.ts
 * Purpose: Formats numbers as human-readable strings (bytes, duration)
 * Trigger: Called when displaying file sizes or durations in UI
 * Event Flow: Converts numbers to formatted strings with units
 * List of functions: formatBytes, formatDurationMs
 */

// src/lib/utils/format.ts
export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return '';
  const u = ['B','KB','MB','GB','TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function formatDurationMs(ms?: number): string {
  if (!ms || ms < 0) return '';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}
