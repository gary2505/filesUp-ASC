// src/lib/core/logging/logService.ts
import { writable, type Readable } from 'svelte/store';
import { logEx } from '$lib/core/logging/logger-tauri';

export type LogLevel =
  | 'off'
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'critical'
  | 'fatal';

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  scope: string; // e.g. "core.ops" or "ui.folderProps"
  message: string;
  details?: unknown;
}

export interface LogConfig {
  level: LogLevel;
  maxEntries: number;
  telemetryEnabled: boolean;
}

// Level ordering for gating
const LEVEL_ORDER: Record<LogLevel, number> = {
  off: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  critical: 6,
  fatal: 7,
};

const LEVEL_TABLE: LogLevel[] = [
  'off',      // 0
  'trace',    // 1
  'debug',    // 2
  'info',     // 3
  'warn',     // 4
  'error',    // 5
  'critical', // 6
  'fatal',    // 7
];

/**
 * Map systemDebugLevel (0-7) to LogLevel string
 */
export function systemDebugLevelToLogLevel(value: number | undefined): LogLevel {
  if (value == null) return 'info';
  return LEVEL_TABLE[value] ?? 'info';
}

// --- internal state ---

let nextId = 1;

let config: LogConfig = {
  level: 'info',
  maxEntries: 2000,
  telemetryEnabled: true,
};

const internal = writable<LogEntry[]>([]);

export const logStore: Readable<LogEntry[]> = {
  subscribe: internal.subscribe,
};

// --- helpers ---

function levelEnabled(globalLevel: LogLevel, candidate: LogLevel): boolean {
  if (globalLevel === 'off') return false;
  return LEVEL_ORDER[candidate] >= LEVEL_ORDER[globalLevel];
}

function pushEntry(entry: Omit<LogEntry, 'id'>): void {
  internal.update((current) => {
    const id = nextId++;
    const full: LogEntry = { id, ...entry };

    const updated =
      current.length >= config.maxEntries
        ? [...current.slice(current.length - config.maxEntries + 1), full]
        : [...current, full];

    return updated;
  });
}

async function sendToTauriIfNeeded(
  level: LogLevel,
  scope: string,
  message: string,
  details?: unknown
): Promise<void> {
  if (!config.telemetryEnabled) return;

  const severity = LEVEL_ORDER[level];
  if (severity < LEVEL_ORDER.error) return; // only error+

  try {
    const payload = {
      ts: Date.now(),
      level,
      scope,
      message,
      details,
    };
    // Fire-and-forget
    void logEx(JSON.stringify(payload), 'exception');
  } catch (err) {
    // Don't throw from logging
    // eslint-disable-next-line no-console
    console.error('[logService] Failed to send to Tauri log:', err);
  }
}

// --- public API ---

export const log = {
  /**
   * Update logging configuration (called by settings store)
   */
  configure(next: Partial<LogConfig>): void {
    if (next.level !== undefined) config.level = next.level;
    if (next.maxEntries !== undefined) config.maxEntries = next.maxEntries;
    if (next.telemetryEnabled !== undefined) {
      config.telemetryEnabled = next.telemetryEnabled;
    }
    
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[logService] config updated', config);
    }
  },

  getConfig(): LogConfig {
    return { ...config };
  },

  log(level: LogLevel, scope: string, message: string, details?: unknown): void {
    if (!levelEnabled(config.level, level)) return;

    const ts = Date.now();

    // Console output for dev tools
    const prefix = `[${new Date(ts).toISOString()}][${level}][${scope}]`;
    if (details !== undefined) {
      // eslint-disable-next-line no-console
      console.log(prefix, message, details);
    } else {
      // eslint-disable-next-line no-console
      console.log(prefix, message);
    }

    // Store for LogViewer
    pushEntry({ ts, level, scope, message, details });

    // Optional Tauri/telemetry for errors+
    void sendToTauriIfNeeded(level, scope, message, details);
  },

  trace(scope: string, message: string, details?: unknown): void {
    this.log('trace', scope, message, details);
  },
  debug(scope: string, message: string, details?: unknown): void {
    this.log('debug', scope, message, details);
  },
  info(scope: string, message: string, details?: unknown): void {
    this.log('info', scope, message, details);
  },
  warn(scope: string, message: string, details?: unknown): void {
    this.log('warn', scope, message, details);
  },
  error(scope: string, message: string, details?: unknown): void {
    this.log('error', scope, message, details);
  },
  critical(scope: string, message: string, details?: unknown): void {
    this.log('critical', scope, message, details);
  },
  fatal(scope: string, message: string, details?: unknown): void {
    this.log('fatal', scope, message, details);
  },

  clear(): void {
    internal.set([]);
  },
};
