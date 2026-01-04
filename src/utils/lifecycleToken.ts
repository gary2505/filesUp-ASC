/**
 * This is src/lib/utils/lifecycleToken.ts
 * Used by: src/lib/layout/tabs/Tab1Layout.svelte
 * Purpose: Generation-based lifecycle tracking system that cancels stale async operations during HMR and page unload
 * Trigger: Auto-initializes on setupLifecycleTokenHooks() call, bumps on unload/HMR
 * Event Flow: Captures generation, checks validity, bumps on events, aborts stale operations
 * List of functions: setupLifecycleTokenHooks, currentGeneration, bumpGeneration, isUnloading, isGeneration, onGenerationChange, withGenerationGuard, withTimeout
 */

/**
 * src/lib/utils/lifecycleToken.ts
 * 
 * Used by: src/lib/layout/tabs/Tab1Layout.svelte
 * 
 * Purpose: Generation-based lifecycle tracking system that cancels stale async operations
 *          during HMR (Hot Module Reload) and page unload events. Prevents ghost callbacks
 *          and race conditions when components unmount or reload.
 * 
 * Trigger: - Auto-initializes on setupLifecycleTokenHooks() call in Tab1Layout
 *          - Bumps generation on window beforeunload/pagehide events
 *          - Bumps generation on Vite HMR dispose
 * 
 * Event Flow:
 *   1. Component calls setupLifecycleTokenHooks() on mount
 *   2. Async operation captures current generation via currentGeneration()
 *   3. Before using results, checks isGeneration(g) to see if still valid
 *   4. On HMR/unload, generation bumps and listeners fire
 *   5. Stale operations abort/return undefined instead of corrupting state
 * 
 * Functions:
 *   - setupLifecycleTokenHooks(): Initialize event listeners (idempotent)
 *   - currentGeneration(): Get current generation number
 *   - bumpGeneration(): Increment generation and emit change events
 *   - isUnloading(): Check if page is unloading
 *   - isGeneration(g): Validate if generation token is still current
 *   - onGenerationChange(fn): Subscribe to generation change events
 *   - withGenerationGuard(fn): Async wrapper that returns undefined if stale
 *   - withTimeout(promise, ms): Timeout wrapper that resolves undefined on expiry
 * 
 * Report: Generation-based stale operation guard for HMR and unload safety (1 usage in Tab1Layout)
 */

type Listener = () => void;

class GenBus {
  private _gen = 0;
  private _unloading = false;
  private _initialized = false;
  private listeners = new Set<Listener>();

  get gen() { return this._gen; }
  get unloading() { return this._unloading; }

  /** Idempotent init to wire beforeunload + HMR dispose. Safe to call many times. */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    if (typeof window !== 'undefined') {
      const onBeforeUnload = () => { 
        this._unloading = true; 
        this.emit(); 
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      // pagehide covers mobile/safari cases
      window.addEventListener('pagehide', onBeforeUnload);
    }
    
    // Vite HMR
    if (import.meta && (import.meta as any).hot) {
      (import.meta as any).hot.dispose(() => {
        this.bump();
      });
    }
  }

  on(fn: Listener) { 
    this.listeners.add(fn); 
    return () => this.listeners.delete(fn); 
  }

  emit() { 
    for (const fn of this.listeners) fn(); 
  }

  bump() { 
    this._gen += 1; 
    this.emit(); 
  }

  isCurrent(g: number) { 
    return !this._unloading && g === this._gen; 
  }
}

const BUS = new GenBus();

// Public API
export function setupLifecycleTokenHooks() { BUS.init(); }
export function currentGeneration(): number { return BUS.gen; }
export function bumpGeneration(): number { BUS.bump(); return BUS.gen; }
export function isUnloading(): boolean { return BUS.unloading; }
export function isGeneration(g: number): boolean { return BUS.isCurrent(g); }
export function onGenerationChange(fn: Listener) { return BUS.on(fn); }

/** Guard an async block; returns undefined if stale before completion. */
export async function withGenerationGuard<T>(
  fn: (alive: () => boolean) => Promise<T>
): Promise<T | undefined> {
  const g = currentGeneration();
  const alive = () => isGeneration(g);
  const out = await fn(alive);
  if (!alive()) return undefined;
  return out;
}

/** Wrap a promise with a timeout that resolves to `undefined` on expiry (non-throwing). */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  if (!ms || ms <= 0) return p.then(v => v as any);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    p.then(v => { clearTimeout(timer); resolve(v as any); }, _e => { clearTimeout(timer); resolve(undefined); });
  });
}
