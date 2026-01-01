/**
 * src/lib/debug/detectors/raceOps.ts
 * Used by: key-controller.ts, click-controller.ts, expandUtils.ts, storeInstrumentation.ts
 * Trigger: runExclusive() called before async operations like expand/collapse/delete/navigation that must not overlap per resource
 * Event Flow: Operation start → get previous chain promise → create new gate promise → wait for previous to finish → mark active → execute fn → mark inactive → release gate → cleanup if last in chain
 * Functions: runExclusive(key, scope, action, fn), isOperationActive(key), getActiveOperations(), clearOperationState()
 * Status: FIFO mutex - ensures operations on same resource serialize (e.g., two expands on 'C:\Folder' run sequentially not concurrently); always active
 */

import { logger } from '$lib/core/logging/unified-logger';

const chains = new Map<string, Promise<void>>();
const active = new Set<string>();
const enabled = import.meta.env.DEV; // Only warn in development

export async function runExclusive<T>(key: string, scope: string, action: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();

  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));

  // next chain links after previous
  chains.set(key, prev.finally(() => gate).catch(() => gate));

  if (active.has(key) && enabled) {
    logger.warn({ scope: 'overhead', action: 'raceCondition' }, `overlapping operation detected: serializing: ${key}`, { key });
  }

  // Wait your turn
  await prev.catch(() => { /* ignore */ });

  active.add(key);
  try {
    return await fn();
  } finally {
    active.delete(key);
    release();
    // cleanup if no one chained after us
    if (chains.get(key) === gate) chains.delete(key);
  }
}

export function isOperationActive(key: string) { return active.has(key); }
export function getActiveOperations(): string[] { return Array.from(active); }
export function clearOperationState() { chains.clear(); active.clear(); }