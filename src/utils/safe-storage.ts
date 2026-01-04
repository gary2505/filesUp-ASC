/**
 * This is src/lib/utils/safe-storage.ts
 * Used by: src/lib/stores/sessionRestore.ts, src/lib/components/layout/SideBar.svelte
 * Purpose: Safe localStorage operations that never throw
 * Trigger: Called for storing/retrieving data
 * Event Flow: Try operations, fallback on errors
 * List of functions: safeJSONParse, safeJSONStringify, safeLocalStorageGet, safeLocalStorageSet, clearLocalStorageWithPrefix, isLocalStorageAvailable
 */

/**
 * Bulletproof JSON utilities that never throw errors
 * All localStorage operations should use these functions
 */

/**
 * Safely parse JSON with fallback
 * @param jsonString - The JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJSONParse<T>(jsonString: string | null, fallback: T): T {
  try {
    if (!jsonString) {
      console.log('[SafeJSON] Empty string, using fallback');
      return fallback;
    }
    
    const parsed = JSON.parse(jsonString);
    if (parsed === null || parsed === undefined) {
      console.log('[SafeJSON] Parsed null/undefined, using fallback');
      return fallback;
    }
    
    return parsed as T;
    
  } catch (error) {
    console.warn('[SafeJSON] Parse failed, using fallback:', error);
    return fallback;
  }
}

/**
 * Safely stringify JSON
 * @param value - Value to stringify
 * @returns JSON string or null if failed
 */
export function safeJSONStringify(value: any): string | null {
  try {
    if (value === undefined) {
      console.log('[SafeJSON] Cannot stringify undefined');
      return null;
    }
    
    return JSON.stringify(value);
    
  } catch (error) {
    console.warn('[SafeJSON] Stringify failed:', error);
    return null;
  }
}

/**
 * Safely get item from localStorage
 * @param key - localStorage key
 * @param fallback - Fallback value if retrieval fails
 * @returns Retrieved and parsed value or fallback
 */
export function safeLocalStorageGet<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') {
      console.log('[SafeLocalStorage] SSR context, using fallback for key:', key);
      return fallback;
    }
    
    if (!window.localStorage) {
      console.log('[SafeLocalStorage] localStorage not available, using fallback for key:', key);
      return fallback;
    }
    
    const raw = localStorage.getItem(key);
    return safeJSONParse(raw, fallback);
    
  } catch (error) {
    console.warn('[SafeLocalStorage] Get failed for key:', key, error);
    return fallback;
  }
}

/**
 * Safely set item in localStorage
 * @param key - localStorage key
 * @param value - Value to store
 * @returns true if successful, false otherwise
 */
export function safeLocalStorageSet(key: string, value: any): boolean {
  try {
    if (typeof window === 'undefined') {
      console.log('[SafeLocalStorage] SSR context, cannot save key:', key);
      return false;
    }
    
    if (!window.localStorage) {
      console.log('[SafeLocalStorage] localStorage not available, cannot save key:', key);
      return false;
    }
    
    const jsonString = safeJSONStringify(value);
    if (jsonString === null) {
      console.warn('[SafeLocalStorage] Failed to stringify value for key:', key);
      return false;
    }
    
    localStorage.setItem(key, jsonString);
    console.log('[SafeLocalStorage] Successfully saved key:', key);
    return true;
    
  } catch (error) {
    console.warn('[SafeLocalStorage] Set failed for key:', key, error);
    return false;
  }
}

/**
 * Safely remove item from localStorage
 * @param key - localStorage key
 * @returns true if successful, false otherwise
 */
export function safeLocalStorageRemove(key: string): boolean {
  try {
    if (typeof window === 'undefined') {
      console.log('[SafeLocalStorage] SSR context, cannot remove key:', key);
      return false;
    }
    
    if (!window.localStorage) {
      console.log('[SafeLocalStorage] localStorage not available, cannot remove key:', key);
      return false;
    }
    
    localStorage.removeItem(key);
    console.log('[SafeLocalStorage] Successfully removed key:', key);
    return true;
    
  } catch (error) {
    console.warn('[SafeLocalStorage] Remove failed for key:', key, error);
    return false;
  }
}

/**
 * Check if localStorage is available and working
 * @returns true if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!window.localStorage) return false;
    
    // Test write/read/remove
    const testKey = '__filesup_test__';
    const testValue = 'test';
    
    localStorage.setItem(testKey, testValue);
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    return retrieved === testValue;
    
  } catch (error) {
    console.warn('[SafeLocalStorage] Availability test failed:', error);
    return false;
  }
}

/**
 * Get all localStorage keys that match a prefix
 * @param prefix - Key prefix to match
 * @returns Array of matching keys
 */
export function getLocalStorageKeysWithPrefix(prefix: string): string[] {
  try {
    if (!isLocalStorageAvailable()) return [];
    
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    
    return keys;
    
  } catch (error) {
    console.warn('[SafeLocalStorage] Failed to get keys with prefix:', prefix, error);
    return [];
  }
}

/**
 * Clear all localStorage keys that match a prefix
 * @param prefix - Key prefix to match
 * @returns Number of keys removed
 */
export function clearLocalStorageWithPrefix(prefix: string): number {
  try {
    const keys = getLocalStorageKeysWithPrefix(prefix);
    let removed = 0;
    
    keys.forEach(key => {
      if (safeLocalStorageRemove(key)) {
        removed++;
      }
    });
    
    console.log(`[SafeLocalStorage] Cleared ${removed} keys with prefix: ${prefix}`);
    return removed;
    
  } catch (error) {
    console.warn('[SafeLocalStorage] Failed to clear keys with prefix:', prefix, error);
    return 0;
  }
}
