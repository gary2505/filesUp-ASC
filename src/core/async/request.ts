import { withTimeout } from './timeout';
import { retryWithBackoff } from './backoff';
import { anySignal } from './signals';
import { InflightGate } from './inflightGate';
import { defaultPolicy, opPolicies, retryPredicates, type OpPolicy } from './policies';
import { CanceledError, TimeoutError } from './errors';
import { requestLogger, logRequestError } from './logger';
import { LOG_CONFIG } from '$lib/core/logging/logConfig';

export type RunOpts = {
  opName: string;              // key to policies (e.g., 'fs.loadFolderContents')
  signal?: AbortSignal;        // caller can cancel
  latestGate?: InflightGate;   // optional stale-response guard
};

export class Request {
  constructor(private globalPolicy?: Partial<OpPolicy>) {}

  async run<T>(opts: RunOpts, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const { opName, signal, latestGate } = opts;
    const policy: OpPolicy = { 
      ...defaultPolicy, 
      ...this.globalPolicy, 
      ...(opPolicies[opName] || {}) 
    };

    // Only log start if enabled in config
    if (LOG_CONFIG.requests.start) {
      requestLogger.info(`▶️ [${opName}] Starting`, policy);
    }

    const guard = latestGate?.next();
    const ctl = new AbortController();
    const combined = signal ? anySignal([ctl.signal, signal]) : ctl.signal;

    try {
      const result = await retryWithBackoff(
        (s) => withTimeout(task, policy.timeoutMs, s),
        {
          retries: policy.retries,
          baseDelayMs: 300,
          maxDelayMs: 2000,
          jitter: policy.jitter,
          shouldRetry: policy.shouldRetryName
            ? retryPredicates[policy.shouldRetryName]
            : undefined,
        },
        combined
      );

      if (guard && !guard.isCurrent()) {
        requestLogger.warn(`⏭️ [${opName}] Ignored stale result`);
        throw new CanceledError('Stale result ignored');
      }

      // Only log success if enabled in config
      if (LOG_CONFIG.requests.success) {
        requestLogger.info(`✅ [${opName}] Success`);
      }
      return result;

    } catch (e) {
      if (e instanceof CanceledError) {
        if (LOG_CONFIG.requests.abort) {
          requestLogger.info(`🛑 [${opName}] Canceled`);
        }
      } else if (e instanceof TimeoutError) {
        if (LOG_CONFIG.requests.error) {
          requestLogger.error(`⏱️ [${opName}] Timeout after ${policy.timeoutMs}ms`);
        }
      } else {
        if (LOG_CONFIG.requests.error) {
          logRequestError(opName, e);
        }
      }
      throw e; // rethrow so UI can handle
    }
  }
}

export const request = new Request(); // default singleton
