/**
 * src/lib/core/detectors/doubleWrite.ts
 * Used by: storeInstrumentation.ts
 * Purpose: Detects redundant store writes (no-op updates where new value equals old value) - identifies performance issues from unnecessary reactivity triggers
 * Trigger: detectDoubleWrite() called after store.set(); detectDoubleWriteWithDiff() for explicit old/new comparison
 * Event Flow: Store update → hash new value → compare with stored hash for key → if match increment counter → throttle warnings (500ms) → log with count
 * Functions: detectDoubleWrite(store, field, value), detectDoubleWriteWithDiff(store, field, oldValue, newValue), clearStoredValues(), cleanupOldEntries()
 * Status: Dev-only; active in panelStates instrumentation; throttled warnings prevent log spam; simple hash uses JSON.stringify for objects
 */
import { createDebugLogger } from '$lib/core/logging/unified-logger';

const logger = createDebugLogger('DoubleWrite');

type Key = string; // store.field
const lastHashes = new Map<Key, number>();
const counters = new Map<Key, { n: number; lastTs: number }>();
const SUPPRESS_MS = 500; // collapse repeated warnings per key
const enabled = import.meta.env.DEV; // Only track in development

// Simple hash function for value comparison
function simpleHash(value: unknown): number {
  const str = typeof value === 'object' && value !== null 
    ? JSON.stringify(value) 
    : String(value);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function warnThrottled(key: Key, payload: Record<string, unknown>, msg: string) {
  const now = performance.now();
  const c = counters.get(key) ?? { n: 0, lastTs: 0 };
  c.n++;
  if (now - c.lastTs > SUPPRESS_MS) {
    logger.warn('overhead', 'doubleWrite', `${msg} (count: ${c.n})`, {
      key,
      count: c.n,
      ...payload
    });
    c.lastTs = now;
    c.n = 1; // Reset to 1 (this warning), not 0
  }
  counters.set(key, c);
}

export function detectDoubleWrite(store: string, field: string, value: unknown) {
  if (!enabled) return;

  const key = `${store}.${field}`;
  const h = simpleHash(value);

  const prev = lastHashes.get(key);
  if (prev === h) {
    warnThrottled(key, { store, field }, `no-op write: ${key}`);
  }
  lastHashes.set(key, h);
}

// Clear stored values for testing/cleanup
export function clearStoredValues() {
  lastHashes.clear();
  counters.clear();
}

// Periodic cleanup to prevent memory leaks (call occasionally)
export function cleanupOldEntries() {
  const now = performance.now();
  const CLEANUP_AGE = 60000; // Remove entries older than 1 minute
  
  for (const [key, counter] of counters.entries()) {
    if (now - counter.lastTs > CLEANUP_AGE) {
      counters.delete(key);
      lastHashes.delete(key);
    }
  }
}

// Helper for complex object comparison
export function detectDoubleWriteWithDiff(
  store: string,
  field: string,
  oldValue: unknown,
  newValue: unknown
) {
  if (!enabled) return;

  const a = JSON.stringify(oldValue);
  const b = JSON.stringify(newValue);
  if (a === b) {
    warnThrottled(`${store}.${field}`, { store, field }, `no-op write (old === new): ${store}.${field}`);
  }
}