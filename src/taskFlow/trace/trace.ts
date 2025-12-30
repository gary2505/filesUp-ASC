// Simple tracing utility for task flow events
// src/taskflow/trace.ts
let traceEvents: Array<{ t: string; k: string; msg: string; data?: any }> = [];

export function traceEvent(
  k: string,
  msg: string,
  data?: any
): void {
  const event = {
    t: new Date().toISOString(),
    k,
    msg,
    data,
  };
  traceEvents.push(event);
  console.log(`[${k}] ${msg}`, data || "");
}

export function getTraceEvents() {
  return traceEvents;
}

export function resetTrace() {
  traceEvents = [];
}
