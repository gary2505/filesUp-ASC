import { writable, derived, type Readable } from 'svelte/store';
import { listen } from '@tauri-apps/api/event';

import { waitTauriReady } from '$lib/utils/tauriReady';

type RawDisk = {
  mount_point: string;
  used_percent: number;
};

type RawPayload = {
  cpu_total: number;
  mem_used: number;
  mem_total: number;
  disk_max: RawDisk | null;
};

type Sample = {
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  ts: number;
};

const samples = writable<Sample[]>([]);

let latestDisk: RawDisk | null = null;

let initialized = false;
let unlistenPromise: Promise<() => void> | null = null;
let attachPromise: Promise<void> | null = null;
let debugEventCount = 0;
const DEBUG_EVENT_LIMIT = 5;

export function enableSystemMetrics(): Promise<void> | void {
  if (initialized) {
    return;
  }

  if (!attachPromise) {
    attachPromise = attachListener();
  }

  return attachPromise;
}

async function attachListener(): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn('[SystemMetrics] attachListener called without window context');
    return;
  }

  try {
    await waitTauriReady();
  } catch (error) {
    console.error('[SystemMetrics] Failed waiting for Tauri bridge; metrics disabled', error);
    attachPromise = null;
    return;
  }

  if (initialized) {
    attachPromise = null;
    return;
  }

  console.debug('[SystemMetrics] Subscribing to system://metrics events');
  initialized = true;

  unlistenPromise = listen<RawPayload>('system://metrics', (event) => {
    const payload = event.payload;

    const now = Date.now();

    samples.update((list) => {
      const next: Sample[] = [
        ...list,
        {
          cpu: payload.cpu_total,
          ramUsed: payload.mem_used,
          ramTotal: payload.mem_total,
          ts: now
        }
      ];

      // store last 10 sec of samples
      const cutoff = now - 10_000;
      return next.filter((s) => s.ts >= cutoff);
    });

    latestDisk = payload.disk_max;

    if (debugEventCount < DEBUG_EVENT_LIMIT) {
      console.debug('[SystemMetrics] Received metrics payload', {
        cpu: payload.cpu_total,
        memUsed: payload.mem_used,
        memTotal: payload.mem_total,
        disk: payload.disk_max,
      });
      debugEventCount += 1;
    }
  });

  unlistenPromise.then(() => {
    console.debug('[SystemMetrics] Metrics listener registered successfully');
  }).catch((error) => {
    console.error('[SystemMetrics] Failed to register metrics listener', error);
  });

  attachPromise = null;
}

export async function disableSystemMetrics() {
  if (!initialized) return;
  initialized = false;
  samples.set([]);
  latestDisk = null;
  debugEventCount = 0;
  attachPromise = null;

  if (unlistenPromise) {
    const unlisten = await unlistenPromise;
  unlisten();
    unlistenPromise = null;
  }
}

export type AveragedMetrics = {
  cpuAvg: number;
  ramPercent: number;
  disk: RawDisk | null; // here we simply provide the latest disk_max
};

export const averagedMetrics: Readable<AveragedMetrics | null> = derived(
  samples,
  ($samples) => {
    if ($samples.length === 0) return null;

    const cpuAvg =
      $samples.reduce((sum, s) => sum + s.cpu, 0) / $samples.length;

    const last = $samples[$samples.length - 1];
    const ramPercent =
      last.ramTotal > 0 ? (last.ramUsed / last.ramTotal) * 100 : 0;

    return {
      cpuAvg,
      ramPercent,
      disk: latestDisk,
    };
  }
);
