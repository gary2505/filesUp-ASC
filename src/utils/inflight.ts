/**
 * This is src/lib/utils/inflight.ts
 * Used by: not used
 * Purpose: Tracks concurrent promises for debugging race conditions and performance
 * Trigger: Would wrap promises via track() helper
 * Event Flow: track() increments counter, promise resolves → decrements, logs stats
 * List of functions: track, getInflight, getCallHistory, resetStats
 */

/**
 * ====================================================================
 * src/lib/dev/inflight.ts - Async Promise Tracking & Performance Monitor
 * ====================================================================
 * USED BY: not used
 * PURPOSE: Tracks concurrent promises for debugging race conditions, monitors async call
 *          performance, and provides visibility into pending operations during development.
 * TRIGGER: Wraps promises via `track()` helper; auto-logs stats every 15s in dev mode.
 * EVENT FLOW:
 *   1. `track(name, promise)` increments inflight counter and starts timing
 *   2. Promise resolves/rejects → logs duration, decrements counter
 *   3. Call history maintained (rolling 50-entry buffer)
 *   4. Stats accessible via `getInflight()`, `getCallHistory()`, `resetStats()`
 * FUNCTIONS:
 *   - track(name, promise): Wraps promise with timing & inflight tracking
 *   - getInflight(): Returns current/max inflight counts and total calls
 *   - getCallHistory(): Returns recent call entries with durations
 *   - resetStats(): Clears max/total counters and call history
 * ====================================================================
 */

// src/lib/dev/inflight.ts
let inflight = 0;
let maxInflight = 0;
let totalCalls = 0;

interface CallEntry {
  name: string;
  start: number;
  end?: number;
}

let callHistory: CallEntry[] = [];
const MAX_HISTORY = 50;

export async function track<T>(name: string, promise: Promise<T>): Promise<T> {
  inflight++;
  totalCalls++;
  maxInflight = Math.max(maxInflight, inflight);
  
  const start = performance.now();
  const callEntry: CallEntry = { name, start };
  callHistory.push(callEntry);
  
  // Keep history size manageable
  if (callHistory.length > MAX_HISTORY) {
    callHistory.shift();
  }
  
  console.debug(`[inflight] +1 (${inflight}) ${name}`);
  
  try {
    const result = await promise;
    callEntry.end = performance.now();
    console.debug(`[inflight] -1 (${inflight - 1}) ${name} (${Math.round(callEntry.end - start)}ms)`);
    return result;
  } catch (error) {
    callEntry.end = performance.now();
    console.debug(`[inflight] -1 (${inflight - 1}) ${name} (FAILED after ${Math.round(callEntry.end - start)}ms)`);
    throw error;
  } finally {
    inflight--;
  }
}

export function getInflight(): { 
  inflight: number; 
  maxInflight: number; 
  totalCalls: number 
} {
  return { inflight, maxInflight, totalCalls };
}

export function getCallHistory(): Array<{ name: string; start: number; end?: number; duration?: number }> {
  return callHistory.map(call => ({
    ...call,
    duration: call.end ? call.end - call.start : undefined
  }));
}

export function resetStats(): void {
  maxInflight = inflight; // Don't reset current inflight, just max
  totalCalls = 0;
  callHistory = [];
  console.info('[inflight] Stats reset');
}

// Development helpers
if (import.meta.env.DEV) {
  // Log stats periodically
  setInterval(() => {
    const stats = getInflight();
    if (stats.inflight > 0 || stats.maxInflight > 5) {
      console.debug('[inflight] Stats:', stats);
    }
  }, 15000);
}