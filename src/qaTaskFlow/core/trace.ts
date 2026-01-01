// src/qaTaskFlow/core/trace.ts
// Global trace buffer for structured event logging

export type TraceEventData = {
  t: string;        // ISO timestamp
  k: string;        // key, e.g. "BOOT_OK" or "K=10 FAIL boot-contract"
  msg: string;
  data?: any;
};

class TraceBuffer {
  private events: TraceEventData[] = [];

  reset(): void {
    this.events = [];
  }

  add(k: string, msg: string, data?: any): void {
    this.events.push({
      t: new Date().toISOString(),
      k,
      msg,
      data
    });
  }

  getEvents(): TraceEventData[] {
    return [...this.events];
  }

  getSummary(): string {
    if (this.events.length === 0) return "No events";
    const first = this.events[0];
    const last = this.events[this.events.length - 1];
    return `${first.k} → ${last.k}`;
  }
}

export const traceBuffer = new TraceBuffer();

export function traceEvent(k: string, msg: string, data?: any): void {
  traceBuffer.add(k, msg, data);
}

export function getTraceEvents(): TraceEventData[] {
  return traceBuffer.getEvents();
}

export function resetTrace(): void {
  traceBuffer.reset();
}

export function getTraceSummary(): string {
  return traceBuffer.getSummary();
}
