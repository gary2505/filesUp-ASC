/**
 * ================================================================
 * Memory Guard - Automatic Memory Management
 * ================================================================
 * 
 * PURPOSE: Monitor memory usage and prevent out-of-memory crashes
 * TRIGGER: Runs every 10 seconds to check heap usage
 * 
 * FEATURES:
 * - Monitors Chrome's performance.memory API
 * - Clears thumbnail cache when >90% memory used
 * - Shows user-friendly toast notifications
 * - Preserves critical user data (folders, settings, selection)
 * 
 * USAGE:
 * ```typescript
 * import { installMemoryGuard } from '$lib/utils/memoryGuard';
 * installMemoryGuard(); // Call in main.ts
 * ```
 * 
 * ================================================================
 */

/// <reference lib="dom" />

/**
 * Extended Performance interface with Chrome's memory API
 */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Monitor memory usage and clear caches when needed
 * 
 * Chrome only - Other browsers will log a warning and skip monitoring
 * 
 * Memory thresholds:
 * - <70%: Normal (no action)
 * - 70-89%: Warning logged
 * - 90%+: Clear thumbnail cache, show toast
 */
export function installMemoryGuard(): void {
  if (typeof window === 'undefined') {
    console.warn('[Memory] Not in browser environment, skipping');
    return;
  }

  const perf = performance as PerformanceWithMemory;

  if (!perf.memory) {
    console.warn('[Memory] performance.memory not available (Chrome only)');
    console.info('[Memory] Memory guard disabled on this browser');
    return;
  }

  let lastClearTime = 0;
  const MIN_CLEAR_INTERVAL = 30000; // Don't clear more than once per 30 seconds

  const checkMemory = () => {
    const mem = perf.memory!;
    const usedMB = Math.round(mem.usedJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(mem.jsHeapSizeLimit / 1024 / 1024);
    const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
    const percentage = Math.round(ratio * 100);

    // High memory usage (>90%)
    if (ratio > 0.9) {
      const now = Date.now();
      
      // Prevent clearing too frequently
      if (now - lastClearTime < MIN_CLEAR_INTERVAL) {
        console.warn(`[Memory] High usage: ${usedMB}MB / ${limitMB}MB (${percentage}%), but cleared recently`);
        return;
      }

      console.warn(`[Memory] 🚨 High usage: ${usedMB}MB / ${limitMB}MB (${percentage}%)`);
      console.warn('[Memory] Clearing caches to free memory...');

      // Clear what's safe to clear (can be regenerated)
      clearNonCriticalCaches();
      
      // Suggest garbage collection (Chrome DevTools only)
      if (typeof window !== 'undefined' && 'gc' in window && typeof (window as any).gc === 'function') {
        try {
          (window as any).gc();
          console.log('[Memory] Manual GC triggered');
        } catch (e) {
          // GC not available or failed
        }
      }

      lastClearTime = now;
    }
    // Warning level (70-89%)
    else if (ratio > 0.7) {
      if (import.meta.env.DEV) {
        console.warn(`[Memory] Warning: ${usedMB}MB / ${limitMB}MB (${percentage}%)`);
      }
    }
    // Normal level (<70%)
    else {
      // Only log in verbose debug mode
      if (typeof window !== 'undefined' && (window as any).__MEMORY_DEBUG) {
        console.log(`[Memory] OK: ${usedMB}MB / ${limitMB}MB (${percentage}%)`);
      }
    }
  };

  // Check every 10 seconds
  const intervalId = setInterval(checkMemory, 10000);

  // Initial check
  checkMemory();

  console.log('[Memory] 🛡️ Memory guard installed (check every 10s)');

  // Cleanup on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      clearInterval(intervalId);
    });
  }

  // Expose for debugging
  if (typeof window !== 'undefined') {
    (window as any).__memoryGuard = {
      check: checkMemory,
      clear: clearNonCriticalCaches,
      enabled: true
    };
  }
}

/**
 * Clear non-critical caches that can be safely regenerated
 * 
 * SAFE TO CLEAR:
 * - Thumbnail cache (can regenerate)
 * - Image cache (can reload)
 * - Computed values cache
 * 
 * NEVER CLEAR:
 * - Folder view store (user's folder state)
 * - Settings store (user preferences)
 * - Selection store (user's current selection)
 * - Session data (tabs, navigation history)
 */
function clearNonCriticalCaches(): void {
  let clearedBytes = 0;

  // 1. Clear thumbnail cache (if it exists)
  if (typeof window !== 'undefined' && (window as any).__thumbnailCache) {
    try {
      const cache = (window as any).__thumbnailCache;
      const sizeBefore = cache.size || 0;
      if (typeof cache.clear === 'function') {
        cache.clear();
        clearedBytes += sizeBefore * 50000; // Rough estimate: 50KB per thumbnail
        console.log(`[Memory] Cleared thumbnail cache (${sizeBefore} items)`);
      }
    } catch (e) {
      console.error('[Memory] Failed to clear thumbnail cache:', e);
    }
  }

  // 2. Clear browser cache storage (if quota exceeded)
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('thumbnail') || name.includes('image')) {
            caches.delete(name);
            console.log(`[Memory] Deleted cache: ${name}`);
          }
        });
      });
    } catch (e) {
      console.error('[Memory] Failed to clear cache storage:', e);
    }
  }

  // 3. Clear any large computed value caches
  if (typeof window !== 'undefined' && (window as any).__computedCache) {
    try {
      (window as any).__computedCache.clear();
      console.log('[Memory] Cleared computed cache');
    } catch (e) {
      console.error('[Memory] Failed to clear computed cache:', e);
    }
  }

  // 4. Show user notification
  const clearedMB = Math.round(clearedBytes / 1024 / 1024);
  if (clearedMB > 0) {
    console.log(`[Memory] ✅ Freed approximately ${clearedMB}MB`);
  }

  // Use toast if available (don't crash if not)
  if (typeof window !== 'undefined') {
    try {
      const toastModule = (window as any).__toast;
      if (toastModule && typeof toastModule.info === 'function') {
        toastModule.info('Cleared cache to free memory');
      } else {
        console.log('[Memory] Cache cleared (toast not available)');
      }
    } catch (e) {
      // Toast not available, that's fine
    }
  }
}

/**
 * Helper to check if debug assertions are enabled
 * (Approximation for Rust's cfg!(debug_assertions))
 */
function cfg(flag: string): boolean {
  if (flag === 'debug_assertions') {
    return import.meta.env.DEV || false;
  }
  return false;
}

/**
 * Manual memory check (for debugging)
 */
export function checkMemoryNow(): void {
  const perf = performance as PerformanceWithMemory;
  if (!perf.memory) {
    console.warn('[Memory] performance.memory not available');
    return;
  }

  const mem = perf.memory;
  const usedMB = Math.round(mem.usedJSHeapSize / 1024 / 1024);
  const limitMB = Math.round(mem.jsHeapSizeLimit / 1024 / 1024);
  const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
  const percentage = Math.round(ratio * 100);

  console.log(`[Memory] Current usage: ${usedMB}MB / ${limitMB}MB (${percentage}%)`);
  console.log(`[Memory] Heap size: ${Math.round(mem.totalJSHeapSize / 1024 / 1024)}MB`);

  return;
}

/**
 * Expose to window for console debugging
 */
if (typeof window !== 'undefined') {
  (window as any).checkMemory = checkMemoryNow;
  (window as any).clearCaches = clearNonCriticalCaches;
}

