// src/taskFlow/runtime/dispatch.ts
// Used by: src/main.ts, UI components
// Purpose: Central command dispatcher that routes commands to appropriate flows.
// Trigger: Called when commands are created (e.g., on app startup, user interactions).
// Event Flow: dispatch(cmd) -> match cmd.type -> runBootFlow() or TODO: sortFlow()
// Functions:
//   - dispatch(cmd): Route command to the appropriate flow handler

import type { Cmd } from '../core/commands';
import { runBootFlow } from '../flows/bootFlow';

/// Dispatch a command to the appropriate flow handler.
/// Why: Provides a single entry point for all TaskFlow execution, making it easy to add new flows.
/// Pattern: Exhaustive switch on cmd.type ensures all commands are handled.
/// Example: await dispatch(cmdBoot({ appVersion: '0.0.1' }))
export async function dispatch(cmd: Cmd): Promise<void> {
  switch (cmd.type) {
    case 'Boot':
      await runBootFlow(cmd.payload.appVersion);
      break;
      
    case 'Sort':
      // TODO: implement sortFlow
      console.warn('Sort command not yet implemented');
      break;
      
    default:
      // Exhaustive check: TypeScript will error if a Cmd type is not handled
      const _exhaustive: never = cmd;
      console.error('Unknown command type:', _exhaustive);
  }
}
