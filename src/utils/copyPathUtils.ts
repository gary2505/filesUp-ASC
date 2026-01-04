/**
 * This is src/lib/utils/copyPathUtils.ts
 * Used by: src/lib/components/navigation/CopyPathMenu.svelte, src/lib/components/navigation/Breadcrumb.svelte
 * Purpose: Provides utilities for formatting paths in different ways for clipboard operations
 * Trigger: Called when copying paths to clipboard in different formats
 * Event Flow: Takes a path and format, returns formatted string
 * List of functions: toPlain, toQuoted, toEscaped, toJSON, toURL, toPosix, toWSL, toUNC, copyToClipboard, formatPath, getFormatLabel, getFormatExample
 */

/**
 * Copy Path Utilities
 * Provides various path format conversions for clipboard operations
 */

/**
 * Copy path formats
 */
export type CopyFormat = 
  | 'plain'      // C:\Users\Name
  | 'quoted'     // "C:\Users\Name"
  | 'escaped'    // C:\\Users\\Name
  | 'json'       // "C:\\\\Users\\\\Name"
  | 'url'        // file:///C:/Users/Name
  | 'posix'      // /Users/Name
  | 'wsl'        // /mnt/c/Users/Name
  | 'unc';       // \\MYPC\Users\Name

/**
 * Format a path as plain (no modifications)
 */
export function toPlain(path: string): string {
  return path;
}

/**
 * Format a path with quotes
 * Example: "C:\Users\Name"
 */
export function toQuoted(path: string): string {
  return `"${path}"`;
}

/**
 * Format a path with escaped backslashes (for programming)
 * Example: C:\\Users\\Name
 */
export function toEscaped(path: string): string {
  return path.replace(/\\/g, '\\\\');
}

/**
 * Format a path as JSON string (double-escaped + quoted)
 * Example: "C:\\\\Users\\\\Name"
 */
export function toJSON(path: string): string {
  return JSON.stringify(path);
}

/**
 * Format a path as file:// URL
 * Example: file:///C:/Users/Name
 */
export function toURL(path: string): string {
  // Convert backslashes to forward slashes
  const normalized = path.replace(/\\/g, '/');
  
  // Handle different path types
  if (normalized.startsWith('//')) {
    // UNC path: //server/share → file://server/share
    return `file:${normalized}`;
  } else if (/^[A-Za-z]:/.test(normalized)) {
    // Windows drive: C:/Users → file:///C:/Users
    return `file:///${normalized}`;
  } else if (normalized.startsWith('/')) {
    // Unix path: /Users → file:///Users
    return `file://${normalized}`;
  }
  
  return `file:///${normalized}`;
}

/**
 * Format a Windows path as POSIX (Unix-style)
 * Example: /Users/Name (removes drive letter)
 */
export function toPOSIX(path: string): string {
  // Convert backslashes to forward slashes
  let posix = path.replace(/\\/g, '/');
  
  // Remove Windows drive letter if present (C:\Users → /Users)
  posix = posix.replace(/^[A-Za-z]:/, '');
  
  // Ensure leading slash
  if (!posix.startsWith('/')) {
    posix = '/' + posix;
  }
  
  return posix;
}

/**
 * Format a Windows path as WSL path
 * Example: C:\Users\Name → /mnt/c/Users/Name
 */
export function toWSL(path: string): string {
  // Convert backslashes to forward slashes
  let wsl = path.replace(/\\/g, '/');
  
  // Convert drive letter to /mnt/X format
  const driveMatch = wsl.match(/^([A-Za-z]):(.*)/);
  if (driveMatch) {
    const driveLetter = driveMatch[1].toLowerCase();
    const pathPart = driveMatch[2];
    return `/mnt/${driveLetter}${pathPart}`;
  }
  
  // If no drive letter, just convert to POSIX
  return toPOSIX(path);
}

/**
 * Format a path as UNC network path
 * Example: \\MYPC\Users\Name
 * 
 * Note: This is a placeholder implementation.
 * For real UNC conversion, you need to call the backend
 * to resolve the local path to its network share.
 */
export function toUNC(path: string, computerName?: string): string {
  // If already UNC, return as-is
  if (path.startsWith('\\\\') || path.startsWith('//')) {
    return path.replace(/\//g, '\\');
  }
  
  // For local paths, construct UNC format
  // Example: C:\Users\Name → \\MYPC\C$\Users\Name
  const normalized = path.replace(/\//g, '\\');
  const pcName = computerName || 'MYPC'; // Default, should be from system
  
  // Convert C:\ to \\MYPC\C$\
  const driveMatch = normalized.match(/^([A-Za-z]):(\\.*)/);
  if (driveMatch) {
    const drive = driveMatch[1].toUpperCase();
    const pathPart = driveMatch[2];
    return `\\\\${pcName}\\${drive}$${pathPart}`;
  }
  
  return normalized;
}

/**
 * Copy text to clipboard
 * Uses existing project pattern: navigator.clipboard.writeText()
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Primary: Use browser clipboard API (same as existing code in Tab1Layout, FolderContextMenu, LogViewerNew)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback: Legacy textarea method (same as LogViewerNew.svelte)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Format path according to specified format
 */
export function formatPath(path: string, format: CopyFormat, computerName?: string): string {
  switch (format) {
    case 'plain': return toPlain(path);
    case 'quoted': return toQuoted(path);
    case 'escaped': return toEscaped(path);
    case 'json': return toJSON(path);
    case 'url': return toURL(path);
    case 'posix': return toPOSIX(path);
    case 'wsl': return toWSL(path);
    case 'unc': return toUNC(path, computerName);
    default: return path;
  }
}

/**
 * Get friendly label for copy format
 */
export function getFormatLabel(format: CopyFormat): string {
  switch (format) {
    case 'plain': return 'Copy Address Plain';
    case 'quoted': return 'Copy Quoted Path';
    case 'escaped': return 'Copy Escaped Path';
    case 'json': return 'Copy JSON Path';
    case 'url': return 'Copy As URL';
    case 'posix': return 'Copy Address POSIX';
    case 'wsl': return 'Copy WSL Path';
    case 'unc': return 'Copy Address Network';
    default: return 'Copy';
  }
}

/**
 * Get example for copy format
 */
export function getFormatExample(format: CopyFormat): string {
  switch (format) {
    case 'plain': return 'C:\\Users\\Name';
    case 'quoted': return '"C:\\Users\\Name"';
    case 'escaped': return 'C:\\\\Users\\\\Name';
    case 'json': return '"C:\\\\\\\\Users\\\\\\\\Name"';
    case 'url': return 'file:///C:/Users/Name';
    case 'posix': return '/Users/Name';
    case 'wsl': return '/mnt/c/Users/Name';
    case 'unc': return '\\\\MYPC\\Users\\Name';
    default: return '';
  }
}

