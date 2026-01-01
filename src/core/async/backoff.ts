import { TimeoutError } from './errors';

export type RetryOpts = {
  retries?: number; 
  baseDelayMs?: number; 
  maxDelayMs?: number;
  jitter?: boolean; 
  shouldRetry?: (err: unknown) => boolean;
};

export async function retryWithBackoff<T>(
  op: (signal: AbortSignal) => Promise<T>,
  opts: RetryOpts,
  external?: AbortSignal
): Promise<T> {
  const { 
    retries = 2, 
    baseDelayMs = 300, 
    maxDelayMs = 2000, 
    jitter = true,
    shouldRetry = (e) => e instanceof TimeoutError 
  } = opts;
  
  const ctl = new AbortController(); 
  const signal = external ?? ctl.signal;
  let delay = baseDelayMs;
  
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw signal.reason;
    try { 
      return await op(signal); 
    } catch (e) {
      const last = attempt >= retries || !shouldRetry(e);
      if (last) throw e;
      
      let sleep = Math.min(delay, maxDelayMs); 
      if (jitter) sleep *= 0.5 + Math.random() * 0.5;
      await new Promise(r => setTimeout(r, sleep)); 
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}
