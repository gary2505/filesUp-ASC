/**
 * This is src/lib/utils/singleFlight.ts
 * Used by: src/lib/utils/fs.wrapped.ts, src/lib/utils/invokeSafe.ts, src/lib/services/expandController.ts, src/lib/P1/MyPCPanel.svelte
 * Purpose: Coalesces duplicate inflight calls under a key
 * Trigger: Wraps async functions to prevent duplicates
 * Event Flow: Checks map for existing promise, returns it or creates new
 * List of functions: singleFlight
 */

// singleFlight.ts — coalesce duplicate inflight calls under a key.
const inflight = new Map<string, Promise<any>>();

export function singleFlight<T>(key: string, factory: () => Promise<T>): Promise<T>;
export function singleFlight<T>(key: string, factory: () => Promise<T | undefined>): Promise<T | undefined>;
export function singleFlight<T>(key: string, factory: () => Promise<T | undefined>): Promise<T | undefined> {
  const exist = inflight.get(key);
  if (exist) return exist as Promise<T | undefined>;

  const p = (async () => {
    try { return await factory(); }
    finally { inflight.delete(key); }
  })();

  inflight.set(key, p);
  return p;
}