// src/taskFlow/core/commands.ts
// Used by: src/taskFlow/runtime/dispatch.ts, UI components
// Purpose: Define the Command union type and command constructor helpers.
// Trigger: UI events (click, keyboard) or app lifecycle create commands.
// Event Flow: User action -> cmdBoot() -> dispatch(cmd) -> runBootFlow()
// Functions:
//   - cmdBoot(): Create Boot command
//   - cmdSort(payload): Create Sort command (TODO/placeholder)

/// Command types for the TaskFlow dispatch system.
/// Why: Commands unify mouse/keyboard/lifecycle triggers into a single typed interface.
/// Pattern: Each command has a unique 'type' discriminator for exhaustive type checking.
export type Cmd = 
  | { type: 'Boot'; payload: { appVersion: string } }
  | { type: 'Sort'; payload: { criteria: string } } // TODO: implement sortFlow

/// Create a Boot command.
/// Why: Boot flow needs to run exactly once on app startup to generate initial bundle evidence.
/// Example: dispatch(cmdBoot({ appVersion: '0.0.1' }))
export function cmdBoot(payload: { appVersion: string }): Cmd {
  return { type: 'Boot', payload };
}

/// Create a Sort command (placeholder).
/// Why: Future feature - will dispatch to sortFlow when implemented.
/// Example: dispatch(cmdSort({ criteria: 'name' }))
export function cmdSort(payload: { criteria: string }): Cmd {
  return { type: 'Sort', payload };
}
