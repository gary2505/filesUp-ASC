/**
 * This is src/lib/utils/paths.ts
 * Used by: src/lib/utils/platformFeatures.ts, src/lib/utils/platformTest.ts, src/lib/P2/parts/folderSizeEstimator.ts, src/lib/P2/NavigationHistory/pathUtils.ts
 * Purpose: Provides utilities for path handling, home directory detection, and platform-specific path operations
 * Trigger: Functions are called when needing to resolve paths, detect OS, or expand/collapse home tokens
 * Event Flow: Asynchronous calls to Tauri for OS info, caching results for performance
 * List of functions: getHomeDir, isWindows, expandHomeToken, collapseToTilde
 */

// Tauri 2 APIs
import { invoke } from '$lib/tauri/ipc';

let _homeCache: string | null = null;
let _isWindowsCache: boolean | null = null;

export async function getHomeDir(): Promise<string> {
  if (_homeCache) return _homeCache;
  try {
    _homeCache = await invoke<string>('get_home_dir');
    if (_homeCache) {
      _homeCache = _homeCache.replace(/\\/g, '/').replace(/\/+$/, '');
    }
  } catch {
    _homeCache = '';
  }
  return _homeCache || '';
}

export async function isWindows(): Promise<boolean> {
  if (_isWindowsCache !== null) return _isWindowsCache;
  try {
    const osInfo = await invoke<{ os: string }>('get_os_info');
    _isWindowsCache = osInfo.os === 'windows';
  } catch {
    // reasonably safe default when running in web preview
    _isWindowsCache = navigator.userAgent.includes('Windows');
  }
  return _isWindowsCache;
}

/** Replace ${HOME} token with real home path (forward slashes during processing). */
export function expandHomeToken(raw: string, home: string): string {
  if (!raw) return raw;
  if (raw.includes('${HOME}')) {
    return raw.replace(/\$\{HOME\}/g, home);
  }
  return raw;
}

/** Collapse absolute home path to ~ for friendlier display. */
export function collapseToTilde(p: string, home: string): string {
  if (!p || !home) return p;
  const normP = p.replace(/\\/g, '/');
  const normH = home.replace(/\\/g, '/');
  return normP.startsWith(normH + '/') || normP === normH
    ? '~' + normP.slice(normH.length)
    : p;
}

/** Normalize slashes for the host OS: \ on Windows, / otherwise. */
export function normalizeSeparatorsForOS(p: string, win: boolean): string {
  if (!p) return p;
  const forward = p.replace(/\\/g, '/');
  return win ? forward.replace(/\//g, '\\') : forward;
}

/** Middle-ellipsis a long path (keeps start and end). */
export function middleEllipsis(p: string, max = 48): string {
  if (!p || p.length <= max) return p;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return p.slice(0, head) + '…' + p.slice(-tail);
}

/** One-shot: expand ${HOME}, normalize separators for OS, collapse to ~, then ellipsize for UI. */
export async function prettyPath(raw: string, max = 48): Promise<string> {
  const [home, win] = await Promise.all([getHomeDir(), isWindows()]);
  const expanded = expandHomeToken(raw, home);
  const norm = normalizeSeparatorsForOS(expanded, win);
  const collapsed = collapseToTilde(norm, home);
  return middleEllipsis(collapsed, max);
}

/** Handy basename for labels (no Node path module on the client). */
export function basename(p: string): string {
  if (!p) return p;
  const s = p.replace(/\\/g, '/').replace(/\/+$/, '');
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

/** Get the path to the pinned folders configuration file. */
export async function getPinnedConfigPath(): Promise<string> {
  try {
    return await invoke<string>('get_pinned_config_path');
  } catch (error) {
    console.error('Failed to get pinned config path:', error);
    return 'Unable to determine config path';
  }
}
