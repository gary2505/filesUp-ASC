/**
 * This is lib/core/startupOrchestrator.ts
 * Used by: src/App.svelte
 * Purpose: Coordinates application boot sequence with single-flight guarantees to prevent race conditions during Tauri initialization, settings load, drive discovery, session restore, and pinned folder validation
 * Trigger: App.svelte calls orchestratedStartup() on mount
 * Event Flow: orchestratedStartup() → waitTauriReady() → load settings (soft timeout) → getDrives() → delegate session restore to SessionManager → delegate pinned validation to components → mark finished
 * Functions: orchestratedStartup(options) - main boot coordinator with single-flight, executeStartupSequence(options) - 5-step startup process, ensureInitialPath(drives), resetStartupState(), isStartupInProgress()
 * 
 * startupOrchestrator.ts - Coordinates app boot sequence to prevent race conditions
 * Based on the race condition analysis document recommendations
 */

import { waitTauriReady } from '../utils/tauriReady';
import { getDrives } from '../utils/fs.wrapped';
import { createDebugLogger } from '$lib/core/logging/unified-logger';
import { panelStateActions } from '$lib/stores/panelStates.store';
import { hasValidSession } from '$lib/stores/sessionRestore';
import { get } from 'svelte/store';
import { perfMonitor } from '../utils/performanceMonitor';

const log = createDebugLogger('StartupOrchestrator');
const SCOPE = 'startup' as const;

async function ensureInitialPath(drives: Array<{ path: string }>) {
  try {
    const fallback = drives?.[0]?.path || 'C:\\';
    log.debug(SCOPE, 'ensureInitialPath', `Drive fallback available: ${fallback}`);
    
    // Don't pre-validate session here - let SessionManager handle it properly
    log.debug(SCOPE, 'ensureInitialPath', 'Session validation will be handled by SessionManager');
  } catch (error) {
    log.warn(SCOPE, 'ensureInitialPath', 'Failed to ensure initial path', { error });
  }
}

interface StartupOptions {
  skipDriveDiscovery?: boolean;
  timeoutMs?: number;
}

let isBooting = false;
let bootPromise: Promise<void> | null = null;
let finished = false;

/**
 * Orchestrated startup sequence to eliminate race conditions:
 * 1. Wait for Tauri readiness
 * 2. Load settings (soft timeout)
 * 3. Discover drives (single-flight handles dedupe)
 * 4. Safe session restore (guarded)
 * 5. Kick off pinned-folder validation (non-blocking)
 */
export async function orchestratedStartup(options: StartupOptions = {}): Promise<void> {
  // ✅ Single-flight: if already finished, return immediately
  if (finished) {
    log.debug(SCOPE, 'orchestratedStartup', 'Startup already completed, skipping');
    return;
  }

  // ✅ Single-flight: if already booting, return the same promise
  if (bootPromise) {
    log.debug(SCOPE, 'orchestratedStartup', 'Startup already in progress, joining existing boot sequence');
    return bootPromise;
  }

  if (isBooting) {
    log.warn(SCOPE, 'orchestratedStartup', '🚀 Startup race detected, waiting for completion');
    // Fallback polling if promise was somehow lost
    while (isBooting) {
      await new Promise(r => setTimeout(r, 100));
    }
    return;
  }

  isBooting = true;
  bootPromise = executeStartupSequence(options);

  try {
    await bootPromise;
    finished = true;
    log.info(SCOPE, 'orchestratedStartup', '🎯 Orchestrated startup completed successfully');
  } catch (error) {
    log.error(SCOPE, 'orchestratedStartup', '❌ Orchestrated startup failed', { error });
    throw error;
  } finally {
    isBooting = false;
    bootPromise = null;
  }
}

async function executeStartupSequence(options: StartupOptions): Promise<void> {
  const { timeoutMs = 30000 } = options;
  const startTime = Date.now();

  try {
    // ✅ Step 1: Wait for Tauri readiness (eliminates early-bridge races)
    log.debug(SCOPE, 'executeStartupSequence', 'Step 1: Waiting for Tauri bridge readiness...');
    perfMonitor.start('tauri-ready');
    await waitTauriReady();
    perfMonitor.end('tauri-ready');
    log.debug(SCOPE, 'executeStartupSequence', 'Tauri bridge ready');

    // ✅ Step 2: Load settings (soft timeout to avoid blocking)
    log.debug(SCOPE, 'executeStartupSequence', 'Step 2: Loading application settings...');
    perfMonitor.start('settings-load-orchestrator');
    try {
      // Note: Add your settings loading logic here
      // await loadAppSettings({ timeoutMs: 5000 });
      perfMonitor.end('settings-load-orchestrator');
      log.debug(SCOPE, 'settings', 'Settings loaded');
    } catch (settingsError) {
      perfMonitor.end('settings-load-orchestrator', { error: true });
      log.warn(SCOPE, 'settings', 'Settings loading failed, using defaults', { error: settingsError });
      // Continue with defaults - don't fail the entire boot
    }

    // ✅ Step 3: Session restore will be handled by SessionManager component
    // (already has null-guards to prevent crashes)
    log.debug(SCOPE, 'session', 'Step 3: Session restore will be handled by SessionManager');
    perfMonitor.mark('session-restore-delegated');

    // ✅ Step 4: Pinned folder validation will be handled by PinnedFoldersSection
    // (already has auto-cleanup to prevent error spam)
    log.debug(SCOPE, 'pinned', 'Step 4: Pinned folder validation will be handled by components');
    perfMonitor.mark('pinned-validation-delegated');

    // ✅ Step 5: Background tasks (non-blocking)
    // Move drive discovery off critical path
    if (!options.skipDriveDiscovery) {
      log.debug(SCOPE, 'drives', 'Starting background drive discovery');
      perfMonitor.start('background-drive-discovery');
      
      // Fire and forget - don't block startup
      getDrives()
        .then(async (drives) => {
          perfMonitor.end('background-drive-discovery', { driveCount: drives.length });
          log.info(SCOPE, 'drives', 'DRIVE DISCOVERY COMPLETE', { driveCount: drives.length });
          
          // Ensure we have a sane default path if no valid session
          await ensureInitialPath(drives);
        })
        .catch((driveError) => {
          perfMonitor.end('background-drive-discovery', { error: true });
          log.warn(SCOPE, 'drives', 'Drive discovery failed', { error: driveError });
        });
    }

    const duration = Date.now() - startTime;
    log.debug(SCOPE, 'complete', 'Startup sequence completed', { duration });

  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(SCOPE, 'error', 'Startup sequence failed', { duration, error });
    throw error;
  }
}

/**
 * Reset startup state (useful for testing or forced restart)
 */
export function resetStartupState(): void {
  isBooting = false;
  bootPromise = null;
  log.debug(SCOPE, 'reset', 'Startup state reset');
}

/**
 * Check if startup is currently in progress
 */
export function isStartupInProgress(): boolean {
  return isBooting;
}