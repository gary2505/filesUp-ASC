/**
 * Unified Logger System (FRONTEND API)
 *
 * - Feature code calls logger.* / createDebugLogger / traceOp
 * - This file formats context + message
 * - Actual log routing, level gating, telemetry, and storage
 *   are handled by $lib/core/logging/logService.ts
 */

import { log as coreLog, type LogLevel } from '$lib/core/logging/logService';
// appSettings is no longer read here; loggingBridge handles that.

// Log scopes for categorization
export type LogScope =
  | 'app'
  | 'ui'
  | 'store'
  | 'fs'
  | 'ipc'
  | 'perf'
  | 'selection'
  | 'tree'
  | 'tabs'
  | 'session'
  | 'startup'
  | 'clipboard'
  | 'overhead'
  | 'gps'
  | 'ops'
  | 'settings'
  | 'telemetry'
  | 'i18n'
  | 'window'
  | 'platform';

export type LogCtx = {
  scope: LogScope;
  component?: string;
  action?: string;
  opId?: string;
  panel?: 'P1' | 'P2' | 'P3' | 'P4';
  path?: string;
  key?: string;
  [k: string]: unknown;
};

// Simple ULID-like ID generator (no external dependency)
function generateOpId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

function getScopeEmoji(scope: LogScope): string {
  const emojis: Record<LogScope, string> = {
    app: '🎬',
    ui: '🖱️',
    store: '📦',
    fs: '📁',
    ipc: '🔌',
    perf: '⚡',
    selection: '🎯',
    tree: '🌳',
    tabs: '📋',
    session: '👤',
    startup: '🚀',
    clipboard: '📋',
    overhead: '⚠️',
    gps: '🛰️',
    ops: '⚙️',
    settings: '⚙️',
    telemetry: '📊',
    i18n: '🌐',
    window: '🪟',
    platform: '💻',
  };
  return emojis[scope] ?? '📝';
}

function formatMessage(ctx: LogCtx, msg: string): string {
  const emoji = getScopeEmoji(ctx.scope);
  const componentStr = ctx.component ? `[${ctx.component}]` : '';
  const actionStr = ctx.action ? ` ${ctx.action}` : '';
  const opIdStr = ctx.opId ? ` (${ctx.opId.slice(-6)})` : '';
  return `${emoji} ${componentStr}${actionStr} ${msg}${opIdStr}`.trim();
}

export const logger = {
  log(level: LogLevel, ctx: LogCtx, msg: string, details?: unknown) {
    const formatted = formatMessage(ctx, msg);

    // All gating + telemetry + storage handled inside coreLog.log
    // Don't duplicate msg in context (it's already in formatted message)
    const contextForLog = details ? { ...ctx, details } : ctx;
    coreLog.log(level, ctx.scope, formatted, contextForLog);
  },

  trace(ctx: LogCtx, msg: string, details?: unknown) {
    this.log('trace', ctx, msg, details);
  },
  debug(ctx: LogCtx, msg: string, details?: unknown) {
    this.log('debug', ctx, msg, details);
  },
  info(ctx: LogCtx, msg: string, details?: unknown) {
    this.log('info', ctx, msg, details);
  },
  warn(ctx: LogCtx, msg: string, details?: unknown) {
    this.log('warn', ctx, msg, details);
  },
  error(ctx: LogCtx, msg: string, details?: unknown) {
    this.log('error', ctx, msg, details);
  },
  critical(ctx: LogCtx, msg: string, details?: unknown) {
    this.log('critical', ctx, msg, details);
  },
  fatal(ctx: LogCtx, msg: string, details?: unknown) {
    this.log('fatal', ctx, msg, details);
  },
};

// Helper for traced operations
export function traceOp<T>(
  scope: LogScope,
  action: string,
  base: Partial<LogCtx>,
  fn: () => Promise<T> | T
): Promise<T> {
  const opId = base.opId ?? generateOpId();
  const start = performance.now();
  logger.debug({ scope, action, opId, ...base }, 'begin');

  try {
    const res = fn();
    return Promise.resolve(res)
      .then((value) => {
        const duration = Math.round(performance.now() - start);
        logger.debug(
          {
            scope,
            action,
            opId,
            ...base,
            durationMs: duration,
          },
          'ok'
        );
        return value;
      })
      .catch((error) => {
        const duration = Math.round(performance.now() - start);
        logger.warn(
          {
            scope,
            action,
            opId,
            ...base,
            err: String(error),
            durationMs: duration,
          },
          'fail'
        );
        throw error;
      });
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    logger.warn(
      {
        scope,
        action,
        opId,
        ...base,
        err: String(error),
        durationMs: duration,
      },
      'fail-sync'
    );
    throw error;
  }
}

// Component-specific logger factory (modern API)
export function createDebugLogger(componentName: string) {
  return {
    trace: (scope: LogScope, action: string, msg: string, extra?: Partial<LogCtx>) =>
      logger.trace({ scope, component: componentName, action, ...extra }, msg),
    debug: (scope: LogScope, action: string, msg: string, extra?: Partial<LogCtx>) =>
      logger.debug({ scope, component: componentName, action, ...extra }, msg),
    info: (scope: LogScope, action: string, msg: string, extra?: Partial<LogCtx>) =>
      logger.info({ scope, component: componentName, action, ...extra }, msg),
    warn: (scope: LogScope, action: string, msg: string, extra?: Partial<LogCtx>) =>
      logger.warn({ scope, component: componentName, action, ...extra }, msg),
    error: (scope: LogScope, action: string, msg: string, extra?: Partial<LogCtx>) =>
      logger.error({ scope, component: componentName, action, ...extra }, msg),

    // Traced operation helper
    traceOp: <T>(
      scope: LogScope,
      action: string,
      fn: () => Promise<T> | T,
      extra?: Partial<LogCtx>
    ) => traceOp(scope, action, { component: componentName, ...extra }, fn),
  };
}

// ============================================================================
// LEGACY COMPATIBILITY WRAPPERS (for migration period)
// ============================================================================

/**
 * @deprecated Use createDebugLogger(componentName) instead
 */
export function createComponentLogger(componentName: string) {
  const dbg = createDebugLogger(componentName);
  return {
    debug: (message: string, ...args: any[]) => {
      dbg.debug('ui', 'debug', message, args.length > 0 ? { args } : undefined);
    },
    info: (message: string, ...args: any[]) => {
      dbg.info('ui', 'info', message, args.length > 0 ? { args } : undefined);
    },
    warn: (message: string, ...args: any[]) => {
      dbg.warn('ui', 'warn', message, args.length > 0 ? { args } : undefined);
    },
    error: (message: string, ...args: any[]) => {
      dbg.error('ui', 'error', message, args.length > 0 ? { args } : undefined);
    },
  };
}

/**
 * @deprecated Legacy conditional logger - use createDebugLogger() instead
 */
export function createConditionalLogger(componentName: string) {
  return createComponentLogger(componentName);
}
