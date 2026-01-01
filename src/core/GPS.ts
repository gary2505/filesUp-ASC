// src/lib/core/GPS.ts
// Global Processing Service - Orchestrates all async operations with sliding-window timeouts & cancellation

export type Panel = 'P1' | 'P2' | 'P3' | 'GLOBAL';

export type ProcessType =
  | 'tauri-invoke'
  | 'folder-load'
  | 'folder-scan'      // folder size / properties scan
  | 'thumbnail'
  | 'icons'
  | 'sort'
  | 'group'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'delete'
  | 'rename'
  | 'compress'
  | 'watcher'
  | 'other';

export type CancelReason = 'manual' | 'timeout';

export interface ProcessInfo {
  opId: string;
  type: ProcessType;
  panel: Panel;
  startTime: number;

  // Sliding window: last moment we saw "sign of life"
  lastActivity: number;

  // Optional label for last event (eg. 'progress', 'phase:preparing', 'phase:deleting')
  lastEventLabel?: string;

  // Current timeout window in ms (from *lastActivity*, not from startTime)
  timeoutMs?: number;

  // Final state
  ended?: number;
  canceled?: boolean;
  cancelReason?: CancelReason;
  paused?: boolean;
}

type CancelListener = (reason: CancelReason, info: ProcessInfo) => void;

interface StartOptions {
  opId: string;
  type: ProcessType;
  panel: Panel;
  timeoutMs?: number;
}

/**
 * GPS = Global Processing Service
 * - Tracks all long-running operations (copy, delete, folder-scan, thumbnails, etc.)
 * - Uses sliding window timeouts: every progress event extends the window
 * - Emits cancellation callbacks on manual cancel or timeout
 */
export class GPS {
  private processes = new Map<string, ProcessInfo>();
  private cancelListeners = new Map<string, Set<CancelListener>>();
  private timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Register a new process in GPS.
   * - opId MUST be unique (usually generated in Rust or TS before invoke)
   * - timeoutMs is the sliding window size (ms)
   */
  startProcess(opId: string, type: ProcessType, panel: Panel, timeoutMs?: number): void;
  startProcess(opts: StartOptions): void;
  startProcess(
    arg1: string | StartOptions,
    type?: ProcessType,
    panel?: Panel,
    timeoutMs?: number
  ): void {
    const startTime = Date.now();

    const op: StartOptions =
      typeof arg1 === 'string'
        ? { opId: arg1, type: type!, panel: panel!, timeoutMs }
        : arg1;

    const info: ProcessInfo = {
      opId: op.opId,
      type: op.type,
      panel: op.panel,
      startTime,
      lastActivity: startTime,
      timeoutMs: op.timeoutMs,
    };

    this.processes.set(op.opId, info);

    if (info.timeoutMs && info.timeoutMs > 0) {
      this.installTimeout(op.opId, info.timeoutMs);
    }
  }

  /**
   * Mark process as completed (successfully or with error, but not timeout).
   * This removes it from GPS and clears timers.
   */
  endProcess(opId: string): void {
    const info = this.processes.get(opId);
    if (!info) return;

    info.ended = Date.now();

    this.clearTimeout(opId);
    this.cancelListeners.delete(opId);
    this.processes.delete(opId);
  }

  /**
   * SLIDING WINDOW CORE:
   * touchProcess = "we saw life from this op"
   *
   * - updates lastActivity
   * - optionally updates timeoutMs
   * - resets timeout timer = sliding window
   *
   * Call this on every meaningful progress event.
   */
  touchProcess(opId: string, timeoutMs?: number, eventLabel?: string): void {
    const info = this.processes.get(opId);
    if (!info) return;

    const now = Date.now();
    info.lastActivity = now;

    if (timeoutMs !== undefined) {
      info.timeoutMs = timeoutMs;
    }

    if (eventLabel) {
      info.lastEventLabel = eventLabel;
    }

    if (info.timeoutMs && info.timeoutMs > 0) {
      this.installTimeout(opId, info.timeoutMs);
    } else {
      this.clearTimeout(opId);
    }
  }

  /**
   * Backwards-compatible API: setProcessTimeout still exists, but now it:
   * - updates timeoutMs
   * - behaves like touchProcess (sliding window)
   */
  setProcessTimeout(opId: string, timeoutMs?: number): void {
    this.touchProcess(opId, timeoutMs);
  }

  /**
   * Subscribe to cancellation of a process:
   * - reason: 'manual' or 'timeout'
   * - info: snapshot of ProcessInfo at the moment of cancellation
   *
   * IMPORTANT:
   * - callbacks may be called from timeout timer
   * - must be fast and non-throwing
   */
  onCancel(opId: string, fn: CancelListener): () => void {
    let set = this.cancelListeners.get(opId);
    if (!set) {
      set = new Set();
      this.cancelListeners.set(opId, set);
    }
    set.add(fn);
    return () => {
      const s = this.cancelListeners.get(opId);
      s?.delete(fn);
    };
  }

  /**
   * Manual cancel from UI or higher-level logic.
   * - Marks process as cancelled
   * - Invokes cancel listeners with reason 'manual'
   * - Removes process from GPS
   */
  cancelProcess(opId: string): void {
    this.internalCancel(opId, 'manual');
  }

  /**
   * Internal cancel used by timeout handler.
   */
  private internalCancel(opId: string, reason: CancelReason): void {
    const info = this.processes.get(opId);
    if (!info) return;

    info.canceled = true;
    info.cancelReason = reason;
    info.ended = Date.now();

    const listeners = this.cancelListeners.get(opId);
    if (listeners && listeners.size > 0) {
      // Copy to array to avoid mutation during iteration
      const snapshot = Array.from(listeners);
      for (const fn of snapshot) {
        try {
          fn(reason, { ...info });
        } catch {
          // swallow listener errors: GPS must never throw
        }
      }
    }

    this.clearTimeout(opId);
    this.cancelListeners.delete(opId);
    this.processes.delete(opId);
  }

  /**
   * Pause/resume flags for consumers that care (UI, analytics).
   * GPS itself does not change timeout behavior here — you decide how to use it.
   */
  pauseProcess(opId: string): void {
    const info = this.processes.get(opId);
    if (info) {
      info.paused = true;
    }
  }

  resumeProcess(opId: string): void {
    const info = this.processes.get(opId);
    if (info) {
      info.paused = false;
    }
  }

  /**
   * Query helpers
   */
  isProcessActive(opId: string): boolean {
    return this.processes.has(opId);
  }

  getProcess(opId: string): ProcessInfo | undefined {
    const info = this.processes.get(opId);
    return info ? { ...info } : undefined;
  }

  getActiveProcesses(panel?: Panel): ProcessInfo[] {
    const out: ProcessInfo[] = [];
    for (const p of this.processes.values()) {
      if (!panel || p.panel === panel) {
        out.push({ ...p });
      }
    }
    return out.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * INTERNAL: install sliding-window timer.
   * Every time touchProcess is called, we:
   * - clear previous timer
   * - install new timer
   *
   * If timer fires → we treat as timeout cancellation.
   */
  private installTimeout(opId: string, timeoutMs: number): void {
    this.clearTimeout(opId);

    const timer = setTimeout(() => {
      // If still active and lastActivity is older than timeoutMs → timeout
      const info = this.processes.get(opId);
      if (!info) return;

      const age = Date.now() - info.lastActivity;
      if (age >= (info.timeoutMs ?? timeoutMs)) {
        this.internalCancel(opId, 'timeout');
      } else {
        // Edge case: race condition where activity happened right before timer fired.
        // Re-arm timer instead of cancelling.
        const remaining = (info.timeoutMs ?? timeoutMs) - age;
        if (remaining > 0) {
          this.installTimeout(opId, remaining);
        }
      }
    }, timeoutMs);

    this.timeoutTimers.set(opId, timer);
  }

  private clearTimeout(opId: string): void {
    const t = this.timeoutTimers.get(opId);
    if (t) {
      clearTimeout(t);
      this.timeoutTimers.delete(opId);
    }
  }
}

// Global singleton instance
export const gps = new GPS();
