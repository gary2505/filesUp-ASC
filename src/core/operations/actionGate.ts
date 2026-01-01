/**
 * src/lib/debug/detectors/actionGate.ts
 * Used by: click-controller.ts, expandController.ts, MyPCPanel.svelte, storeInstrumentation.ts
 * Purpose: Prevents rapid-fire action spam and deduplicates inflight async operations - blocks clicks faster than adaptive threshold, ensures only one expand per path runs at a time, provides epoch-based cancellation for stale requests
 * Trigger: forbidRapidRepeat() called before click handlers; singleFlight() wraps async expand operations; epochGuard() in controllers with cancellable workflows
 * Event Flow: Action attempt → check timer/inflight map → if too soon/duplicate return false/existing promise → otherwise execute and track → cleanup on completion
 * Functions: forbidRapidRepeat(key, minMs=adaptive), singleFlight(key, fn), epochGuard().next/isCurrent, resetActionGate(key?), adaptiveClickDelay
 * Status: Core debounce utility; prevents double-clicks and concurrent expand operations; always active
 */

const timers = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Adaptive double-click timing - learns from user's click speed.
 * Tracks last N double-click intervals and uses percentile-based threshold.
 * Persists to localStorage so timing adapts across sessions.
 */
class AdaptiveClickTiming {
  private intervals: number[] = [];
  private lastClickTime = 0;
  private readonly maxSamples = 10;
  private readonly defaultDelay = 250; // ms - Windows default
  private readonly minDelay = 150;     // ms - fastest reasonable
  private readonly maxDelay = 400;     // ms - slowest reasonable
  private readonly storageKey = 'filesup-click-timing';
  
  constructor() {
    this.load();
  }
  
  /** Load saved timing data from localStorage */
  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.intervals)) {
          this.intervals = data.intervals.slice(0, this.maxSamples);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  /** Save timing data to localStorage */
  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        intervals: this.intervals,
        delay: this.getDelay()
      }));
    } catch {
      // Ignore storage errors
    }
  }
  
  /** Record a double-click event to learn user's timing */
  recordDoubleClick(): void {
    const now = Date.now();
    if (this.lastClickTime > 0) {
      const interval = now - this.lastClickTime;
      // Only learn from reasonable intervals (50-500ms between clicks of a dblclick)
      if (interval >= 50 && interval <= 500) {
        this.intervals.push(interval);
        if (this.intervals.length > this.maxSamples) {
          this.intervals.shift();
        }
        this.save();
      }
    }
    this.lastClickTime = now;
  }
  
  /** Record first click of potential double-click */
  recordFirstClick(): void {
    this.lastClickTime = Date.now();
  }
  
  /** Get adaptive delay for single-click disambiguation */
  getDelay(): number {
    if (this.intervals.length < 3) {
      return this.defaultDelay;
    }
    
    // Use 90th percentile of recorded intervals + buffer
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const p90Index = Math.floor(sorted.length * 0.9);
    const p90 = sorted[p90Index] || sorted[sorted.length - 1];
    
    // Add 20% buffer for safety
    const adaptive = Math.round(p90 * 1.2);
    
    return Math.min(this.maxDelay, Math.max(this.minDelay, adaptive));
  }
  
  /** Get minimum rapid-repeat threshold (faster users get lower threshold) */
  getRapidThreshold(): number {
    const delay = this.getDelay();
    // Rapid threshold is ~40% of click delay
    return Math.max(80, Math.round(delay * 0.4));
  }
  
  /** Get stats for debugging */
  getStats(): { intervals: number[]; delay: number; threshold: number; samples: number } {
    return {
      intervals: [...this.intervals],
      delay: this.getDelay(),
      threshold: this.getRapidThreshold(),
      samples: this.intervals.length
    };
  }
}

export const adaptiveClickTiming = new AdaptiveClickTiming();

/** Drop clicks that repeat faster than minMs (adaptive by default). */
export function forbidRapidRepeat(key: string, minMs?: number): boolean {
  const threshold = minMs ?? adaptiveClickTiming.getRapidThreshold();
  const now = Date.now();
  const last = timers.get(key) ?? 0;
  if (now - last < threshold) return false;
  timers.set(key, now);
  return true;
}

/** Ensure only one async action per key runs at a time; subsequent calls get the same promise. */
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn()
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Epoch guard: only accept results for the latest epoch. */
export function epochGuard() {
  let epoch = 0;
  return {
    next() { return ++epoch; },
    isCurrent(e: number) { return e === epoch; }
  };
}

export function resetActionGate(key?: string) {
  if (key) { timers.delete(key); return; }
  timers.clear();
}