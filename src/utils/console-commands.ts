/**
 * This is src/lib/utils/console-commands.ts
 * Used by: src/main.ts, src-tauri/src/main.ts
 * Purpose: Installs console commands for controlling log verbosity and noise reduction from browser console
 * Trigger: Called during app startup
 * Event Flow: Adds functions to window object for console control
 * List of functions: installConsoleCommands, quiet, verbose, showLogFilters, logQuiet, logNormal, logVerbose, logHelp, setNoiseReduction, getNoiseReduction, showFilters, setLogLevel, getLogLevel, showPasteMetrics, clearPasteMetrics
 */

// Console noise reduction utilities
// Quick commands to control log verbosity from browser console

// Extend window interface for TypeScript
declare global {
  interface Window {
    quiet: () => void;
    verbose: () => void;
    showLogFilters: () => void;
    logQuiet: () => void;
    logNormal: () => void;
    logVerbose: () => void;
    logHelp: () => void;
    setNoiseReduction: (enabled: boolean) => void;
    getNoiseReduction: () => boolean;
    showFilters: () => void;
    setLogLevel: (level: string) => void;
    getLogLevel: () => string;
    showPasteMetrics: () => void;
    clearPasteMetrics: () => void;
    __CONSOLE_COMMANDS_INSTALLED__?: boolean;
  }
}

const INSTALLED_CMDS = '__filesup_console_cmds_installed__';
export function installConsoleCommands() {
  if ((window as any)[INSTALLED_CMDS]) return;
  (window as any)[INSTALLED_CMDS] = true;

  // Easy noise control
  (window as any).quiet = () => {
    if (typeof (window as any).setNoiseReduction === 'function') {
      (window as any).setNoiseReduction(true);
    }
    console.info('🔇 Console noise reduction ENABLED');
  };
  
  (window as any).verbose = () => {
    if (typeof (window as any).setNoiseReduction === 'function') {
      (window as any).setNoiseReduction(false);
    }
    console.info('🔊 Console noise reduction DISABLED - showing all logs');
  };
  
  (window as any).showLogFilters = () => {
    if (typeof (window as any).showFilters === 'function') {
      (window as any).showFilters();
    } else {
      console.info('🔍 Log filters not available');
    }
  };
  
  // Log level controls (if using log-levels.ts)
  (window as any).logQuiet = () => {
    if (typeof (window as any).setLogLevel === 'function') {
      (window as any).setLogLevel('quiet');
    }
  };
  
  (window as any).logNormal = () => {
    if (typeof (window as any).setLogLevel === 'function') {
      (window as any).setLogLevel('normal');
    }
  };
  
  (window as any).logVerbose = () => {
    if (typeof (window as any).setLogLevel === 'function') {
      (window as any).setLogLevel('verbose');
    }
  };
  
  // Paste performance metrics commands
  (window as any).showPasteMetrics = async () => {
    try {
      const { getMetrics, pastePerformanceStore } = await import('$lib/stores/pastePerformanceStore');
      const metrics = getMetrics();
      
      if (metrics.length === 0) {
        console.info('📊 No paste metrics recorded yet. Metrics will be collected after paste operations.');
        return;
      }
      
      // Get current state with averages
      let state: any;
      pastePerformanceStore.subscribe((s: any) => state = s)();
      
      console.info(`
📊 PASTE PERFORMANCE METRICS (${metrics.length}/100 entries)

📈 Averages by Tier:
   Tier 1 (small): ${state.averages.tier1.avgMs}ms (${state.averages.tier1.count} samples)
   Tier 2 (medium): ${(state.averages.tier2.avgMs / 1000).toFixed(1)}s (${state.averages.tier2.count} samples)
   Tier 3 (large): ${(state.averages.tier3.avgMs / 1000).toFixed(1)}s (${state.averages.tier3.count} samples)

🕒 Recent Operations (last 10):`);
      
      metrics.slice(-10).reverse().forEach((m, i) => {
        const date = new Date(m.timestamp).toLocaleString();
        console.info(`   ${i + 1}. ${m.sizeGB.toFixed(2)}GB (${m.itemCount.toLocaleString()} items) - ${m.durationSec}s [Tier ${m.tier}] - ${date}`);
      });
      
      console.info('\n💡 Use clearPasteMetrics() to reset all data');
    } catch (err) {
      console.error('Failed to load paste metrics:', err);
    }
  };
  
  (window as any).clearPasteMetrics = async () => {
    try {
      const { clearMetrics } = await import('$lib/stores/pastePerformanceStore');
      clearMetrics();
      console.info('✅ All paste performance metrics cleared');
    } catch (err) {
      console.error('Failed to clear paste metrics:', err);
    }
  };
  
  // Help command
  (window as any).logHelp = () => {
    console.info(`
🎛️  Console Noise Control Commands:
   quiet()        - Enable noise reduction (filter repetitive logs)
   verbose()      - Disable noise reduction (show all logs)
   showLogFilters() - Show current noise filters
   
📊 Log Level Commands:
   logQuiet()     - Show only important logs
   logNormal()    - Show normal amount of logs (default)
   logVerbose()   - Show all logs including debug info
   
⏱️  Performance Monitoring:
   showPasteMetrics() - View paste operation performance history
   clearPasteMetrics() - Clear all paste metrics
   
💡 Examples:
   - quiet() && logQuiet()  // Minimal noise
   - verbose() && logVerbose() // Full debugging
   - showLogFilters() // See what's being filtered
   - showPasteMetrics() // View paste performance data
`);
  };
  
  // Show help on page load (once)
  setTimeout(() => {
    console.info('🎛️  Console noise controls loaded! Type logHelp() for commands.');
  }, 1000);
}

export {}; // Make this a module

export {}; // Make this a module