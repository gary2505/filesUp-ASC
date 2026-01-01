// src/lib/core/bug/bugReporter.ts
import { get } from 'svelte/store';
import { logStore, type LogEntry } from '$lib/core/logging/logService';
import { operationsStore } from '$lib/core/operations/operationManager';
import { telemetry, type TelemetryEvent } from '$lib/core/telemetry/telemetryService';

export interface BugReportPayload {
  summary: string;
  description: string;
  logs: LogEntry[];
  telemetry: TelemetryEvent[];
  activeOps: unknown[];
}

class BugReporter {
  buildPayload(summary: string, description: string): BugReportPayload {
    const logs = get(logStore);
    const opsMap = get(operationsStore as any) as Map<string, unknown>;
    const activeOps = Array.from(opsMap.values());
    const telem = telemetry.flush();

    return {
      summary,
      description,
      logs,
      telemetry: telem,
      activeOps,
    };
  }

  toJson(summary: string, description: string): string {
    const payload = this.buildPayload(summary, description);
    return JSON.stringify(payload, null, 2);
  }
}

export const bugReporter = new BugReporter();
