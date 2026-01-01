// src/qaTaskFlow/runtime/writeBundle.ts
// Used by: src/qaTaskFlow/runtime/runFlowWithContracts.ts
// Purpose: Writes the canonical debug bundle to disk via Tauri invoke command.
// Trigger: Called after flow execution (FAIL always, OK if writeOnOk=true).
// Event Flow: formatBundle() generates markdown -> writeBundle() -> Tauri invoke('write_debug_bundle') -> .ai/bundles/latest.bundle.md
// Functions:
//   - writeBundle(md): Dynamically imports @tauri-apps/api/core and calls write_debug_bundle command

/// Write the debug bundle markdown to disk via Tauri command.
/// Why: Bundle-first evidence - the .ai/bundles/latest.bundle.md file is canonical truth for debugging.
/// Note: Uses dynamic import to avoid bundling @tauri-apps/api in tests or non-Tauri environments.
/// Example: await writeBundle(formatBundleMarkdown({summary, events, contracts}))
export async function writeBundle(md: string): Promise<void> {
  try {
    // Dynamic import to avoid issues in test/SSR environments
    const { invoke } = await import('@tauri-apps/api/core');
    
    await invoke('write_debug_bundle', { md });
    
    console.log('✓ Debug bundle written to .ai/bundles/latest.bundle.md');
  } catch (err) {
    console.error('Failed to write debug bundle:', err);
    // Don't throw - bundle write failures shouldn't crash the app
  }
}
