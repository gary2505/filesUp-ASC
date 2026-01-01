import { TimeoutError, CanceledError } from './errors';
import { anySignal } from './signals';

export async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
  external?: AbortSignal
): Promise<T> {
  const ctl = new AbortController();
  const signal = external ? anySignal([ctl.signal, external]) : ctl.signal;
  const t = setTimeout(() => ctl.abort(new TimeoutError(ms)), ms);
  try {
    if (signal.aborted) throw signal.reason ?? new CanceledError();
    return await new Promise<T>((res, rej) => {
      signal.addEventListener('abort', () => rej(signal.reason ?? new CanceledError()), { once: true });
      task(signal).then(res, rej);
    });
  } finally { 
    clearTimeout(t); 
  }
}
