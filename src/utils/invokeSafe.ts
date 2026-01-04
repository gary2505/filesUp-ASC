/**
 * This is src/lib/utils/invokeSafe.ts
 * Used by: src/lib/utils/settings-io.ts, src/lib/utils/fs.wrapped.ts
 * Purpose: Safe wrapper for Tauri invoke with retries, timeouts, and error handling
 * Trigger: Called when invoking Tauri commands
 * Event Flow: Waits for bridge, handles retries, timeouts, coalesces calls
 * List of functions: invokeSafe, singleFlight, withTimeout
 */

/**
 * invokeSafe — race-hardened invoker for Tauri v2
 * - waits for bridge (single-flight) via waitTauriReady()
 * - blocks during reload (beforeunload) to avoid ghost-callback errors
 * - short retries for TIMEOUT / "Couldn't find callback id"
 * - optional cold-start slack for the first call (Windows)
 * - single-flight coalescing by key
 */
import { waitTauriReady, type Bridge } from './tauriReady';
 
// simple single-flight (per-key) coalescing
const inflight = new Map<string, Promise<any>>();
function singleFlight<T>(key: string, fn: () => Promise<T | undefined>): Promise<T | undefined> {
  if (inflight.has(key)) return inflight.get(key) as Promise<T | undefined>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  if (!ms || ms <= 0) return p as any;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(undefined), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// Reload guard: block new invokes while the page unloads (HMR/dev navigation)
let unloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { unloading = true; });
}

export type InvokeOptions = {
  timeoutMs?: number;         // total time budget per attempt (soft)
  strict?: boolean;           // strict=true => throw on timeout/stale
  retries?: number;           // retries for transient errors (default 1)
  retryDelayMs?: number;      // delay between retries
  coldStartSlackMs?: number;  // extra budget for the very first call
  key?: string;               // optional single-flight key
  allowNull?: boolean;        // allow null returns without treating as error
};

let firstCall = true;

export async function invokeSafe<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
  opts: InvokeOptions = {}
): Promise<T | undefined> {
  if (typeof window === 'undefined') throw new Error('invokeSafe called in non-browser environment');
  if (unloading) {
    const e: any = new Error(`[invokeSafe] page unloading; abort "${cmd}"`);
    e.code = 'PAGE_UNLOADING';
    throw e;
  }

  const attemptOnce = async (bridge: Bridge, budgetMs: number): Promise<T | undefined> => {
    const raced = await withTimeout(bridge.invoke(cmd, args), budgetMs);
    if (typeof raced === 'undefined' && budgetMs > 0) {
      if (opts.strict) {
        const err: any = new Error(`invokeSafe timeout for "${cmd}" after ${budgetMs}ms`);
        err.name = 'AbortError';
        throw err;
      }
      return undefined;
    }
    return raced as T;
  };

  const exec = async () => {
    const bridge = await waitTauriReady(); // resolves the concrete invoke + source

    let retries = Math.max(0, opts.retries ?? 1);
    const retryDelay = opts.retryDelayMs ?? 150;
    const coldSlack = firstCall ? (opts.coldStartSlackMs ?? 3000) : 0;
    firstCall = false;

    while (true) {
      try {
        const budget = (opts.timeoutMs ?? 7000) + coldSlack;
        const out = await attemptOnce(bridge, budget);

        // Allow empty arrays, false, 0, empty strings - only block null/undefined
        if (out === undefined) {
          throw new Error(`invokeSafe("${cmd}") returned undefined`);
        }
        if (out === null && !opts.allowNull) {
          throw new Error(`invokeSafe("${cmd}") returned null`);
        }
        return out;
      } catch (err: any) {
        const msg = String(err?.message || err);
        const transient =
          msg.includes("Couldn't find callback id") || // ghost callback after HMR
          msg.includes('callback id') ||
          msg.includes('timeout') ||
          err?.code === 'TIMEOUT';

        console.warn('[invokeSafe] attempt failed', {
          cmd, retriesLeft: retries, source: (await waitTauriReady()).source, msg
        });

        if (retries > 0 && transient && !unloading) {
          retries--;
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }
        if (opts.strict) throw err;
        return undefined;
      }
    }
  };

  return opts.key ? singleFlight<T>(opts.key, exec) : exec();
}
