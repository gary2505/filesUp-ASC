/**
 * This is src/lib/utils/tauriReady.ts
 * Used by: startupOrchestrator.ts, settings-io.ts, platform.ts, invokeSafe.ts, systemMetrics.ts
 * Purpose: Unified bridge waiter for Tauri v2 with legacy fallbacks
 * Trigger: Called when Tauri invoke is needed
 * Event Flow: Waits for bridge availability with timeout and fallbacks
 * List of functions: waitTauriReady, Bridge type
 */

// tauriReady.ts — unified bridge waiter for Tauri v2 (with legacy fallbacks)

export type Bridge = {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  source: 'core-import' | 'window-core' | 'window-legacy' | 'internals';
};

let readyPromise: Promise<Bridge> | null = null;

async function domReady() {
  if (typeof window === 'undefined') return;
  if (document.readyState === 'loading') {
    await new Promise<void>(res =>
      document.addEventListener('DOMContentLoaded', () => res(), { once: true })
    );
  }
}

async function tryCoreImport(): Promise<Bridge | null> {
  try {
    // Prefer official v2 entry
    const core = await import(/* @vite-ignore */ '@tauri-apps/api/core');
    if (typeof core?.invoke === 'function') {
      console.debug('[tauriReady] ✅ core-import OK');
      return { invoke: core.invoke, source: 'core-import' };
    }
  } catch (_) {}
  return null;
}

function tryWindow(): Bridge | null {
  const w: any = globalThis;

  if (typeof w?.__TAURI__?.core?.invoke === 'function') {
    console.debug('[tauriReady] ✅ window-core OK');
    return { invoke: w.__TAURI__.core.invoke, source: 'window-core' };
  }
  if (typeof w?.__TAURI__?.tauri?.invoke === 'function') {
    console.debug('[tauriReady] ✅ window-legacy OK');
    return { invoke: w.__TAURI__.tauri.invoke, source: 'window-legacy' };
  }
  if (typeof w?.__TAURI_INTERNALS__?.invoke === 'function') {
    console.debug('[tauriReady] ✅ internals OK');
    return { invoke: w.__TAURI_INTERNALS__.invoke, source: 'internals' };
  }
  return null;
}

export function waitTauriReady(deadlineMs = 6000): Promise<Bridge> {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    if (typeof window === 'undefined') throw new Error('Tauri bridge not available in SSR');

    await domReady();

    const start = Date.now();
    let delay = 25;

    while (Date.now() - start < deadlineMs) {
      // Prefer window (instant) before import (costly) to minimize churn after HMR
      const win = tryWindow();
      if (win) return win;

      const imp = await tryCoreImport();
      if (imp) return imp;

      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(200, Math.floor(delay * 1.6));
    }

    const w: any = globalThis;
    console.error('[tauriReady] 🔥 Bridge timeout', {
      elapsed: Date.now() - start,
      windowKeys: Object.keys(w ?? {}),
      hasTauri: !!w?.__TAURI__,
      hasInternals: !!w?.__TAURI_INTERNALS__,
    });
    throw new Error(`Tauri bridge timeout after ${deadlineMs}ms — invoke not available`);
  })();

  // HMR: reset waiter
  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      readyPromise = null;
    });
  }

  return readyPromise;
}