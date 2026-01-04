/**
 * This is src/lib/utils/settings.extended.ts
 * Used by: src/lib/stores/settings.extended.ts, src/App.svelte, src/lib/P3/SimpleFileList.svelte, src/lib/P2/parts/deleteWorkflow.ts, src/lib/cache/dirCache.ts, src/lib/services/autoWatchManager.ts
 * Purpose: Defines extended TypeScript type definitions for performance, UI, panel, and grouping settings
 * Trigger: Settings stores and components import types for configuration
 * Event Flow: Import types → settings stores create reactive stores → components consume settings → mergeSettings() combines base + extended → type guards validate structure
 * List of functions: isExtendedSettings, mergeSettings
 */

/**
 * This is settings.extended.ts
 * Used by: $lib/stores/settings.extended.ts, App.svelte, $lib/P3/SimpleFileList.svelte, $lib/P2/parts/deleteWorkflow.ts, $lib/cache/dirCache.ts, $lib/services/autoWatchManager.ts
 * Purpose: Defines extended TypeScript type definitions for performance, UI, panel, and grouping settings beyond base Settings type
 * Trigger: Settings stores and components import types for configuration
 * Event Flow: Import types → settings stores create reactive stores → components consume settings → mergeSettings() combines base + extended with defaults
 * Functions: isExtendedSettings(settings) - type guard, mergeSettings(base, extended) - combines base + extended with defaults
 * 
 * Extended Settings Type Definitions
 * Adds performance, cache, and UI configuration to existing Settings
 * 
 * Used by: GPS, DirectoryCache, ThumbnailQueue, Settings UI
 * Purpose: Type-safe configuration for new production features
 */

import type { Settings as BaseSettings } from '$lib/tauri/settings';

/**
 * Performance configuration for caching and background operations
 */
export interface PerformanceSettings {
  // Directory cache configuration
  cache: {
    enabled: boolean;
    maxFolders: number;        // LRU size (default: 50)
    ttlSeconds: number;         // Time-to-live (default: 30)
    preloadSubfolders: boolean; // Preload children in background
  };
  
  // Thumbnail generation
  thumbnails: {
    enabled: boolean;
    maxConcurrent: number;      // Parallel workers (default: 3)
    cacheSize: number;          // Max cached thumbnails (default: 200)
    quality: 'low' | 'medium' | 'high';
  };
  
  // File system watcher
  watcher: {
    enabled: boolean;
    autoWatch: boolean;         // Auto-watch active panels
    debounceMs: number;         // Event debounce (default: 2000)
  };
  
  // Operation timeouts
  timeouts: {
    defaultMs: number;          // Default operation timeout (30000)
    longRunningMs: number;      // For large operations (60000)
    quickMs: number;            // For fast operations (5000)
  };
}

/**
 * UI behavior configuration
 */
export interface UISettings {
  // Smart loading and cancellation
  smartEvents: {
    enabled: boolean;
    debounceMs: number;         // Event debounce (default: 100)
    autoCancelPrevious: boolean; // Cancel stale operations
  };
  
  // Virtual scrolling
  virtualScroll: {
    enabled: boolean;
    itemHeight: number;         // Fixed item height (default: 32)
    overscan: number;           // Extra items to render (default: 5)
  };
  
  // View preferences
  views: {
    defaultMode: 'details' | 'list' | 'grid' | 'gallery';
    showThumbnailsInDetails: boolean;
    rememberPerFolder: boolean;  // Remember view mode per folder
  };
  
  // Loading states
  loading: {
    showSkeletons: boolean;     // Show loading skeletons
    minDelayMs: number;         // Min time to show loader (avoid flicker)
  };
}

/**
 * Panel-specific configuration
 */
export interface PanelSettings {
  // Auto-watch active panels
  autoWatch: {
    P1: boolean;  // Always watch left panel
    P2: boolean;  // Watch right panel when active
    P3: boolean;  // Watch bottom panel when active
  };
  
  // Panel sync behavior
  sync: {
    enabled: boolean;
    syncSelection: boolean;
    syncScroll: boolean;
  };
  
  // Layout preferences
  layout: {
    defaultSplit: 'vertical' | 'horizontal';
    showP3ByDefault: boolean;
    rememberSize: boolean;
  };
}

/**
 * Grouping and sorting preferences
 */
export interface GroupingSettings {
  // Default grouping strategies
  defaults: {
    images: 'date' | 'size' | 'none';
    videos: 'date' | 'size' | 'none';
    documents: 'date' | 'type' | 'none';
    code: 'type' | 'none';
    other: 'none';
  };
  
  // Group display
  display: {
    showGroupHeaders: boolean;
    showGroupCounts: boolean;
    collapseEmptyGroups: boolean;
  };
}

/**
 * Extended Settings combining base + new features
 */
export interface ExtendedSettings extends BaseSettings {
  performance: PerformanceSettings;
  ui: UISettings;
  panels: PanelSettings;
  grouping: GroupingSettings;
  
  // Metadata (version is inherited from BaseSettings)
  lastModified: number; // Timestamp
}

/**
 * Default values for extended settings
 */
export const defaultExtendedSettings: Omit<ExtendedSettings, keyof BaseSettings> = {
  performance: {
    cache: {
      enabled: true,
      maxFolders: 50,
      ttlSeconds: 30,
      preloadSubfolders: false,
    },
    thumbnails: {
      enabled: true,
      maxConcurrent: 3,
      cacheSize: 200,
      quality: 'medium',
    },
    watcher: {
      enabled: true,
      autoWatch: true,
      debounceMs: 2000,
    },
    timeouts: {
      defaultMs: 30000,
      longRunningMs: 60000,
      quickMs: 5000,
    },
  },
  
  ui: {
    smartEvents: {
      enabled: true,
      debounceMs: 100,
      autoCancelPrevious: true,
    },
    virtualScroll: {
      enabled: true,
      itemHeight: 32,
      overscan: 5,
    },
    views: {
      defaultMode: 'details',
      showThumbnailsInDetails: false,
      rememberPerFolder: true,
    },
    loading: {
      showSkeletons: true,
      minDelayMs: 150,
    },
  },
  
  panels: {
    autoWatch: {
      P1: true,
      P2: true,
      P3: false,
    },
    sync: {
      enabled: false,
      syncSelection: false,
      syncScroll: false,
    },
    layout: {
      defaultSplit: 'vertical',
      showP3ByDefault: false,
      rememberSize: true,
    },
  },
  
  grouping: {
    defaults: {
      images: 'date',
      videos: 'date',
      documents: 'type',
      code: 'type',
      other: 'none',
    },
    display: {
      showGroupHeaders: true,
      showGroupCounts: true,
      collapseEmptyGroups: false,
    },
  },
  
  lastModified: Date.now(),
};

/**
 * Type guard to check if settings are extended
 */
export function isExtendedSettings(settings: any): settings is ExtendedSettings {
  return settings && 
         typeof settings === 'object' &&
         'performance' in settings &&
         'ui' in settings &&
         'panels' in settings &&
         'grouping' in settings;
}

/**
 * Merge base settings with extended settings
 */
export function mergeSettings(base: BaseSettings, extended?: Partial<Omit<ExtendedSettings, keyof BaseSettings>>): ExtendedSettings {
  return {
    ...base,
    ...defaultExtendedSettings,
    ...extended,
    lastModified: Date.now(),
  };
}
