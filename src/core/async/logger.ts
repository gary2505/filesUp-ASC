// Simple leveled logger that prefixes with subsystem
// Only shows debug/info in dev mode to reduce noise
export function createLogger(scope: string) {
  const isDev = import.meta.env.DEV;
  return {
    debug: (...args: any[]) => isDev && console.debug(`[${scope}]`, ...args),
    info:  (...args: any[]) => isDev && console.info(`[${scope}]`, ...args),
    warn:  (...args: any[]) => console.warn(`[${scope}]`, ...args),
    error: (...args: any[]) => console.error(`[${scope}]`, ...args),
  };
}

// Dedicated logger for request system
export const requestLogger = createLogger('Request');

/** 
 * Log request errors appropriately - treat AbortError as info, not error 
 */
export function logRequestError(ctx: string, err: unknown) {
  // Normalize DOMException / AbortError
  const name = (err as any)?.name || '';
  const message = (err as any)?.message || String(err);

  // Expected aborts during component lifecycle - don't log as errors
  if (
    name === 'AbortError' || 
    message.includes('Request aborted') || 
    message.includes('signal is aborted') ||
    message.includes('unmount') ||           // Component unmounting (HMR or navigation)
    message.includes('superseded')           // Request replaced by newer one
  ) {
    // Silent in production, info in dev if log config allows
    if (import.meta.env.DEV && Math.random() < 0.05) {
      console.info(`[Request] 🔚 [${ctx}] Aborted: ${message}`);
    }
    return;
  }
  
  // Real errors - always log
  console.error(`[Request] ❌ [${ctx}]`, err);
}
