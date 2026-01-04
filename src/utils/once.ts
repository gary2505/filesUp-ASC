/**
 * This is src/lib/utils/once.ts
 * Used by: src/lib/keyboard/panel-focus-manager.ts
 * Purpose: Ensures a function is called only once
 * Trigger: Wraps function to make it idempotent
 * Event Flow: First call executes, subsequent calls return cached result
 * List of functions: once
 */

// src/lib/utils/once.ts
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let done = false; 
  let val: any;
  return ((...args: any[]) => {
    if (done) return val;
    val = fn(...args);
    done = true;
    return val;
  }) as T;
}