<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { sessionActions, hasValidSession, sessionState, type SessionState } from '$lib/stores/sessionRestore';
  import { panelStateActions, panelStates } from '$lib/stores/panelStates.store';
  import { get } from 'svelte/store';
  import { createDebugLogger } from '$lib/core/logging/unified-logger';
  import { startupCoordinator } from '$lib/core/startupCoordinator';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { onWindow, DisposableBin } from '$lib/utils/eventRegistry';

  const log = createDebugLogger('SessionManager');
  const SCOPE = 'session' as const;

  export let onSessionRestored: (session: any) => void = () => {};
  export let onFirstTimeLoad: () => void = () => {};

  let isRestoring = false;
  let restorationError: string | null = null; // 🔒 allow null safely
  let hasRestoredSession = false;

  let cleanup: (() => Promise<void>) | null = null;
  let bin: any = null; // DisposableBin for event listeners
  let unlistenClose: UnlistenFn | null = null;
  let tauriCloseListenerAttached = false;

  // Safe validity check that won't throw on deep reads
  function safeHasValidSession(s: any): boolean {
    try {
      return hasValidSession(s as any);
    } catch (e) {
      log.warn(SCOPE, 'validate', 'Session validation failed', { error: e });
      return false;
    }
  }
  
  onMount(async () => {
    // Signal that session loading can begin
    startupCoordinator.beginSessionLoading();
    
    try {
      isRestoring = true;
      restorationError = null;

      const session = await sessionActions.loadSession();

      if (safeHasValidSession(session)) {
        try {
          await restorePanelStates(session);
          hasRestoredSession = true;
          restorationError = null;
          log.info(SCOPE, 'restore.complete', 'SESSION RESTORED');
          
          // Session completion is now handled by sessionRestore.ts
          
          onSessionRestored(session);
        } catch (e) {
          log.warn(SCOPE, 'restore.error', 'Panel restoration failed - using defaults', { error: e });
          restorationError = 'Some panel data was invalid; used safe defaults';
          
          // Session completion is now handled by sessionRestore.ts
          
          onFirstTimeLoad();
        }
      } else {
        log.info(SCOPE, 'firstTime', 'FIRST TIME LOAD');
        restorationError = null;
        
        // Session completion is now handled by sessionRestore.ts
        
        onFirstTimeLoad();
        
        // Ensure first-time load opens a fallback path
        try {
          const fallback = 'C:\\';
          window.dispatchEvent(new CustomEvent('folderSelected', {
            detail: { path: fallback, name: 'Local Disk (C:)', isDirectory: true, isDrive: true }
          }));
        } catch (e) {
          // Silent fallback failure
        }
      }

      // 🔒 Guaranteed fallback: ensure at least one panel has a folder selected
      const currentPanelStates = get(panelStates);
      const hasAnyFolder = Boolean(
        currentPanelStates?.P1?.currentFolder || 
        currentPanelStates?.P2?.currentFolder || 
        currentPanelStates?.P3?.currentFolder ||
        currentPanelStates?.P1?.selectedFolder || 
        currentPanelStates?.P2?.selectedFolder || 
        currentPanelStates?.P3?.selectedFolder
      );

      if (!hasAnyFolder) {
        try {
          const fallback = 'C:\\';
          panelStateActions.setSelectedFolder('P1', fallback, 'drive');
          panelStateActions.setCurrentFolder('P1', fallback, 'drive');
        } catch (e) {
          log.warn(SCOPE, 'fallback.error', 'Failed to set fallback path', { error: e });
        }
      }

      try {
        await setupAutoSave();
      } catch (e) {
        log.warn(SCOPE, 'autoSave.error', 'Auto-save setup failed (non-fatal)', { error: e });
      }

    } catch (error: unknown) {
      // benign aborts shouldn't surface
      log.error(SCOPE, 'mount.error', 'Caught error in main try block', { error });
      log.info(SCOPE, 'mount.error', 'Error details', {
        errorName: (error as any)?.name,
        errorMessage: (error as any)?.message,
        errorType: typeof error,
        errorString: String(error)
      });
      
      if ((error as any)?.name === 'AbortError' || String((error as any)?.message || '').includes('aborted')) {
        log.debug(SCOPE, 'mount.abort', 'Session restoration aborted (expected during HMR/unmount)');
        // Session completion is now handled by sessionRestore.ts
        onFirstTimeLoad(); // still proceed
      } else {
        log.error(SCOPE, 'restore.failed', 'Session restoration failed - processing error for user message');
        let userMessage = 'Unknown error';
        if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
          const m = (error as any).message.toLowerCase();
          log.info(SCOPE, 'restore.failed', 'Error message processing', {
            originalMessage: (error as any).message,
            lowerCaseMessage: m
          });
          if (m.includes('cannot read property') || m.includes('reading')) {
            userMessage = 'Session data was corrupted, using default settings';
            log.info(SCOPE, 'restore.failed', 'Mapped to: Session data corruption');
          } else if (m.includes('storage') || m.includes('localstorage')) {
            userMessage = 'Unable to access stored settings, using defaults';
            log.info(SCOPE, 'restore.failed', 'Mapped to: Storage access error');
          } else if (m.includes('network') || m.includes('fetch')) {
            userMessage = 'Unable to load settings, using defaults';
            log.info(SCOPE, 'restore.failed', 'Mapped to: Network error');
          } else {
            userMessage = (error as any).message;
            log.info(SCOPE, 'restore.failed', 'Mapped to: Original error message');
          }
        }
        restorationError = userMessage;
        log.error(SCOPE, 'restore.failed', 'Restoration error set', { restorationError });
        // Session completion is now handled by sessionRestore.ts
        onFirstTimeLoad(); // Fallback path
      }
    } finally {
      isRestoring = false;
      log.info(SCOPE, 'mount.complete', 'Finally block executed');
      log.info(SCOPE, 'mount.complete', 'Final state', {
        isRestoring: isRestoring,
        hasRestoredSession: hasRestoredSession,
        restorationError: restorationError
      });
    }
  });
  
  onDestroy(async () => {
    // 🔧 FIX: Don't save session if we're in the middle of a refresh
    const isRefreshing = typeof window !== 'undefined' && (window as any).__FILESUP_REFRESHING__;
    
    if (!isRefreshing) {
      try {
        log.debug(SCOPE, 'destroy', 'Saving session before component destruction');
        updateSessionFromPanelStates();
        await sessionActions.saveSession();
      } catch (e) {
        log.warn(SCOPE, 'destroy.error', 'Non-fatal error while saving on destroy', { error: e });
      }
    } else {
      log.info(SCOPE, 'destroy', 'Skipping session save during refresh');
    }
    
    try {
      await cleanup?.();
      bin.dispose(); // Clean up event listeners
    } catch (e) {
      log.warn(SCOPE, 'destroy.error', 'Non-fatal error while cleaning up', { error: e });
    }
  });
  
  async function restorePanelStates(session: any) {
    log.debug(SCOPE, 'restore.panels', 'Restoring panel states from session');
    log.debug(SCOPE, 'restore.panels', 'Input session', {
      hasSession: !!session,
      sessionType: typeof session,
      hasPanels: !!session?.panels
    });

    if (!session || typeof session !== 'object' || !session.panels || typeof session.panels !== 'object') {
      log.warn(SCOPE, 'restore.panels', 'No valid panels data in session — skipping panel restoration');
      log.debug(SCOPE, 'restore.panels', 'Invalid session details', {
        session: session,
        sessionType: typeof session,
        sessionPanels: session?.panels,
        panelsType: typeof session?.panels
      });
      return;
    }

    // P1
    if (session.panels.P1) {
      const p1 = session.panels.P1;
      log.debug(SCOPE, 'restore.p1', 'Restoring P1 state', {
        selectedFolder: p1?.selectedFolder,
        currentFolder: p1?.currentFolder,
        contextType: p1?.contextType,
        expanded: Array.isArray(p1?.expanded) ? p1.expanded.length : 0
      });
      try {
        if (p1?.selectedFolder && p1.selectedFolder !== 'This PC') {
          log.debug(SCOPE, 'restore.p1', 'Calling panelStateActions.setSelectedFolder for P1');
          panelStateActions.setSelectedFolder('P1', p1.selectedFolder, p1.contextType || 'folder');
        }
        if (p1?.currentFolder && p1.currentFolder !== 'This PC') {
          log.debug(SCOPE, 'restore.p1', 'Calling panelStateActions.setCurrentFolder for P1');
          panelStateActions.setCurrentFolder('P1', p1.currentFolder, p1.contextType || 'folder');
        }
        if (Array.isArray(p1?.expanded)) {
          log.debug(SCOPE, 'restore.p1', 'Calling sessionActions.setExpandedNodes for P1');
          sessionActions.setExpandedNodes('P1', p1.expanded);
        }
        log.debug(SCOPE, 'restore.p1', 'P1 state restoration complete');
      } catch (e) {
        log.warn(SCOPE, 'restore.p1', 'P1 restoration failed (non-fatal)', { error: e });
      }
    } else {
      log.debug(SCOPE, 'restore.p1', 'No P1 data in session');
    }

    // P2
    if (session.panels.P2) {
      const p2 = session.panels.P2;
      log.debug(SCOPE, 'restore.p2', 'Restoring P2 state', {
        selectedFolder: p2?.selectedFolder,
        currentFolder: p2?.currentFolder,
        contextType: p2?.contextType,
        expanded: Array.isArray(p2?.expanded) ? p2.expanded.length : 0
      });
      try {
        if (p2?.selectedFolder && p2.selectedFolder !== 'This PC') {
          panelStateActions.setSelectedFolder('P2', p2.selectedFolder, p2.contextType || 'folder');
        }
        if (p2?.currentFolder && p2.currentFolder !== 'This PC') {
          panelStateActions.setCurrentFolder('P2', p2.currentFolder, p2.contextType || 'folder');
        }
        if (Array.isArray(p2?.expanded)) {
          sessionActions.setExpandedNodes('P2', p2.expanded);
        }
        log.debug(SCOPE, 'restore.p2', 'P2 state restoration complete');
      } catch (e) {
        log.warn(SCOPE, 'restore.p2', 'P2 restoration failed (non-fatal)', { error: e });
      }
    }

    // P3
    if (session.panels.P3) {
      const p3 = session.panels.P3;
      log.debug(SCOPE, 'restore.p3', 'Restoring P3 state', {
        selectedFolder: p3?.selectedFolder,
        currentFolder: p3?.currentFolder,
        contextType: p3?.contextType
      });
      try {
        if (p3?.selectedFolder && p3.selectedFolder !== 'This PC') {
          panelStateActions.setSelectedFolder('P3', p3.selectedFolder, p3.contextType || 'folder');
        }
        if (p3?.currentFolder && p3.currentFolder !== 'This PC') {
          panelStateActions.setCurrentFolder('P3', p3.currentFolder, p3.contextType || 'folder');
        }
        log.debug(SCOPE, 'restore.p3', 'P3 state restoration complete');
      } catch (e) {
        log.warn(SCOPE, 'restore.p3', 'P3 restoration failed (non-fatal)', { error: e });
      }
    }

    const finalStates = get(panelStates);
    log.debug(SCOPE, 'restore.panels', 'Final panel states after restoration', {
      P1_selected: finalStates?.P1?.selectedFolder,
      P1_current: finalStates?.P1?.currentFolder,
      P2_selected: finalStates?.P2?.selectedFolder,
      P2_current: finalStates?.P2?.currentFolder,
      P3_selected: finalStates?.P3?.selectedFolder,
      P3_current: finalStates?.P3?.currentFolder
    });
  }
  
  async function setupAutoSave() {
    log.debug(SCOPE, 'autoSave', 'Setting up auto-save listeners');

    const { on, DisposableBin } = await import('$lib/utils/eventRegistry');
    bin = new DisposableBin();

    // ✅ FIX: Add guard to prevent infinite loop during saves
    let isSaving = false;
    
    const unsubscribePanelStates = panelStates.subscribe((ps) => {
      try {
        // Skip if we're currently saving (prevents loop)
        if (isSaving) {
          log.debug(SCOPE, 'autoSave', 'Skipping auto-save (save already in progress)');
          return;
        }
        
        log.debug(SCOPE, 'autoSave', 'Panel states changed - triggering auto-save', {
          P1_selected: ps?.P1?.selectedFolder,
          P2_selected: ps?.P2?.selectedFolder,
          P3_selected: ps?.P3?.selectedFolder
        });
        
        isSaving = true;
        try {
          updateSessionFromPanelStates();
          sessionActions.debouncedSave();
        } finally {
          // Reset flag after a short delay to allow for batched updates
          setTimeout(() => { isSaving = false; }, 100);
        }
      } catch (e) {
        isSaving = false;
        log.warn(SCOPE, 'autoSave.error', 'Auto-save tick failed (non-fatal)', { error: e });
      }
    });

    const handleBeforeUnload = () => {
      try {
        log.debug(SCOPE, 'autoSave.unload', 'Window closing - saving session (beforeunload)');
        updateSessionFromPanelStates();
        sessionActions.saveSession();
      } catch (e) {
        log.warn(SCOPE, 'autoSave.unload', 'beforeunload save failed (non-fatal)', { error: e });
      }
    };
    
    // Use singleton pattern to prevent duplicate beforeunload handlers
    bin.add(onWindow('beforeunload', handleBeforeUnload, { ns: 'SessionAutoSave' }));

    if ((window as any).__TAURI_INTERNALS__) {
      log.debug(SCOPE, 'autoSave.tauri', 'Tauri detected - setting up close handler');
      try {
        const { getCurrentWindowSafely } = await import('$lib/utils/windowManager');
        const appWindow = getCurrentWindowSafely();
        const un = await appWindow.onCloseRequested((_e: any) => {
          try {
            log.debug(SCOPE, 'autoSave.tauri', 'Tauri onCloseRequested, saving session');
            updateSessionFromPanelStates();
            sessionActions.saveSession();
          } catch (err) {
            log.warn(SCOPE, 'autoSave.tauri', 'Save failed during onCloseRequested (non-fatal)', { error: err });
          }
        });
        if (typeof un === 'function') {
          unlistenClose = un;
          tauriCloseListenerAttached = true;
          log.debug(SCOPE, 'autoSave.tauri', 'Tauri close handler set up successfully');
        } else {
          log.warn(SCOPE, 'autoSave.tauri', 'onCloseRequested did not return a function', { type: typeof un });
          unlistenClose = null;
          tauriCloseListenerAttached = false;
        }
      } catch (error) {
        log.error(SCOPE, 'autoSave.tauri', 'Failed to set up Tauri close handler', { error });
        unlistenClose = null;
        tauriCloseListenerAttached = false;
      }
    }

    const autoSaveInterval = setInterval(() => {
      try {
        log.debug(SCOPE, 'autoSave.interval', 'Auto-save interval triggered');
        updateSessionFromPanelStates();
        sessionActions.saveSession();
      } catch (e) {
        log.warn(SCOPE, 'autoSave.interval', 'Interval save failed (non-fatal)', { error: e });
      }
    }, 300000);

    cleanup = async () => {
      try { unsubscribePanelStates?.(); } catch (e) { log.warn(SCOPE, 'autoSave.cleanup', 'Error unsubscribing from panel states', { error: e }); }
      try { bin.dispose(); } catch (e) { log.warn(SCOPE, 'autoSave.cleanup', 'Error disposing event listeners', { error: e }); }
      try { clearInterval(autoSaveInterval); } catch (e) { log.warn(SCOPE, 'autoSave.cleanup', 'Error clearing auto-save interval', { error: e }); }

      try {
        const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;
        if (!isDev && tauriCloseListenerAttached && unlistenClose && (window as any).__TAURI_INTERNALS__) {
          await Promise.resolve(unlistenClose()).catch((error) => {
            log.warn(SCOPE, 'autoSave.cleanup', 'Ignoring Tauri unlisten error (likely HMR)', { error });
          });
        } else if (isDev) {
          log.debug(SCOPE, 'autoSave.cleanup', 'Skipping Tauri unlisten in development to avoid HMR issues');
        }
      } catch (error) {
        log.warn(SCOPE, 'autoSave.cleanup', 'Error cleaning up Tauri close listener', { error });
      } finally {
        unlistenClose = null;
        tauriCloseListenerAttached = false;
      }

      log.debug(SCOPE, 'autoSave.cleanup', 'Auto-save listeners cleaned up');
    };
  }
  
  function sanitizePanel(p: any, allowThisPc: boolean) {
    const sel = typeof p?.selectedFolder === 'string' ? p.selectedFolder.trim() : '';
    const cur = typeof p?.currentFolder === 'string' ? p.currentFolder.trim() : '';
    const ctx = (p?.contextType ?? 'root');
    const exp = Array.isArray(p?.expanded) ? p.expanded : undefined;
    return {
      selectedFolder: (!allowThisPc && sel === 'This PC') ? '' : sel,
      currentFolder: (!allowThisPc && cur === 'This PC') ? '' : cur,
      contextType: ctx,
      ...(exp ? { expanded: exp } : {})
    };
  }

  function updateSessionFromPanelStates() {
    const ps = get(panelStates);
    log.debug(SCOPE, 'update', 'Updating session from panel states');

    if (!ps || typeof ps !== 'object') {
      log.warn(SCOPE, 'update', 'No panel states found - skipping update');
      return;
    }

    log.debug(SCOPE, 'update', 'Current panel states', {
      P1_selected: ps?.P1?.selectedFolder,
      P1_current: ps?.P1?.currentFolder,
      P2_selected: ps?.P2?.selectedFolder,
      P2_current: ps?.P2?.currentFolder,
      P3_selected: ps?.P3?.selectedFolder,
      P3_current: ps?.P3?.currentFolder
    });

    const sanitizedP1 = sanitizePanel(ps.P1 ?? {}, true);
    const sanitizedP2 = sanitizePanel(ps.P2 ?? {}, false);
    const sanitizedP3 = sanitizePanel(ps.P3 ?? {}, false);

    log.debug(SCOPE, 'update', 'Sanitized panel data', {
      P1: { selected: sanitizedP1.selectedFolder, current: sanitizedP1.currentFolder },
      P2: { selected: sanitizedP2.selectedFolder, current: sanitizedP2.currentFolder },
      P3: { selected: sanitizedP3.selectedFolder, current: sanitizedP3.currentFolder }
    });

    // ✅ FIX: Build session object directly WITHOUT calling updatePanelState
    // This prevents infinite loop: updatePanelState -> debouncedSave -> getSettings (empty) -> state change -> repeat
    const currentSession = get(sessionState);
    const updatedSession: SessionState = {
      ...currentSession,
      panels: {
        P1: { ...currentSession.panels.P1, ...sanitizedP1 },
        P2: { ...currentSession.panels.P2, ...sanitizedP2 },
        P3: { ...currentSession.panels.P3, ...sanitizedP3 }
      }
    };
    
    // Update session store silently (no debounce trigger)
    sessionState.set(updatedSession);

    log.debug(SCOPE, 'update', 'Session update complete (direct build, no loop)');
  }
  
  export function saveCurrentSession() {
    try {
      updateSessionFromPanelStates();
      sessionActions.saveSession();
    } catch (e) {
      log.warn(SCOPE, 'save', 'Manual save failed (non-fatal)', { error: e });
    }
  }

  export function resetToDefaults() {
    sessionActions.resetSession();
    hasRestoredSession = false;
    onFirstTimeLoad();
  }
</script>

<!-- Bottom status bar messages only (no top-right toast notifications) -->
{#if isRestoring}
  <div class="session-status-bar restoring">
    <div class="loading loading-spinner loading-xs"></div>
    <span>Restoring session...</span>
  </div>
{:else if restorationError}
  <div class="session-status-bar error">
    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/>
    </svg>
    <span>Failed to restore session: {restorationError}</span>
  </div>
{:else if hasRestoredSession}
  <div class="session-status-bar restored">
    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
    <span>Session restored</span>
  </div>
{/if}

<style>
  /* Status bar styles - positioned at bottom of window */
  .session-status-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 400;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 999;
    height: 20px;
    border-top: 1px solid hsl(var(--b3));
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  .session-status-bar.restoring {
    background-color: hsl(var(--b1));
    color: hsl(var(--bc) / 0.8);
  }
  .session-status-bar.error {
    background-color: hsl(var(--er) / 0.05);
    color: hsl(var(--er));
    border-top-color: hsl(var(--er) / 0.2);
  }
  .session-status-bar.restored {
    background-color: hsl(var(--su) / 0.05);
    color: hsl(var(--su));
    border-top-color: hsl(var(--su) / 0.2);
    animation: statusBarFadeOut 4s ease-in-out forwards;
  }
  @keyframes statusBarFadeOut {
    0%, 75% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
