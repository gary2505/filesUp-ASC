// src/lib/core/opsBus.ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { operationManager, type OperationProgress } from '$lib/core/operations/operationManager';
import { log } from '$lib/core/logging/logService';

const OPS_EVENT = 'fu://ops/progress';

class OpsBus {
  private unlisten: UnlistenFn | null = null;
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    this.unlisten = await listen<OperationProgress>(OPS_EVENT, (event) => {
      const payload = event.payload;
      log.trace('core.opsBus', 'Progress event', payload);
      operationManager.onProgress(payload);
    });

    log.info('core.opsBus', `OpsBus listening on ${OPS_EVENT}`);
  }

  async stop() {
    if (!this.unlisten) return;
    await this.unlisten();
    this.unlisten = null;
    this.started = false;
    log.info('core.opsBus', 'OpsBus stopped');
  }
}

export const opsBus = new OpsBus();
