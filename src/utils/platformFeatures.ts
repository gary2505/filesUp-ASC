/**
 * This is src/lib/utils/platformFeatures.ts
 * Used by: src/lib/utils/platformTest.ts
 * Purpose: Provides platform-specific features and settings
 * Trigger: Called to get platform-specific values
 * Event Flow: Checks global platform stores, returns appropriate values
 * List of functions: getKeyboardShortcuts, getPathSeparator, getLineEnding, shouldShowWindowControls, getPlatformDisplayName
 */

import { globalIsWindows, globalIsMac, globalIsLinux, globalIsTauri } from '$lib/stores/platform';

/**
 * Platform-specific keyboard shortcuts
 */
export function getKeyboardShortcuts() {
  if (globalIsMac()) {
    return { 
      copy: 'Cmd+C', 
      paste: 'Cmd+V',
      cut: 'Cmd+X',
      selectAll: 'Cmd+A',
      undo: 'Cmd+Z',
      redo: 'Cmd+Shift+Z'
    };
  } else {
    return { 
      copy: 'Ctrl+C', 
      paste: 'Ctrl+V',
      cut: 'Ctrl+X',
      selectAll: 'Ctrl+A',
      undo: 'Ctrl+Z',
      redo: 'Ctrl+Y'
    };
  }
}

/**
 * Platform-specific path separator
 */
export function getPathSeparator(): string {
  return globalIsWindows() ? '\\' : '/';
}

/**
 * Platform-specific line ending
 */
export function getLineEnding(): string {
  return globalIsWindows() ? '\r\n' : '\n';
}

/**
 * Check if window controls should be shown
 * On macOS, window controls are handled by the OS
 */
export function shouldShowWindowControls(): boolean {
  return globalIsTauri && (globalIsWindows() || globalIsLinux());
}

/**
 * Get platform-specific file system case sensitivity
 */
export function isFileSystemCaseSensitive(): boolean {
  // Windows and macOS are typically case-insensitive
  // Linux is typically case-sensitive
  return globalIsLinux();
}

/**
 * Get platform-specific max path length
 */
export function getMaxPathLength(): number {
  if (globalIsWindows()) {
    return 260; // MAX_PATH on Windows (can be extended with long path support)
  } else {
    return 4096; // Typical limit on Unix-like systems
  }
}

/**
 * Platform-specific directory preferences
 */
export function getDefaultDirectories() {
  if (globalIsWindows()) {
    return {
      home: 'C:\\Users\\%USERNAME%',
      documents: 'C:\\Users\\%USERNAME%\\Documents',
      downloads: 'C:\\Users\\%USERNAME%\\Downloads',
      desktop: 'C:\\Users\\%USERNAME%\\Desktop'
    };
  } else if (globalIsMac()) {
    return {
      home: '~',
      documents: '~/Documents',
      downloads: '~/Downloads',
      desktop: '~/Desktop'
    };
  } else {
    return {
      home: '~',
      documents: '~/Documents',
      downloads: '~/Downloads',
      desktop: '~/Desktop'
    };
  }
}

/**
 * Platform-specific context menu behavior
 */
export function getContextMenuTrigger(): string {
  if (globalIsMac()) {
    return 'Ctrl+Click or Right Click';
  } else {
    return 'Right Click';
  }
}

/**
 * Platform name for display purposes
 */
export function getPlatformDisplayName(): string {
  if (globalIsWindows()) return 'Windows';
  if (globalIsMac()) return 'macOS';
  if (globalIsLinux()) return 'Linux';
  return 'Unknown';
}
