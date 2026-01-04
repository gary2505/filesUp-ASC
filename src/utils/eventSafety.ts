/**
 * This is src/lib/utils/eventSafety.ts
 * Used by: internal use only
 * Purpose: Provides safe wrappers for event methods to prevent errors with fake events
 * Trigger: Called when handling events that might not have standard methods
 * Event Flow: Checks if method exists before calling
 * List of functions: safeStopPropagation, safePreventDefault, safeStopImmediatePropagation
 */

/**
 * Safe Event Utilities
 * 
 * Runtime-safe wrappers for event methods to prevent
 * "X is not a function" errors when dealing with
 * CustomEvents or manually constructed event objects.
 * 
 * Created: October 16, 2025
 * See: README/ErrorPrevention_EventSafety.md
 */

/**
 * Safely stop event propagation if the method exists
 * 
 * @example
 * ```typescript
 * function handleEvent(event: CustomEvent) {
 *   safeStopPropagation(event); // Won't crash if event is fake
 * }
 * ```
 */
export function safeStopPropagation(event: any): void {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
}

/**
 * Safely prevent default if the method exists
 * 
 * @example
 * ```typescript
 * function handleClick(event: MouseEvent) {
 *   safePreventDefault(event);
 * }
 * ```
 */
export function safePreventDefault(event: any): void {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
}

/**
 * Safely stop immediate propagation if the method exists
 */
export function safeStopImmediatePropagation(event: any): void {
  if (event && typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
}

/**
 * Check if an object is a real Event or CustomEvent
 * 
 * @example
 * ```typescript
 * if (isRealEvent(obj)) {
 *   obj.stopPropagation(); // TypeScript knows this is safe
 * }
 * ```
 */
export function isRealEvent(obj: any): obj is Event | CustomEvent<any> {
  return obj instanceof Event || obj instanceof CustomEvent;
}

/**
 * Create a real CustomEvent with proper methods
 * 
 * Use this instead of casting plain objects to CustomEvent
 * 
 * @example
 * ```typescript
 * // ❌ BAD
 * const event = { detail: data } as CustomEvent;
 * 
 * // ✅ GOOD
 * const event = createSafeCustomEvent('toggle', data);
 * ```
 */
export function createSafeCustomEvent<T>(
  type: string,
  detail: T,
  options?: CustomEventInit
): CustomEvent<T> {
  return new CustomEvent(type, {
    detail,
    bubbles: options?.bubbles ?? true,
    cancelable: options?.cancelable ?? true,
    composed: options?.composed ?? false
  });
}

/**
 * Combined safe call: preventDefault + stopPropagation
 * 
 * Common pattern in many event handlers
 */
export function safeConsumeEvent(event: any): void {
  safePreventDefault(event);
  safeStopPropagation(event);
}

