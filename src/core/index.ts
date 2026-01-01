/**
 * src/lib/core/index.ts
 * Used by: click-controller.ts, key-controller.ts, expandController.ts, TreeRow.svelte (x3), MyPCPanel.svelte, file-ops.service.ts, dblclick-adaptive.ts, panelStates.store.ts
 * Purpose: Central export hub for core utilities - provides race condition prevention, rapid-fire blocking, and re-exports unified logger
 * Trigger: Imported at module load time by components/services that need core functionality
 * Event Flow: Module load → import utilities → register side-effect initializers → export unified logger + utility functions
 * Functions: createDebugLogger, logger, traceOp (re-exported), forbidRapidRepeat, singleFlight, epochGuard, runExclusive, isOperationActive
 * Status: Entry point for all core utilities; operations always active; unified logger always available
 */

// Core operations (always active)
import './operations/actionGate';
import './operations/raceOps';

// Re-export unified logger
export { createDebugLogger, logger, traceOp } from '$lib/core/logging/unified-logger';

// Re-export core operations
export { forbidRapidRepeat, singleFlight, epochGuard } from './operations/actionGate';
export { runExclusive, isOperationActive } from './operations/raceOps';

console.log('⚙️ Core operations loaded (actionGate, raceOps)');
console.log('📝 Unified logger active - use createDebugLogger() from $lib/core/logging/unified-logger');