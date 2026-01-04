/**
 * This is src/lib/utils/abort.ts
 * Used by: not used
 * Purpose: AbortSignal utilities for cancellation handling
 * Trigger: Called to create abort signals for async operations
 * Event Flow: Creates controllers and signals for aborting operations
 * List of functions: anySignal, timeoutSignal, clearTimeoutSignal
 */

export function anySignal(signals: (AbortSignal | null | undefined)[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  
  for (const s of signals) {
    if (!s) continue;
    if (s.aborted) return AbortSignal.abort();
    s.addEventListener('abort', onAbort, { once: true });
  }
  
  return controller.signal;
}

/** Create a timeout signal. */
export function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort(new DOMException('Timeout', 'AbortError'));
  }, ms);
  
  // Store timeout ID for potential clearing
  (controller as any)._timeoutId = id;
  return controller.signal;
}

/** Clear a timeout signal if it hasn't fired yet */
export function clearTimeoutSignal(signal: AbortSignal) {
  const id = (signal as any)._timeoutId;
  if (id) {
    clearTimeout(id);
  }
}