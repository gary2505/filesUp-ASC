/**
 * This is src/lib/utils/pathResolver.ts
 * Used by: FolderTreeNavBar.svelte
 * Purpose: Resolve user-entered paths intelligently (absolute, relative, env vars, shell shortcuts)
 * Trigger: User types path and presses Enter
 * Event Flow: Try resolution strategies, validate path, return result
 * List of functions: resolveSmartPath, resolveAbsolutePath, resolveRelativePath, resolveEnvironmentVariable, resolveShellShortcut, validatePathExists
 */

/*
 * pathResolver.ts - Smart Path Resolution System
 * 
 * PURPOSE: Resolve user-entered paths intelligently (absolute, relative, env vars, shell shortcuts)
 * USED BY: FolderTreeNavBar.svelte (path input Enter handler)
 * TRIGGER: User types path and presses Enter
 * 
 * EVENT FLOW:
 * 1. User types path in navbar (e.g., "Test", "..\Folder", "%TEMP%", "shell:downloads")
 * 2. handlePathInputKeydown calls resolveSmartPath(input, currentPath)
 * 3. Try resolution strategies in order: absolute → relative → env var → shell shortcut
 * 4. Validate resolved path using existing list_dir() command
 * 5. Return success (with resolved path) or error (with suggestions)
 * 6. UI navigates to resolved path or shows error toast
 * 
 * RESOLUTION STRATEGIES:
 * - Absolute: C:\Path, D:\, \\Server\Share
 * - Relative: Test, ..\Parent, ..\..\GrandParent, .\Current
 * - Environment Variables: %USERPROFILE%\Desktop, %TEMP%, %APPDATA%
 * - Shell Shortcuts: shell:downloads, shell:documents, shell:desktop
 * 
 * REUSES:
 * - list_dir() command for path validation (commands/fs.rs)
 * - invoke() wrapper from existing IPC system
 * - No plugins, standard TypeScript only
 */

import { invoke } from '$lib/tauri/ipc';
import { safeInvoke, CancelToken } from '$lib/services/safeInvoke';

export type PathResolutionResult = 
  | { success: true; resolvedPath: string; method: string }
  | { success: false; error: string; suggestions: string[] };

/**
 * Resolve smart path using Windows Explorer-like logic
 * 
 * @param input - User-entered path (can be absolute, relative, env var, or shell shortcut)
 * @param currentFolder - Current folder path for relative resolution
 * @returns Resolution result with path or error
 * 
 * @example
 * // Absolute path
 * await resolveSmartPath('C:\\Windows', 'C:\\Users') 
 * // → { success: true, resolvedPath: 'C:\\Windows', method: 'absolute' }
 * 
 * // Relative path
 * await resolveSmartPath('Test', 'C:\\A\\B2')
 * // → { success: true, resolvedPath: 'C:\\A\\B2\\Test', method: 'relative' }
 * 
 * // Parent navigation
 * await resolveSmartPath('..\\Test', 'C:\\A\\B2\\C1')
 * // → { success: true, resolvedPath: 'C:\\A\\B2\\Test', method: 'relative' }
 * 
 * // Environment variable
 * await resolveSmartPath('%USERPROFILE%\\Desktop', 'C:\\')
 * // → { success: true, resolvedPath: 'C:\\Users\\John\\Desktop', method: 'env_var' }
 * 
 * // Shell shortcut
 * await resolveSmartPath('shell:downloads', 'C:\\')
 * // → { success: true, resolvedPath: 'C:\\Users\\John\\Downloads', method: 'shell_shortcut' }
 */
export async function resolveSmartPath(
  input: string,
  currentFolder: string
): Promise<PathResolutionResult> {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {
      success: false,
      error: 'Path cannot be empty',
      suggestions: ['Enter a valid path']
    };
  }
  
  // Strategy 1: Absolute path (C:\, D:\, \\Server)
  if (isAbsolutePath(trimmed)) {
    return await validatePath(trimmed, 'absolute');
  }
  
  // Strategy 2: Environment variable (%VAR%)
  // Check BEFORE relative paths to handle "%TEMP%\subfolder" correctly
  if (hasEnvVar(trimmed)) {
    try {
      const expanded = await invoke<string>('expand_env_vars', { path: trimmed });
      const result = await validatePath(expanded, 'env_var');
      if (result.success) return result;
      // Fall through to try relative path
    } catch (error) {
      // Fall through to try other strategies
    }
  }
  
  // Strategy 3: Shell shortcut (shell:downloads)
  if (trimmed.startsWith('shell:')) {
    try {
      const resolved = await invoke<string>('resolve_shell_shortcut', { 
        shortcut: trimmed 
      });
      return await validatePath(resolved, 'shell_shortcut');
    } catch (error: any) {
      return {
        success: false,
        error: error?.toString() || `Unknown shell shortcut: ${trimmed}`,
        suggestions: [
          'Valid shortcuts: shell:desktop, shell:documents, shell:downloads',
          'shell:pictures, shell:music, shell:videos',
          'shell:appdata, shell:localappdata' // cSpell:disable-line
        ]
      };
    }
  }
  
  // Strategy 4: Relative path (Test, ..\Test, .\Folder)
  // This is the fallback — any input is treated as relative to current folder
  const relativePath = resolveRelativePath(trimmed, currentFolder);
  const result = await validatePath(relativePath, 'relative');
  
  if (result.success) return result;
  
  // Failed all strategies
  return {
    success: false,
    error: `Windows can't find '${trimmed}'.`,
    suggestions: [
      'Check the spelling and try again',
      `Looking in: ${currentFolder}`,
      `Resolved to: ${relativePath}`
    ]
  };
}

// ===== Helper Functions =====

/**
 * Check if path is absolute (starts with drive letter or UNC)
 */
function isAbsolutePath(path: string): boolean {
  // Drive letter: C:\, D:\, etc.
  if (/^[A-Za-z]:[\\\/]/.test(path)) return true;
  
  // UNC path: \\Server\Share
  if (path.startsWith('\\\\')) return true;
  
  return false;
}

/**
 * Check if path contains environment variables
 */
function hasEnvVar(path: string): boolean {
  return path.includes('%');
}

/**
 * Resolve relative path against current folder
 * Handles: ..\Test (parent), .\Test (current), Test (simple)
 * 
 * @example
 * resolveRelativePath('Test', 'C:\\A\\B2')          → 'C:\\A\\B2\\Test'
 * resolveRelativePath('..\\Test', 'C:\\A\\B2\\C1')  → 'C:\\A\\B2\\Test'
 * resolveRelativePath('..\\..\\Test', 'C:\\A\\B2\\C1') → 'C:\\A\\Test'
 */
export function resolveRelativePath(input: string, base: string): string {
  // Detect separator from base path
  const separator = base.includes('\\') ? '\\' : '/';
  
  // Handle ..\ (go up one or more levels)
  if (input.startsWith('..')) {
    const parts = base.split(/[\\\/]/);
    
    // Count how many levels to go up
    const upLevels = (input.match(/\.\.[\\\/]*/g) || []).length;
    
    // Remove the ..\ patterns to get remaining path
    const remaining = input.replace(/\.\.[\\\/]*/g, '');
    
    // Go up N levels, but never go above root
    const newBaseParts = parts.slice(0, Math.max(1, parts.length - upLevels));
    const newBase = newBaseParts.join(separator);
    
    return remaining ? newBase + separator + remaining : newBase;
  }
  
  // Handle .\ (current level - explicit)
  if (input.startsWith('.\\') || input.startsWith('./')) {
    return base + separator + input.slice(2);
  }
  
  // Simple append (relative name like "Test")
  return base.endsWith(separator) 
    ? base + input 
    : base + separator + input;
}

/**
 * Validate path exists using existing list_dir command
 * REUSES: commands/fs.rs::list_dir() — Already exists in backend!
 * 
 * @param path - Full path to validate
 * @param method - Resolution method used (for result reporting)
 * @returns Success with resolved path or error with suggestions
 */
async function validatePath(
  path: string, 
  method: string
): Promise<PathResolutionResult> {
  try {
    // Reuse existing list_dir command (just checking if it throws)
    // No need to process results, we just want to know if path is valid
    await safeInvoke<any>(
      'list_dir',
      { path, recursive: false },
      () => null,
      new CancelToken()
    );
    
    return { 
      success: true, 
      resolvedPath: path, 
      method 
    };
  } catch (error: any) {
    const errorMsg = error?.toString() || 'Unknown error';
    
    // Parse backend error for friendly message
    if (errorMsg.includes('Access is denied') || errorMsg.includes('E_PERM')) {
      return {
        success: false,
        error: `Access denied: ${path}`,
        suggestions: [
          'You don\'t have permission to access this folder',
          'Try a different location'
        ]
      };
    }
    
    if (errorMsg.includes('not found') || errorMsg.includes('E_NOT_FOUND') || errorMsg.includes('cannot find')) {
      return {
        success: false,
        error: `Path not found: ${path}`,
        suggestions: [
          'Check if the folder exists',
          'Verify the spelling',
          'Try a different path'
        ]
      };
    }
    
    // Generic error
    return { 
      success: false, 
      error: `Cannot access: ${path}`,
      suggestions: [
        'Path may not exist or is inaccessible',
        'Check permissions and try again'
      ]
    };
  }
}

