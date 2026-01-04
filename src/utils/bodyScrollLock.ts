/**
 * This is src/lib/utils/bodyScrollLock.ts
 * Used by: src/lib/P3/Preview/controls/P3NewViewControl.svelte, src/lib/P3/controls/NewViewControl.svelte, src/lib/P2/controls/NewViewControl.svelte, src/lib/folderTree/controls/NewViewControl.svelte
 * Purpose: Manages body scroll locking to prevent scrolling when modals or overlays are open
 * Trigger: Called when opening/closing views or controls that require scroll lock
 * Event Flow: Reference counting to handle multiple locks, sets body overflow hidden when first lock, restores when last unlock
 * List of functions: lockBody, unlockBody
 */

// bullet-proof, HMR-safe ref counter
declare global {
  interface Window { __filesup_bodyLocks?: Map<string, number> }
}
const map = (window.__filesup_bodyLocks ??= new Map());

export function lockBody(id: string) {
  const n = (map.get(id) ?? 0) + 1;
  map.set(id, n);
  if (n === 1) document.body.style.overflow = 'hidden';
}

export function unlockBody(id: string) {
  const n = (map.get(id) ?? 0) - 1;
  if (n <= 0) {
    map.delete(id);
    document.body.style.overflow = '';
  } else {
    map.set(id, n);
  }
}

// HMR cleanup: when module is disposed, drop this module's locks
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // best effort unlock for this module's locks
    map.clear();
    document.body.style.overflow = '';
  });
}