// src/lib/core/startupCoordinator.ts
import { createDebugLogger } from './logging/unified-logger';
import { derived, writable, get } from 'svelte/store';
import type { Readable, Unsubscriber } from 'svelte/store';

// Helper function to ensure initial navigation after startup
async function ensureInitialNavigation() {
  try {
    // Import dynamically to avoid circular dependencies
    const { panelStates } = await import('$lib/stores/panelStates.store');
    const ps = get(panelStates);
    
    // Check if any panel has a current folder
    const hasCurrent = !!ps?.P1?.currentFolder || !!ps?.P2?.currentFolder || !!ps?.P3?.currentFolder;
    
    if (!hasCurrent) {
      log.info('startup', 'initial-nav', 'No current folder in any panel, setting default path');
      
      // ✅ Write directly to the store rather than dispatching a window event
      const fallbackPath = 'C:\\';
      panelStates.update(s => ({
        ...s,
        P1: { ...(s.P1 ?? {}), currentFolder: fallbackPath, selectedFolder: fallbackPath, contextType: 'drive' },
        P2: { ...(s.P2 ?? {}), currentFolder: fallbackPath, selectedFolder: fallbackPath, contextType: 'drive' }
      }));
      
      log.info('startup', 'initial-nav', 'Set fallback path for P1 and P2', { fallbackPath });
    } else {
      // Check if P2 specifically is empty even when P1 has content
      // BUT only if we haven't explicitly skipped P2 auto-population (e.g., after refresh)
      if (!ps?.P2?.currentFolder && !!ps?.P1?.currentFolder) {
        const shouldSkip = get(skipP2AutoPopulation);
        
        log.info('startup', 'p2-check', 'P2 Auto-population check', {
          P2_currentFolder: ps?.P2?.currentFolder,
          P1_currentFolder: ps?.P1?.currentFolder,
          skipP2AutoPopulation: shouldSkip
        });
        
        if (shouldSkip) {
          log.info('startup', 'p2-check', 'Skipping P2 auto-population (refresh mode)');
        } else {
          log.info('startup', 'p2-check', 'P2 is empty while P1 has content, setting P2 default path');
          const fallbackPath = 'C:\\';
          panelStates.update(s => ({
            ...s,
            P2: { ...(s.P2 ?? {}), currentFolder: fallbackPath, selectedFolder: fallbackPath, contextType: 'drive' }
          }));
          
          log.info('startup', 'p2-check', 'Set fallback path for P2 specifically', { fallbackPath });
        }
      }
    }
  } catch (error) {
    log.warn('startup', 'ensure-navigation', 'Failed to ensure initial navigation', { error });
  }
}

const log = createDebugLogger('StartupCoordinator');
const SCOPE = 'startup' as const;

// Reusable helper: waits until predicate(storeValue) is true, then resolves.
export function waitFor<T>(
  store: Readable<T>,
  predicate: (v: T) => boolean
): Promise<T> {
  return new Promise<T>((resolve) => {
    // Fast path: if already satisfied, resolve without subscribing
    const current = get(store);
    if (predicate(current)) {
      resolve(current);
      return;
    }

    let unsub: Unsubscriber | null = null;
    const handler = (v: T) => {
      if (predicate(v)) {
        // Unsubscribe only after we've actually assigned `unsub`
        unsub?.();
        resolve(v);
      }
    };

    // Assign AFTER handler is defined
    unsub = store.subscribe(handler);
  });
}

/**
 * Startup coordination to prevent mount/teardown races
 */

// Global startup state
export const startupPhase = writable<'pending' | 'session-loading' | 'components-ready' | 'complete'>('pending');
export const sessionRestorationComplete = writable(false);
export const pinnedFoldersLoaded = writable(false);

// Flag to skip P2 auto-population after refresh
export const skipP2AutoPopulation = writable(true); // Default to true - keep P2 empty

// Derived state for coordination
export const canRestoreSession = derived(
  startupPhase,
  ($phase) => $phase === 'session-loading' || $phase === 'components-ready' || $phase === 'complete'
);

export const canLoadPinnedFolders = derived(
  [startupPhase, sessionRestorationComplete],
  ([$phase, $sessionComplete]) => {
    // Only load pinned folders after session restoration is done
    // or if we're in components-ready phase
    return $sessionComplete || $phase === 'components-ready' || $phase === 'complete';
  }
);

export const startupComplete = derived(
  [sessionRestorationComplete, pinnedFoldersLoaded],
  ([$sessionComplete, $pinnedComplete]) => $sessionComplete && $pinnedComplete
);

/**
 * Startup coordinator API
 */
export const startupCoordinator = {
  /**
   * Mark that session loading can begin
   */
  beginSessionLoading() {
    log.info('startup', 'session', 'Starting session loading phase');
    startupPhase.set('session-loading');
  },

  /**
   * Mark that session restoration is complete
   */
  completeSessionRestoration() {
    log.info('startup', 'session', 'Session restoration complete');
    sessionRestorationComplete.set(true);
    startupPhase.set('components-ready');
  },

  /**
   * Mark that pinned folders loading is complete
   */
  async completePinnedFoldersLoading() {
    log.info('startup', 'pinned', 'Pinned folders loading complete');
    pinnedFoldersLoaded.set(true);
    
    // Wait for session restoration to complete, then mark startup as complete
    try {
      await waitFor(sessionRestorationComplete, (done) => done === true);
      startupPhase.set('complete');
      log.info('startup', 'complete', 'Startup coordination complete');
      
      // ✅ Ensure at least one panel has a current folder after startup
      await ensureInitialNavigation();
      
      // Final log confirming navigation is ready
      log.info('startup', 'complete', 'Startup coordination complete; initial navigation ensured', {
        phase: get(startupPhase)
      });
    } catch (error) {
      log.warn('startup', 'complete', 'Session restoration wait failed, marking startup complete anyway', { error });
      startupPhase.set('complete');
    }
  },

  /**
   * Reset coordination state (for testing or hot reload)
   */
  reset() {
    log.info('startup', 'reset', 'Resetting startup coordination');
    startupPhase.set('pending');
    sessionRestorationComplete.set(false);
    pinnedFoldersLoaded.set(false);
    // NOTE: Don't reset skipP2AutoPopulation here - it should persist through refresh
  },

  /**
   * Enable skip P2 auto-population mode (for refresh scenarios)
   */
  enableSkipP2AutoPopulation() {
    log.info('startup', 'p2-skip', 'Enabling skip P2 auto-population mode');
    skipP2AutoPopulation.set(true);
    log.info('startup', 'p2-skip', 'skipP2AutoPopulation flag set', { value: get(skipP2AutoPopulation) });
  }
};