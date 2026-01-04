/**
 * This is src/lib/utils/work-gate.ts
 * Used by: Tab1Layout.svelte
 * Purpose: Cancellable work scheduler for idle and frame work
 * Trigger: Called to schedule heavy computations without freezing UI
 * Event Flow: Schedules work in idle callbacks with abort mechanism
 * List of functions: WorkGate class with nextFrame, idleWork, cancelIdle, abortAll, signal
 */

/**
 * WorkGate - Cancellable work scheduler for idle + frame work
 * Prevents UI freeze by scheduling heavy work in idle callbacks
 * and providing abort mechanism for pointer interactions
 *
 * Usage:
 * const gate = new WorkGate();
 * gate.idleWork(() => heavyComputation(), 150);
 * gate.abortAll(); // on pointerdown
 */

export class WorkGate {
  private raf = 0;
  private idle = 0 as any; // requestIdleCallback handle
  private ab = new AbortController();

  /** Schedule light work next frame */
  nextFrame(fn: FrameRequestCallback) {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(fn);
  }

  /** Schedule heavier work when idle (with timeout) */
  idleWork(fn: () => void, timeout = 120) {
    this.cancelIdle();
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      this.idle = requestIdleCallback(
        () => { 
          if (!this.ab.signal.aborted) {
            fn();
          }
        },
        { timeout }
      );
    } else {
      // Fallback for environments without requestIdleCallback
      this.idle = setTimeout(() => {
        if (!this.ab.signal.aborted) {
          fn();
        }
      }, 16) as any; // ~1 frame delay
    }
  }

  /** Cancel pending idle work */
  cancelIdle() {
    if (this.idle) {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(this.idle);
      } else {
        clearTimeout(this.idle);
      }
      this.idle = 0;
    }
  }

  /** Abort all pending work (frame + idle) */
  abortAll() {
    this.cancelIdle();
    cancelAnimationFrame(this.raf);
    this.ab.abort();
    this.ab = new AbortController();
  }

  /** Get current abort signal for checking cancellation */
  get signal() { 
    return this.ab.signal; 
  }
}
