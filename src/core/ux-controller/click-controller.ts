/**
 * Unified click controller for Svelte/DOM components.
 *click-controller debounces single clicks, 
 cancels outdated ones, protects against spam, 
 and guarantees that only the final valid click
  action runs — giving clean,
  race-free single/double-click behavior
 * Features:
 * - Single vs Double disambiguation (single is delayed, canceled if double occurs)
 * - Mutex flag to avoid re-entrancy (no concurrent runs)
 * - "Last-only" behavior: new action cancels the previous via AbortController
 * - Pure TS, no external deps
 */

import { createDebugLogger } from '$lib/core';
import { forbidRapidRepeat, adaptiveClickTiming } from '$lib/core/operations/actionGate';
import { runExclusive } from '$lib/core/operations/raceOps';

const debug = createDebugLogger('ClickController');

export type ClickKind = "single" | "double";

export type ClickHandlers = {
  onSingle: (ev: MouseEvent, ctx: { signal: AbortSignal }) => void | Promise<void>;
  onDouble: (ev: MouseEvent, ctx: { signal: AbortSignal }) => void | Promise<void>;
};

export type ClickControllerOptions = {
  /** Delay before firing single-click (ms). If not set, uses adaptive timing. */
  delayMs?: number;
};

export function createClickController(handlers: ClickHandlers, opts: ClickControllerOptions = {}) {
  // Use adaptive delay unless explicitly overridden
  const getDelayMs = () => opts.delayMs ?? adaptiveClickTiming.getDelay();

  let singleTimer: number | null = null;
  let busy = false;                                // simple mutex
  let currentAbort: AbortController | null = null; // cancels the currently running action
  let pending: { kind: ClickKind; ev: MouseEvent } | null = null; // store only the last pending action

  function abortCurrent() {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
    }
  }

  async function run(kind: ClickKind, ev: MouseEvent) {
    // consume pending (last-only behavior)
    pending = null;

    // cancel any previous action
    abortCurrent();
    currentAbort = new AbortController();
    const signal = currentAbort.signal;

    const target = ev.target as HTMLElement;
    const operation = `${kind}-click:${target.tagName}`;
    
    debug.debug('ui', 'clickExecution', `Executing ${kind} click`, { 
      target: target.tagName, 
      className: target.className 
    });
    
    busy = true;
    try {
      await runExclusive(operation, 'ui', kind, async () => {
        if (kind === "single") {
          await handlers.onSingle(ev, { signal });
        } else {
          await handlers.onDouble(ev, { signal });
        }
      });
      
      debug.debug('ui', 'clickComplete', `${kind} click completed`, { 
        target: target.tagName 
      });
    } finally {
      busy = false;
      currentAbort = null;

      // If something landed while we were busy, execute only the latest (pending)
      if (pending) {
        // Ensure previous is fully canceled (no-ops if null)
        abortCurrent();
        // Defer to next tick to avoid deep recursion
        setTimeout(() => {
          const next = pending!;
          pending = null;
          void run(next.kind, next.ev);
        }, 0);
      }
    }
  }

  const onClick = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement;
    const controllerKey = `click:${target.tagName}:${target.className}`;
    
    // Block rapid clicks (uses adaptive threshold)
    if (!forbidRapidRepeat(controllerKey)) {
      debug.warn('overhead', 'rapidClick', 'Click blocked - too rapid', { 
        target: target.tagName, 
        className: target.className 
      });
      return;
    }
    
    // Record first click for adaptive timing learning
    adaptiveClickTiming.recordFirstClick();
    
    const delayMs = getDelayMs();
    debug.debug('ui', 'click', 'Single click detected', { 
      target: target.tagName, 
      className: target.className,
      delayMs 
    });
    
    if (singleTimer != null) clearTimeout(singleTimer);
    singleTimer = window.setTimeout(() => {
      singleTimer = null;
      if (busy) {
        // push as last-only pending
        pending = { kind: "single", ev };
      } else {
        void run("single", ev);
      }
    }, delayMs);
  };

  const onDoubleClick = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement;
    
    // Record double-click timing for adaptive learning
    adaptiveClickTiming.recordDoubleClick();
    
    debug.debug('ui', 'doubleClick', 'Double click detected', { 
      target: target.tagName, 
      className: target.className,
      adaptiveDelay: adaptiveClickTiming.getDelay()
    });
    
    // Double-click wins: cancel any scheduled single
    if (singleTimer != null) {
      clearTimeout(singleTimer);
      singleTimer = null;
    }

    // Mark as last pending
    pending = { kind: "double", ev };

    // Cancel current work so double can run ASAP
    abortCurrent();

    if (!busy) {
      const p = pending;
      pending = null;
      if (p) void run(p.kind, p.ev);
    }
  };

  return { 
    onClick, 
    onDoubleClick,
    isBusy: () => busy
  };
}