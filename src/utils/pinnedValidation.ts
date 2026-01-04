/**
 * This is src/lib/utils/pinnedValidation.ts
 * Used by: src/lib/components/panels/PinnedFoldersPanel.svelte
 * Purpose: Validates pinned folder paths for existence and accessibility
 * Trigger: Called on focus, store changes, or scheduled
 * Event Flow: Invokes validate_paths, updates store with validation status
 * List of functions: refreshPinnedValidation, schedulePinnedValidation, initPinnedValidationListeners
 */

import { invoke } from '$lib/tauri/ipc';
import { safeInvoke, CancelToken } from '$lib/services/safeInvoke';
import { pinnedRaw, type StorePinnedItem } from '$lib/stores/pinned.store';
import type { PinnedItem } from '$lib/utils/types';

type PathStatus = {
  path: string;
  exists: boolean;
  is_dir: boolean;
  is_symlink: boolean;
  accessible: boolean;
  error?: string | null;
};

let _timer: any = null;
let _inFlight = false;

export async function refreshPinnedValidation() {
  if (_inFlight) return; // avoid overlap
  _inFlight = true;
  try {
    let items: StorePinnedItem[] = [];
    pinnedRaw.subscribe((value: StorePinnedItem[]) => items = value)(); // Get current value synchronously
    if (!items.length) return;

    const paths = items.map((i: StorePinnedItem) => i.path);
    const res = await safeInvoke<PathStatus[]>(
      'validate_paths',
      { paths },
      () => [],
      new CancelToken()
    );

    // Build a map by path for quick lookups
    const map = new Map<string, PathStatus>(res.map((r) => [r.path, r]));

    pinnedRaw.update((arr: StorePinnedItem[]) =>
      arr.map((i: StorePinnedItem) => {
        const r = map.get(i.path);
        if (!r) return i;
        return {
          ...i,
          _missingPath: !r.exists,
          _inaccessible: r.exists && !r.accessible,
          _lastError: r.error ?? null
        } as PinnedItem;
      })
    );
  } catch (error) {
    // If validate_paths command doesn't exist yet, silently continue
    console.log('Path validation not available yet');
  } finally {
    _inFlight = false;
  }
}

// Revalidate soon after store changes (debounced)
export function schedulePinnedValidation(delay = 250) {
  clearTimeout(_timer);
  _timer = setTimeout(() => void refreshPinnedValidation(), delay);
}

// Hook for a Svelte component root (call once)
export function initPinnedValidationListeners() {
  const onFocus = () => schedulePinnedValidation(50);
  window.addEventListener('focus', onFocus);
  const unsub = pinnedRaw.subscribe(() => schedulePinnedValidation(250));
  // Return cleanup
  return () => {
    window.removeEventListener('focus', onFocus);
    unsub();
    clearTimeout(_timer);
  };
}
