/**
 * Stable logging utilities that preserve object structure
 * even after hot reloads and prevent console collapse.
 */

/**
 * Create a stable snapshot of an object for logging.
 * Handles BigInt and circular references safely.
 */
export const stable = (o: unknown): unknown => {
  try {
    return JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)));
  } catch {
    // Fallback for circular references or other issues
    return o;
  }
};

/**
 * Debug log with stable object representation.
 * Use this instead of console.debug to ensure objects
 * remain expanded even after hot reloads.
 */
export const dlog = (msg: string, o?: unknown): void => {
  try {
    console.debug(msg, o ? stable(o) : '');
  } catch {
    // Fallback to regular logging
    console.debug(msg, o);
  }
};

/**
 * Info log with stable object representation.
 */
export const ilog = (msg: string, o?: unknown): void => {
  try {
    console.info(msg, o ? stable(o) : '');
  } catch {
    console.info(msg, o);
  }
};

/**
 * Warning log with stable object representation.
 */
export const wlog = (msg: string, o?: unknown): void => {
  try {
    console.warn(msg, o ? stable(o) : '');
  } catch {
    console.warn(msg, o);
  }
};

/**
 * Error log with stable object representation.
 */
export const elog = (msg: string, o?: unknown): void => {
  try {
    console.error(msg, o ? stable(o) : '');
  } catch {
    console.error(msg, o);
  }
};
