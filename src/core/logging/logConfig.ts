/**
 * Logging configuration for request lifecycle and other modules
 * Controls which types of log messages are enabled
 */

export const LOG_CONFIG = {
  requests: {
    start: false,      // Log when requests start
    success: false,    // Log successful completions
    abort: false,      // Log aborted requests
    error: true,       // Log errors (keep enabled for debugging)
  },
  // Add other log categories as needed
  performance: {
    enabled: false,
  },
  debug: {
    enabled: false,
  }
};

export type LogConfig = typeof LOG_CONFIG;
