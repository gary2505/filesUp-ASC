/**
 * LEGACY COMPATIBILITY - Re-exports for old imports
 * 
 * This file provides backward compatibility for code still using:
 *   import { createComponentLogger } from '$lib/core/logging/log-levels';
 * 
 * New code should import directly from unified-logger:
 *   import { createDebugLogger } from '$lib/core/logging/unified-logger';
 */

// Re-export legacy compatibility functions from unified logger
export { createComponentLogger, createConditionalLogger, createDebugLogger } from './unified-logger';
