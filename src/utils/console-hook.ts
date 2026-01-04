/**
 * This is src/lib/utils/console-hook.ts
 * Used by: src/main.ts, src-tauri/src/main.ts
 * Purpose: Hooks console methods to also log to external log, and filters noisy logs
 * Trigger: Called during startup
 * Event Flow: Intercepts console.log/warn/error, applies filters, logs to external
 * List of functions: installConsoleHook, formatArgs
 */

// Hooks console.log/warn/error to also write to ex log (Tauri or fallback)
// Also suppresses noisy Tauri dev-mode callback warnings
import { logEx } from '../core/logging/logger-tauri';

function formatArgs(args: any[]): string {
  return args.map(a => {
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a);
      } catch {
        return '[object]';
      }
    }
    return String(a);
  }).join(' ');
}

// 🔇 QUIET MODE: Show ONLY date debug logs (temporary for date diagnostics)
const QUIET_MODE = false;  // ✅ Date debugging complete - normal logging restored
const ALLOWED_LOGS = [
  '📅 [DATE-DEBUG]',  // JavaScript date logs
  '🔍 [LS-STREAM]',   // Rust stream logs
  '📡 [FRONTEND]',    // Frontend IPC logs
  '[fs.rs]',          // Rust fs logs (will show in terminal, not browser)
  'Error',
  'error',
  '❌'
];

// Enhanced noise reduction filters for development mode
const NOISE_FILTERS = [
  // ✅ UI component noise - very verbose
  '[CONVERTED]',
  '[TreeRow]',
  '[TreeNodeView]',
  '[CHEVRON-DEBUG]',
  '[SUPER-DEBUG]',
  '[AUDIT-',
  '🔍 [CHEVRON',
  '🌲 [TreeNodeView]',
  '🔑 [SVELTE-KEY]',
  '[PATH-TRACKER]',
  '[StartupOrchestrator]',
  '[INIT]',
  '[MyPCPanel-',
  '[PinnedFoldersSection]',
  '[guardedExpand]',
  '[GUARDED-EXPAND]',
  '[EXPANSION-SUCCESS]',
  'pathFromDetail',
  'pathFromNode',
  'final path',
  'path source',
  '  - name:',
  '  - path:',
  '  - uid:',
  '  - expanded:',
  '  - loading:',
  '  - isDrive:',
  '  - children count:',
  '  - foundName:',
  '  - parentPath:',
  '  - targetPath:',
  '  - hasChildren:',
  '  - path matches target:',
  '  - startsWithParent:',
  '  - longerThanParent:',
  '  - hasProperSeparator:',
  '  - isParentOfTarget:',
  'StartupCoordinator',
  'StartupOrchestrator',
  'handleNewToggle ENTRY',
  'TreeNodeView handleToggle',
  'TreeChildren handleToggle',
  'ExpandButton dispatching',
  'ExpandButton.toggle called',
  'CHEVRON-CLICK-DETECTED',
  'ChevronController',
  'handleChevronToggle',
  'MyPCPanel handleNewToggle',
  'All expanded nodes',
  'Expand DOM update',
  'Mutex acquired',
  'Mutex released',
  'Protected expansion',
  '[Tab1Layout]',
  '[FolderTreePanel] 🚀 LOADING FOLDER',
  '[FolderTreePanel] 🚀 FOLDER LOADED',
  '[FolderTreePanel] 🚀 ITEMS PROCESSED',
  '[FolderViewStore]',
  '[ViewStore]',
  '[StatusBar]',
  '[FilesNavBar]',
  '[Request] ▶️',
  '[Request] ✅',
  'P2_State',
  'ExpandButton: using chevron',
  'ExpandButton.toggle called',
  'Path source analysis',
  'dispatched toggle to parent',
  '[CONVERTED]',
  'TreeChildren dispatched',
  '[Settings]',
  '[Request] ✅',
  '[Request] ▶️',
  'TreeNodeView forwarding',
  '[NewViewControl]',
  'Rendering TreeNodeViewCmp',
  
  // Performance monitoring noise - very verbose
  '[heartbeat] No activity for',
  '[longtask]',
  '[loopLag]',
  '[mem] used=',
  '[beat]',
  'PerformanceLongTaskTiming',
  
  // Settings I/O noise - extremely repetitive
  '[Settings-IO] 🚀 STARTING getSettings()',
  '[Settings-IO] 🔧 CALLING invokeSafe',
  '[Settings-IO] 📦 INVOKE RESULT:',  
  '[Settings-IO] 🔧 CALLING JSON.parse()',
  '[Settings-IO] ✅ JSON PARSE SUCCESS:',
  
  // Panel state management - very noisy
  '🔧 [MyPCPanel] panelStates change',
  '🔧 [MyPCPanel] expandToPath called:',
  '🔧 [MyPCPanel] P1_State.selectedFolder change',
  '⚠️ [MyPCPanel] expandToPath called with invalid path: null',
  
  // Navigation noise
  '[FolderTreeNavBar] 🔴 [PathEdit] EXITED edit mode:',
  '[FolderTreeNavBar] 🗂️ [FolderChange] Current folder changed:',
  
  // Frequent state updates
  '[ViewStore] Saved view state:',
  '[Tab1Layout] Reactive: selectedFolderPath changed',
  
  // Date debug logs from Rust (very verbose)
  '📅 [DATE-DEBUG]',
  
  // GPS operation completion logs
  '[gps-lite] ✅ Completed:',
  '[cancel] Cleaned up operation:',
  
  // Node state logs (very repetitive)
  '  - node.expanded:',
  '  - node.children?.length:',
  
  // Request logs for specific operations
  '[Request] ▶️ [fs.loadFolderContents]',
  '[Request] ✅ [fs.loadFolderContents]',
  '[Request] ▶️ [mypc.loadPinnedFolders]',
  '[Request] ✅ [mypc.loadPinnedFolders]',
  
  // NavigableFileViewPanel streaming logs
  '📦 [NavigableFileViewPanel]',
  
  // Logger.ts request logs (very verbose)
  'logger.ts:5 [Request]',
  
  // Auto-expand logs
  '🚪 [AUTO-EXPAND]',
  
  // System initialization logs (one-time startup noise)
  'Smart Debug Console loaded',
  'FilesUP Smart Debug System initialized',
  'Type logHelp() for commands',
  'For chevron issues',
  'Hotkey: Ctrl+Alt+D',
  '[safety-net]',
  'DEV MODE: Debug profile set to',
  'To enable debugging, use:',
  'debugProblems()',
  'debugChevrons()',
  'debugVerbose()',
  'logHelp()',
  'Console noise controls loaded',
  'FilesUP Diagnostics loaded',
  'Available commands:',
  'window.checkWatchers()',
  'window.monitorScroll()',
  'window.countListeners()',
  'window.measureVirtualScroll()',
  'window.profileSort()',
  
  // GPS and settings logs
  '🎯 [GPS] Global Processing Service initialized',
  '[ExtendedSettings]',
  '[Settings Store]',
  '[SessionMode]',
  
  // Watcher logs
  '👁️ [WATCHER]',
  '✅ [AutoWatch]',
  '🔍 [AutoWatch]',
  
  // Panel logs
  'PinnedFoldersSection',
  '[NavigableFileViewPanel]',
  '[gps-lite] ▶️',
  '[gps-lite] ✅',
  '🔧 [MyPCPanel]',
  
  // Pinned folder validation noise
  '[invokeSafe] attempt failed',
  'validate_pinned_path', 
  'save_pinned_list',
  'Folder not found',
  
  // UI state updates
  '[NavigableFileViewPanel] Panel focused',
  '[NavigableFileViewPanel] Panel blurred',
  '[NavigableFileViewPanel] Selection state:',
  '[NewViewControl] 🔍 State changed:',
  
  // Empty state decisions - repetitive
  '[FolderTreePanel] 📂 P2 EMPTY STATE DECISION:',
  
  // Grouping warnings - show up frequently
  '⚠️ Skipping item with missing date metadata for grouping',
  '📊 Grouping:',
  '📂 Created fallback group'
];

function shouldSuppressLog(message: string): boolean {
  if (!import.meta.env.DEV) return false;
  
  // 🔇 QUIET MODE: Only show allowed logs
  if (QUIET_MODE) {
    return !ALLOWED_LOGS.some(allowed => message.includes(allowed));
  }
  
  return NOISE_FILTERS.some(filter => message.includes(filter));
}

let origLog: (...args:any[]) => void;
let origWarn: (...args:any[]) => void;
let origError: (...args:any[]) => void;
let origDebug: (...args:any[]) => void;

const INSTALLED_FLAG = '__filesup_console_hook_installed__';
export function installConsoleHook() {
  // HMR/idempotent guard
  if ((window as any)[INSTALLED_FLAG]) return;
  (window as any)[INSTALLED_FLAG] = true;

  origLog = console.log;
  origWarn = console.warn;
  origError = console.error;
  origDebug = console.debug;

  console.log = function (...args: any[]) {
    const message = formatArgs(args);
    if (!shouldSuppressLogUpdated(message)) {
      origLog.apply(console, args);
      logEx(message, 'log');
    }
  };

  console.warn = function (...args: any[]) {
    const message = formatArgs(args);
    if (!shouldSuppressLogUpdated(message)) {
      origWarn.apply(console, args);
      logEx(message, 'log');
    }
  };

  console.debug = function (...args: any[]) {
    const message = formatArgs(args);
    if (!shouldSuppressLogUpdated(message)) {
      origDebug.apply(console, args);
    }
  };

  console.error = function (...args: any[]) {
    const message = formatArgs(args);
    
    // Suppress noisy Tauri callback warnings in dev mode only
    // These occur during HMR/hot-reload and are benign
    if (import.meta.env.DEV) {
      if (typeof args[0] === 'string' && args[0].includes("Couldn't find callback id")) {
        return; // Ignore dev-hot-reload noise
      }
      // Also catch variations of the pattern
      if (/\[TAURI\].*callback.*id/i.test(message)) {
        return; // Ignore Tauri IPC callback warnings
      }
    }
    
    if (!shouldSuppressLogUpdated(message)) {
      origError.apply(console, args);
      logEx(message, 'exception');
    }
  };

  // Make available globally for easy access
  if (typeof window !== 'undefined') {
    (window as any).setNoiseReduction = setNoiseReduction;
    (window as any).getNoiseReduction = getNoiseReduction;
    (window as any).showFilters = () => {
      console.log('Current noise filters:', NOISE_FILTERS);
    };
  }
}

// Global noise control
let globalNoiseReduction = true;

export function setNoiseReduction(enabled: boolean): void {
  globalNoiseReduction = enabled;
  console.info(`[Console] Noise reduction ${enabled ? 'enabled' : 'disabled'}`);
}

export function getNoiseReduction(): boolean {
  return globalNoiseReduction;
}

// Update shouldSuppressLog to respect global setting
function shouldSuppressLogUpdated(message: string): boolean {
  if (!import.meta.env.DEV || !globalNoiseReduction) return false;
  
  // 🔇 QUIET MODE: Only show allowed logs
  if (QUIET_MODE) {
    return !ALLOWED_LOGS.some(allowed => message.includes(allowed));
  }
  
  return NOISE_FILTERS.some(filter => message.includes(filter));
}

// Optionally export a restore function
export function restoreConsole() {
  if (origLog) {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
    console.debug = origDebug;
  }
}
