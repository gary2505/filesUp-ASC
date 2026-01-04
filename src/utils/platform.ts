/**
 * This is src/lib/utils/platform.ts
 * Used by: src/lib/utils/folderNameValidation.ts, src/main.ts, src/lib/tauri/osInfo.ts, src/lib/stores/platform.ts, src/lib/P3/Preview/quickview/previewers/QuickText.svelte, src/lib/P1/MyPCPanel.svelte, src/lib/components/panels/howToOpenFile.ts, src/lib/components/panels/MainPanels.svelte, src/lib/components/panels/FileViewPanel.svelte, src/lib/components/navbars/BaseNavBar.svelte, src/lib/App.svelte
 * Purpose: Detects if running in Tauri context vs web
 * Trigger: Called during initialization and when needed
 * Event Flow: Checks for Tauri globals, tests bridge
 * List of functions: isTauriContextAsync, isTauriContext, setTauriDetectionResult
 */

import { waitTauriReady } from './tauriReady';

// Cache the detection result to avoid multiple conflicting detections
let _tauriDetectionCache: boolean | null = null;
let _detectionPromise: Promise<boolean> | null = null;

// Initialize detection immediately when module loads
(function initializePlatformDetection() {
  if (typeof window !== 'undefined') {
    // Check for Tauri global properties synchronously
    const tauriProps = ['__TAURI_IPC__', '__TAURI__', '__TAURI_INTERNALS__', '__TAURI_CORE__'];
    for (const prop of tauriProps) {
      if (prop in window) {
        // Silent - Tauri detected (platform initialization)
        _tauriDetectionCache = true;
        return;
      }
    }
    _tauriDetectionCache = false;
  }
})();

export async function isTauriContextAsync(): Promise<boolean> {
  // Return cached result if available
  if (_tauriDetectionCache !== null) {
    return _tauriDetectionCache;
  }
  
  // Prevent multiple concurrent detections
  if (_detectionPromise) {
    return _detectionPromise;
  }
  
  _detectionPromise = (async () => {
    try {
      const bridge = await waitTauriReady();
      
      // Test if Tauri backend is available with a simple command
      try {
        await bridge.invoke('greet', { name: 'test' });
        console.log(`[Platform] Tauri backend connection confirmed via ${bridge.source}`);
        _tauriDetectionCache = true;
        return true;
      } catch (e) {
        console.log('[Platform] Tauri bridge available but backend test failed');
        _tauriDetectionCache = true; // Bridge exists, consider it Tauri
        return true;
      }
    } catch (e) {
      console.log('[Platform] Tauri bridge detection failed');
      _tauriDetectionCache = false;
      return false;
    } finally {
      _detectionPromise = null;
    }
  })();
  
  return _detectionPromise;
}

export function isTauriContext(): boolean {
  // Return cached result (should always be available after module init)
  return _tauriDetectionCache ?? false;
}

export function setTauriDetectionResult(isTauri: boolean): void {
  _tauriDetectionCache = isTauri;
}

export function getTauriDetectionCache(): boolean | null {
  return _tauriDetectionCache;
}

export function clearTauriDetectionCache(): void {
  console.log('[Platform] Clearing Tauri detection cache');
  _tauriDetectionCache = null;
  _detectionPromise = null;
}
