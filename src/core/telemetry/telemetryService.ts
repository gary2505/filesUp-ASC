// src/lib/core/telemetry/telemetryService.ts
import { log } from '$lib/core/logging/logService';

export interface TelemetryEvent {
  type: string;
  ts: number;
  data?: Record<string, unknown>;
}

class TelemetryService {
  private buffer: TelemetryEvent[] = [];
  private maxBuffer = 500;

  private push(evt: TelemetryEvent) {
    this.buffer.push(evt);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.splice(0, this.buffer.length - this.maxBuffer);
    }
  }

  flush(): TelemetryEvent[] {
    return [...this.buffer];
  }

  track(type: string, data?: Record<string, unknown>) {
    const evt: TelemetryEvent = { type, ts: Date.now(), data };
    this.push(evt);
    log.debug('core.telemetry', `Telemetry: ${type}`, data);
  }

  trackOpCompleted(kind: string, ts: number) {
    this.track('op.completed', { kind, ts });
  }

  trackOpFailed(kind: string, error: string) {
    this.track('op.failed', { kind, error });
  }

  trackOpCancelled(opId: string, reason: string) {
    this.track('op.cancelled', { opId, reason });
  }
}

export const telemetry = new TelemetryService();
