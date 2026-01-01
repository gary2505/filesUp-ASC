// src/lib/core/operations/operationManager.ts
import { writable, type Readable } from 'svelte/store';
import { anySignal } from '$lib/core/async/signals';
import { gps, type Panel, type CancelReason } from '$lib/core/GPS';
import { log } from '$lib/core/logging/logService';
import { telemetry } from '$lib/core/telemetry/telemetryService';

export type OperationKind =
  | 'folder-scan'
  | 'copy'
  | 'delete'
  | 'folder-load'
  | 'thumbnail'
  | 'icons';

export type OperationPhase =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed-out';

export interface OperationProgress {
  opId: string;
  kind: OperationKind;
  phase: OperationPhase;
  progress?: number; // 0-100
  details?: string;
  path?: string;
  folders?: number;
  files?: number;
  sizeBytes?: number;
  errorMessage?: string;
}

export interface Operation {
  opId: string;
  kind: OperationKind;
  panel: Panel;
  phase: OperationPhase;
  createdAt: number;
  updatedAt: number;
  progress: number;
  details?: string;
  path?: string;
  folders: number;
  files: number;
  sizeBytes: number;
  errorMessage?: string;
}

export interface RunOptions {
  kind: OperationKind;
  panel: Panel;
  gpsTimeoutMs?: number;
  group?: 'fs-heavy' | 'scan' | 'background' | 'ui';
  externalSignal?: AbortSignal;
}

type OperationMap = Map<string, Operation>;

function createOperationsStore() {
  const inner = writable<OperationMap>(new Map());
  return {
    subscribe: ((run, invalidate) =>
      inner.subscribe((map) => run(new Map(map)))) as Readable<OperationMap>['subscribe'],
    upsert(op: Operation) {
      inner.update((map) => {
        map.set(op.opId, op);
        return map;
      });
    },
    patch(opId: string, patch: Partial<Operation>) {
      inner.update((map) => {
        const current = map.get(opId);
        if (!current) return map;
        map.set(opId, {
          ...current,
          ...patch,
          updatedAt: Date.now(),
        });
        return map;
      });
    },
    remove(opId: string) {
      inner.update((map) => {
        map.delete(opId);
        return map;
      });
    },
    clear() {
      inner.set(new Map());
    },
  };
}

export const operationsStore = createOperationsStore();

class OperationManager {
  private concurrency: Record<string, number> = {
    'fs-heavy': 1,
    scan: 2,
    background: 4,
    ui: 4,
  };

  private runningByGroup = new Map<string, Set<string>>();
  private queue: {
    opId: string;
    opts: RunOptions;
    startFn: (ctx: { opId: string; signal: AbortSignal }) => Promise<void>;
  }[] = [];

  private abortControllers = new Map<string, AbortController>();

  constructor() {
    Object.keys(this.concurrency).forEach((g) => {
      this.runningByGroup.set(g, new Set());
    });
  }

  onProgress(evt: OperationProgress) {
    const now = Date.now();
    const {
      opId,
      kind,
      phase,
      progress = 0,
      details,
      path,
      folders = 0,
      files = 0,
      sizeBytes = 0,
      errorMessage,
    } = evt;

    if (phase === 'completed' || phase === 'failed' || phase === 'cancelled' || phase === 'timed-out') {
      gps.endProcess(opId);
    } else {
      gps.touchProcess(opId);
    }

    operationsStore.patch(opId, {
      opId,
      kind,
      phase,
      progress,
      details,
      path,
      folders,
      files,
      sizeBytes,
      errorMessage,
      updatedAt: now,
    });

    if (phase === 'completed') {
      telemetry.trackOpCompleted(kind, now);
    } else if (phase === 'failed') {
      telemetry.trackOpFailed(kind, errorMessage ?? 'unknown');
    }
  }

  async run(
    opId: string,
    opts: RunOptions,
    startFn: (ctx: { opId: string; signal: AbortSignal }) => Promise<void>,
  ) {
    const group = opts.group ?? 'fs-heavy';
    const now = Date.now();

    const base: Operation = {
      opId,
      kind: opts.kind,
      panel: opts.panel,
      phase: 'queued',
      createdAt: now,
      updatedAt: now,
      progress: 0,
      folders: 0,
      files: 0,
      sizeBytes: 0,
    };
    operationsStore.upsert(base);

    const timeoutMs = opts.gpsTimeoutMs ?? this.defaultTimeoutForKind(opts.kind);
    gps.startProcess({
      opId,
      type: this.mapKindToProcessType(opts.kind),
      panel: opts.panel,
      timeoutMs,
    });

    // Register GPS cancel listener for this specific operation
    const unsub = gps.onCancel(opId, (reason, snapshot) => {
      log.warn('core.ops', `GPS requested cancel for ${snapshot.opId} (${reason})`, snapshot);
      this.handleGpsCancel(snapshot.opId, reason);
    });

    this.queue.push({ opId, opts, startFn });
    this.pumpQueue(group);
  }

  private defaultTimeoutForKind(kind: OperationKind): number {
    switch (kind) {
      case 'folder-scan':
        return 120_000;
      case 'copy':
      case 'delete':
        return 300_000;
      default:
        return 60_000;
    }
  }

  private mapKindToProcessType(kind: OperationKind) {
    switch (kind) {
      case 'folder-scan':
        return 'folder-scan';
      case 'folder-load':
        return 'folder-load';
      case 'copy':
        return 'copy';
      case 'delete':
        return 'delete';
      case 'thumbnail':
        return 'thumbnail';
      case 'icons':
        return 'icons';
      default:
        return 'tauri-invoke';
    }
  }

  private async pumpQueue(group: string) {
    const runningSet = this.runningByGroup.get(group);
    if (!runningSet) return;

    while (runningSet.size < (this.concurrency[group] ?? 1)) {
      const idx = this.queue.findIndex((q) => (q.opts.group ?? 'fs-heavy') === group);
      if (idx === -1) return;

      const job = this.queue.splice(idx, 1)[0];
      runningSet.add(job.opId);
      operationsStore.patch(job.opId, { phase: 'running' });

      const controller = new AbortController();
      const combined =
        job.opts.externalSignal != null
          ? anySignal([controller.signal, job.opts.externalSignal])
          : controller.signal;

      this.attachAbort(job.opId, controller);

      log.debug('core.ops', `Starting op ${job.opId} (${job.opts.kind}) in group ${group}`);

      job
        .startFn({ opId: job.opId, signal: combined })
        .catch((err) => {
          log.error('core.ops', `Operation ${job.opId} failed`, err);
          operationsStore.patch(job.opId, {
            phase: 'failed',
            errorMessage: err?.message ?? String(err),
          });
          telemetry.trackOpFailed(job.opts.kind, err?.message ?? String(err));
        })
        .finally(() => {
          runningSet.delete(job.opId);
          this.detachAbort(job.opId);
          this.pumpQueue(group);
        });
    }
  }

  private attachAbort(opId: string, controller: AbortController) {
    this.abortControllers.set(opId, controller);
  }

  private detachAbort(opId: string) {
    this.abortControllers.delete(opId);
  }

  private handleGpsCancel(opId: string, reason: 'timeout' | 'manual') {
    const controller = this.abortControllers.get(opId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    const phase: OperationPhase = reason === 'timeout' ? 'timed-out' : 'cancelled';
    operationsStore.patch(opId, { phase });
    telemetry.trackOpCancelled(opId, reason);
  }

  async cancel(opId: string) {
    log.info('core.ops', `User requested cancel for ${opId}`);
    gps.cancelProcess(opId);
    // backend cancellation happens via GPS → onCancel → Abort + cancel_file_operation
  }
}

export const operationManager = new OperationManager();
