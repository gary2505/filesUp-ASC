export function anySignal(signals: (AbortSignal | null | undefined)[]): AbortSignal {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort((signals.find(s => s?.aborted) as any)?.reason);
  signals.forEach(s => s?.addEventListener('abort', onAbort, { once: true }));
  if (signals.some(s => s?.aborted)) onAbort();
  return ctl.signal;
}
