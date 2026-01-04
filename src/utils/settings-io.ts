/**
 * This is src/lib/utils/settings-io.ts
 * Used by: src/lib/stores/sessionRestore.ts, src/lib/components/layout/SideBar.svelte
 * Purpose: Handles reading/writing app settings with caching and validation
 * Trigger: Called to get/save/reset settings
 * Event Flow: Invokes Tauri commands, caches results, validates data
 * List of functions: getSettings, setSettings, saveSettings, resetSettings, invalidateSettingsCache
 */

import { invokeSafe } from './invokeSafe';
import { waitTauriReady } from './tauriReady';

// Settings cache and ready state (prevents premature writes)
let settingsCache: any | undefined;
let settingsReady = false;

// Helper functions for settings validation and defaults (Patch 2)
function createDefaultSettings() {
  return {
    version: "1.0",
    panels: { P1: {}, P2: {}, P3: {} },
    ui: { theme: "dark" },
    created: Date.now()
  };
}

function validateAndHealSettings(data: any) {
  if (!data || typeof data !== 'object') return createDefaultSettings();
  
  // Ensure required structure exists
  return {
    ...createDefaultSettings(),
    ...data,
    panels: {
      P1: data.panels?.P1 || {},
      P2: data.panels?.P2 || {},
      P3: data.panels?.P3 || {}
    }
  };
}

// Rewritten getSettings to never return undefined/corrupt data (Patch 2)
export async function getSettings(): Promise<any> {
  // Return cached settings if available
  if (settingsCache) {
    return settingsCache;
  }
  console.log('[Settings-IO] 🚀 STARTING getSettings()');
  try {
    await waitTauriReady(); // Ensure bridge is ready (Patch 2)
    console.log('[Settings-IO] 🔧 CALLING invokeSafe("read_settings")...');
    const result = await invokeSafe<string>("read_settings");
    console.log('[Settings-IO] 📦 INVOKE RESULT:', {
      resultType: typeof result,
      resultValue: result,
      isUndefined: result === undefined,
      isNull: result === null,
      resultLength: typeof result === 'string' ? result.length : 'not-string'
    });
    
    if (!result || result === 'null' || result === 'undefined') {
      console.warn('[Settings-IO] ❌ Settings empty, using defaults');
      return createDefaultSettings();
    }
    
    console.log('[Settings-IO] 🔧 CALLING JSON.parse()...');
    const parsed = JSON.parse(result);
    console.log('[Settings-IO] ✅ JSON PARSE SUCCESS:', {
      parsedType: typeof parsed,
      parsedKeys: parsed ? Object.keys(parsed) : null
    });
    const validated = validateAndHealSettings(parsed);
    
    // Cache settings and mark as ready
    settingsCache = validated;
    settingsReady = true;
    
    return validated;
  } catch (error) {
    console.error('[Settings-IO] ❌ Settings read failed, using defaults:', error);
    console.error('[Settings-IO] 🔥 ERROR DETAILS:', {
      errorName: (error as any)?.name,
      errorMessage: (error as any)?.message,
      errorStack: (error as any)?.stack
    });
    const defaults = createDefaultSettings();
    
    // Cache defaults and mark as ready
    settingsCache = defaults;
    settingsReady = true;
    
    return defaults;
  }
}

export async function setSettings(settings: object): Promise<void> {
  // Don't write settings until first load is complete
  if (!settingsReady) {
    console.warn('[Settings-IO] ⚠️ Skipping write - settings not ready yet');
    return;
  }
  
  try {
    await invokeSafe("write_settings", { settings: JSON.stringify(settings, null, 2) }, { allowNull: true });
    // Update cache after successful write
    settingsCache = settings;
  } catch (error) {
    console.error('[Settings] Failed to write settings:', error);
    throw error;
  }
}

export async function resetSettings(): Promise<void> {
  try {
    await invokeSafe("reset_settings", undefined, { allowNull: true });
    // Invalidate cache after reset
    settingsCache = undefined;
    settingsReady = false;
  } catch (error) {
    console.error('[Settings] Failed to reset settings:', error);
    throw error;
  }
}

/**
 * Invalidate the settings cache (forces reload on next getSettings())
 * Useful for testing or when external processes modify settings
 */
export function invalidateSettingsCache(): void {
  settingsCache = undefined;
  settingsReady = false;
  console.log('[Settings-IO] 🔄 Settings cache invalidated');
}

export async function getSettingsPath(): Promise<string> {
  try {
    const result = await invokeSafe<string>("get_settings_path");
    if (result === undefined) {
      throw new Error('Failed to get settings path: invoke returned undefined');
    }
    return result;
  } catch (error) {
    console.error('[Settings] Failed to get settings path:', error);
    throw error;
  }
}

function getValueByPath(source: any, path: string, fallback: any): any {
  if (!source) return fallback;
  if (!path.includes('.')) {
    return source[path] !== undefined ? source[path] : fallback;
  }
  const parts = path.split('.');
  let cursor = source;
  for (const part of parts) {
    if (cursor == null) return fallback;
    cursor = cursor[part];
  }
  return cursor !== undefined ? cursor : fallback;
}

function setValueByPath(settings: any, path: string, value: any): any {
  if (!path.includes('.')) {
    return { ...settings, [path]: value };
  }
  const parts = path.split('.');
  const clone = { ...settings };
  let cursor: any = clone;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (i === parts.length - 1) {
      cursor[key] = value;
    } else {
      const next = cursor[key];
      cursor[key] = Array.isArray(next)
        ? [...next]
        : typeof next === 'object' && next !== null
        ? { ...next }
        : {};
      cursor = cursor[key];
    }
  }
  return clone;
}

// Helper function to get a specific setting with default fallback
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const settings = await getSettings();
    return getValueByPath(settings, key, defaultValue);
  } catch {
    return defaultValue;
  }
}

// Helper function to set a specific setting
export async function setSetting(key: string, value: any): Promise<void> {
  try {
    const settings = await getSettings();
    const updated = setValueByPath(settings, key, value);
    await setSettings(updated);
  } catch (error) {
    console.error(`[Settings] Failed to set ${key}:`, error);
    throw error;
  }
}
