/**
 * lib/tauri/settings.ts - Application Settings Management System
 * 
 * Used by: SettingsModal.svelte, mypc.store.ts, startupOrchestrator.ts (referenced)
 * Purpose: Centralized settings management with Rust backend persistence and frontend caching
 * Trigger: Application startup, user settings changes, component configuration requests
 * Event Flow:
 *   1. loadSettings() - Cache-first retrieval from Rust backend via Tauri IPC
 *   2. Frontend requests setting values through getSetting() or convenience functions
 *   3. User modifies settings through UI components (SettingsModal)
 *   4. saveSettings() - Merges changes and persists to Rust backend
 *   5. Cache updated and changes propagated to consuming components
 * 
 * Architecture: Safe settings system using only Tauri invoke commands for maximum reliability
 * Features: TypeScript⟷Rust serialization, in-memory caching, grouped settings organization,
 * type-safe getters/setters, fallback to defaults on backend failures
 * 
 * Settings Categories: General, Layout, Files & Folders, Appearance, Actions, About
 * Backend Integration: Uses snake_case⟷camelCase conversion for Rust interop
 */
import { invoke } from '$lib/tauri/ipc';

export interface SystemSettings {
  showStatusBarMetrics: boolean;
  cpuMemIntervalMs: number;
  diskCheckIntervalSec: number;
  diskWarnThresholdPercent: number;
  cpuWarnThresholdPercent: number;
  ramWarnThresholdPercent: number;
}

export type Settings = {
  confirmDeleteFiles: boolean;
  showHiddenFiles: boolean;
  showFileExtensions: boolean;
  showAlternateDataStreams: boolean;
  showHiddenFolders: boolean;
  showSystemFiles: boolean;
  activeTabId: string;
  theme: string;
  fontFamily: string;
  language: string;
  autoSave: boolean;
  sidebarWidth: number;
  panelLayout: string;
  toolbarPosition: string;
  sidebarPosition: string;
  showStatusBar: boolean;
  showTabBarWhenOnlyOneTab: boolean;
  rememberPanelSizesPerTab: boolean;
  showBookmarksBar: boolean;
  sortBy: string;
  sortOrder: string;
  fontSize: string;  // Font size preset (e.g., 'medium', 'xs', 'small', 'large', 'xl')
  iconSize: string;  // Icon size preset (e.g., "medium", "small", "large", "extra-large", "none")
  iconStyle: string;  // Icon style (e.g., "filled", "outline")
  folderIconColor: string;  // Folder icon color (e.g., "default", "custom")
  fileIconColor: string;  // File icon color (e.g., "default", "custom")
  rowStyle: string;  // Row style (e.g., "zebra", "none")
  showIcons: boolean;
  confirmCopy: boolean;
  confirmMove: boolean;
  confirmRename: boolean;
  doubleClickEmptyGoesParent: boolean;
  showMovedNotification: boolean;
  showCopiedNotification: boolean;
  playSoundOnError: boolean;
  autoSanitizeNames: boolean;
  autoRefresh: boolean;
  checkUpdates: boolean;
  showDeleteSnackbar: boolean;
  showCopyPasteSnackbar: boolean;
  showCutPasteSnackbar: boolean;
  snackbarDuration: number;
  toastPosition: 'center' | 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
  toastDurationSeconds: number;
  toastDefaultStyle: 'warning' | 'neutral' | 'error';
  toastColorMode: 'accent' | 'manual';
  toastShowProgressBar: boolean;
  toastShowDeleteForever: boolean;
  toastShowUndoButton: boolean;
  showRowInlineActions: boolean;
  smartPrimaryRowAction: boolean;
  showPasteRenameDialog: boolean;
  pasteRenamePattern: 'os-default' | 'name-n' | 'name-copy-n' | 'name-paren-n' | 'name-padded-n' | 'name-dash-n';
  showProtectedSystemFolders: boolean;
  showDotFolders: boolean;
  openFoldersWith: 'single-click' | 'double-click';
  openFoldersInNewTab: boolean;
  enableCustomIcons: boolean;
  preferThumbnails: boolean;
  showThumbnailsListView: boolean;
  showThumbnailsDetailsView: boolean;
  hideBackupFiles: boolean;
  hideTemporaryFiles: boolean;
  hideOsMetadataFiles: boolean;
  hideVersionControlFolders: boolean;
  useOSIcons: boolean;
  telemetryEnabled: boolean;
  systemDebugLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  dateFormat: string;
  startBehavior: string;
  launchAtStartup: boolean;
  newTabBehavior: string;
  crashReportLevel: string;
  system: SystemSettings;
};

export const defaultSettings: Settings = {
  confirmDeleteFiles: true,
  showHiddenFiles: false,
  showFileExtensions: true,
  showAlternateDataStreams: false,
  showHiddenFolders: false,
  showSystemFiles: false,
  activeTabId: '1',
  theme: 'light',
  fontFamily: 'system-ui',
  language: 'en',
  autoSave: true,
  sidebarWidth: 250,
  panelLayout: 'treeLeftPreviewRight',
  toolbarPosition: 'left',
  sidebarPosition: 'left',
  showStatusBar: true,
  showTabBarWhenOnlyOneTab: false,
  rememberPanelSizesPerTab: true,
  showBookmarksBar: true,
  sortBy: 'name',
  sortOrder: 'asc',
  fontSize: 'medium',  // Default font size preset
  iconSize: 'medium',  // Default icon size preset
  iconStyle: 'filled',  // Default icon style
  folderIconColor: '',  // Empty = default/system color
  fileIconColor: '',  // Empty = default/system color
  rowStyle: 'zebra',  // Default row style
  showIcons: true,
  confirmCopy: false,
  confirmMove: true,
  confirmRename: false,
  doubleClickEmptyGoesParent: true,
  showMovedNotification: true,
  showCopiedNotification: true,
  playSoundOnError: false,
  autoSanitizeNames: true,
  autoRefresh: true,
  checkUpdates: true,
  showDeleteSnackbar: true,
  showCopyPasteSnackbar: true,
  showCutPasteSnackbar: true,
  snackbarDuration: 3,
  toastPosition: 'center',
  toastDurationSeconds: 4,
  toastDefaultStyle: 'warning',
  toastColorMode: 'manual',
  toastShowProgressBar: true,
  toastShowDeleteForever: true,
  toastShowUndoButton: true,
  showRowInlineActions: true,
  smartPrimaryRowAction: true,
  showPasteRenameDialog: true,
  pasteRenamePattern: 'os-default',
  showProtectedSystemFolders: false,
  showDotFolders: false,
  openFoldersWith: 'double-click',
  openFoldersInNewTab: false,
  enableCustomIcons: true,
  preferThumbnails: true,
  showThumbnailsListView: true,
  showThumbnailsDetailsView: true,
  hideBackupFiles: true,
  hideTemporaryFiles: true,
  hideOsMetadataFiles: true,
  hideVersionControlFolders: true,
  useOSIcons: false,
  telemetryEnabled: true,
  systemDebugLevel: 3,
  dateFormat: 'YYYY-MM-DD',
  startBehavior: 'lastSession',
  launchAtStartup: false,
  newTabBehavior: 'home',
  crashReportLevel: 'crashOnly',
  system: {
    showStatusBarMetrics: true,
    cpuMemIntervalMs: 1000,
    diskCheckIntervalSec: 60,
    diskWarnThresholdPercent: 95,
    cpuWarnThresholdPercent: 95,
    ramWarnThresholdPercent: 95,
  },
};

export type AppSettings = Settings;

let cache: Settings | null = null;

function getValueByPath<T = unknown>(source: any, path: string, fallback?: T): T {
  if (!source) return fallback as T;
  if (!path.includes('.')) {
    return (source[path] ?? fallback) as T;
  }
  const parts = path.split('.');
  let cursor: any = source;
  for (const part of parts) {
    if (cursor == null) return fallback as T;
    cursor = cursor[part];
  }
  return (cursor ?? fallback) as T;
}

function setValueByPath(target: Settings, path: string, value: unknown): Settings {
  if (!path.includes('.')) {
    return { ...target, [path]: value } as Settings;
  }
  const parts = path.split('.');
  const clone: Settings = { ...target };
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

/**
 * Convert from Rust snake_case to TypeScript camelCase
 */
function rustToJs(rustSettings: any): Settings {
  const systemRaw = rustSettings.system ?? {};
  return {
    confirmDeleteFiles:
      rustSettings.confirm_delete_files ??
      rustSettings.ask_before_delete ??
      defaultSettings.confirmDeleteFiles,
    showHiddenFiles: rustSettings.show_hidden_files ?? defaultSettings.showHiddenFiles,
    showFileExtensions: rustSettings.show_file_extensions ?? defaultSettings.showFileExtensions,
    showAlternateDataStreams: rustSettings.show_alternate_data_streams ?? defaultSettings.showAlternateDataStreams,
    showHiddenFolders: rustSettings.show_hidden_folders ?? defaultSettings.showHiddenFolders,
    showSystemFiles: rustSettings.show_system_files ?? defaultSettings.showSystemFiles,
    activeTabId: rustSettings.active_tab_id ?? defaultSettings.activeTabId,
    theme: rustSettings.theme ?? defaultSettings.theme,
    fontFamily: rustSettings.font_family ?? defaultSettings.fontFamily,
    language: rustSettings.language ?? defaultSettings.language,
    autoSave: rustSettings.auto_save ?? defaultSettings.autoSave,
    sidebarWidth: rustSettings.sidebar_width ?? defaultSettings.sidebarWidth,
    panelLayout: rustSettings.panel_layout ?? defaultSettings.panelLayout,
    toolbarPosition: rustSettings.toolbar_position ?? defaultSettings.toolbarPosition,
    sidebarPosition: rustSettings.sidebar_position ?? defaultSettings.sidebarPosition,
    showStatusBar: rustSettings.show_status_bar ?? defaultSettings.showStatusBar,
    showTabBarWhenOnlyOneTab: rustSettings.show_tab_bar_when_only_one_tab ?? defaultSettings.showTabBarWhenOnlyOneTab,
    rememberPanelSizesPerTab: rustSettings.remember_panel_sizes_per_tab ?? defaultSettings.rememberPanelSizesPerTab,
    showBookmarksBar: rustSettings.show_bookmarks_bar ?? defaultSettings.showBookmarksBar,
    sortBy: rustSettings.sort_by ?? defaultSettings.sortBy,
    sortOrder: rustSettings.sort_order ?? defaultSettings.sortOrder,
    fontSize: rustSettings.font_size ?? defaultSettings.fontSize,  // string from Rust
    iconSize: rustSettings.icon_size ?? defaultSettings.iconSize,
    iconStyle: rustSettings.icon_style ?? defaultSettings.iconStyle,
    folderIconColor: rustSettings.folder_icon_color ?? defaultSettings.folderIconColor,
    fileIconColor: rustSettings.file_icon_color ?? defaultSettings.fileIconColor,
    rowStyle: rustSettings.row_style ?? defaultSettings.rowStyle,
    showIcons: rustSettings.show_icons ?? defaultSettings.showIcons,
    confirmCopy: rustSettings.confirm_copy ?? defaultSettings.confirmCopy,
    confirmMove: rustSettings.confirm_move ?? defaultSettings.confirmMove,
    confirmRename: rustSettings.confirm_rename ?? defaultSettings.confirmRename,
    doubleClickEmptyGoesParent: rustSettings.double_click_empty_goes_parent ?? defaultSettings.doubleClickEmptyGoesParent,
    showMovedNotification: rustSettings.show_moved_notification ?? defaultSettings.showMovedNotification,
    showCopiedNotification: rustSettings.show_copied_notification ?? defaultSettings.showCopiedNotification,
    playSoundOnError: rustSettings.play_sound_on_error ?? defaultSettings.playSoundOnError,
    autoSanitizeNames: rustSettings.auto_sanitize_names ?? defaultSettings.autoSanitizeNames,
    autoRefresh: rustSettings.auto_refresh ?? defaultSettings.autoRefresh,
    checkUpdates: rustSettings.check_updates ?? defaultSettings.checkUpdates,
    showDeleteSnackbar: rustSettings.show_delete_snackbar ?? defaultSettings.showDeleteSnackbar,
    showCopyPasteSnackbar: rustSettings.show_copy_paste_snackbar ?? defaultSettings.showCopyPasteSnackbar,
    showCutPasteSnackbar: rustSettings.show_cut_paste_snackbar ?? defaultSettings.showCutPasteSnackbar,
    snackbarDuration: rustSettings.snackbar_duration ?? defaultSettings.snackbarDuration,
    toastPosition: rustSettings.toast_position ?? defaultSettings.toastPosition,
    toastDurationSeconds: rustSettings.toast_duration_seconds ?? defaultSettings.toastDurationSeconds,
    toastDefaultStyle: rustSettings.toast_default_style ?? defaultSettings.toastDefaultStyle,
    toastColorMode: rustSettings.toast_color_mode ?? defaultSettings.toastColorMode,
    toastShowProgressBar: rustSettings.toast_show_progress_bar ?? defaultSettings.toastShowProgressBar,
    toastShowDeleteForever: rustSettings.toast_show_delete_forever ?? defaultSettings.toastShowDeleteForever,
    toastShowUndoButton: rustSettings.toast_show_undo_button ?? defaultSettings.toastShowUndoButton,
    showRowInlineActions: rustSettings.show_row_inline_actions ?? defaultSettings.showRowInlineActions,
    smartPrimaryRowAction: rustSettings.smart_primary_row_action ?? defaultSettings.smartPrimaryRowAction,
    showPasteRenameDialog: rustSettings.show_paste_rename_dialog ?? defaultSettings.showPasteRenameDialog,
    pasteRenamePattern: rustSettings.paste_rename_pattern ?? defaultSettings.pasteRenamePattern,
    showProtectedSystemFolders: rustSettings.show_protected_system_folders ?? defaultSettings.showProtectedSystemFolders,
    showDotFolders: rustSettings.show_dot_folders ?? defaultSettings.showDotFolders,
    openFoldersWith: rustSettings.open_folders_with ?? defaultSettings.openFoldersWith,
    openFoldersInNewTab: rustSettings.open_folders_in_new_tab ?? defaultSettings.openFoldersInNewTab,
    enableCustomIcons: rustSettings.enable_custom_icons ?? defaultSettings.enableCustomIcons,
    preferThumbnails: rustSettings.prefer_thumbnails ?? defaultSettings.preferThumbnails,
    showThumbnailsListView: rustSettings.show_thumbnails_list_view ?? defaultSettings.showThumbnailsListView,
    showThumbnailsDetailsView: rustSettings.show_thumbnails_details_view ?? defaultSettings.showThumbnailsDetailsView,
    hideBackupFiles: rustSettings.hide_backup_files ?? defaultSettings.hideBackupFiles,
    hideTemporaryFiles: rustSettings.hide_temporary_files ?? defaultSettings.hideTemporaryFiles,
    hideOsMetadataFiles: rustSettings.hide_os_metadata_files ?? defaultSettings.hideOsMetadataFiles,
    hideVersionControlFolders: rustSettings.hide_version_control_folders ?? defaultSettings.hideVersionControlFolders,
    useOSIcons: rustSettings.use_os_icons ?? defaultSettings.useOSIcons,
    telemetryEnabled: rustSettings.telemetry_enabled ?? defaultSettings.telemetryEnabled,
    systemDebugLevel: rustSettings.system_debug_level ?? defaultSettings.systemDebugLevel,
    dateFormat: rustSettings.date_format ?? defaultSettings.dateFormat,
    startBehavior: rustSettings.start_behavior ?? defaultSettings.startBehavior,
    launchAtStartup: rustSettings.launch_at_startup ?? defaultSettings.launchAtStartup,
    newTabBehavior: rustSettings.new_tab_behavior ?? defaultSettings.newTabBehavior,
    crashReportLevel: rustSettings.crash_report_level ?? defaultSettings.crashReportLevel,
    system: {
      showStatusBarMetrics:
        systemRaw.show_status_bar_metrics ?? defaultSettings.system.showStatusBarMetrics,
      cpuMemIntervalMs: systemRaw.cpu_mem_interval_ms ?? defaultSettings.system.cpuMemIntervalMs,
      diskCheckIntervalSec:
        systemRaw.disk_check_interval_sec ?? defaultSettings.system.diskCheckIntervalSec,
      diskWarnThresholdPercent:
        systemRaw.disk_warn_threshold_percent ?? defaultSettings.system.diskWarnThresholdPercent,
      cpuWarnThresholdPercent:
        systemRaw.cpu_warn_threshold_percent ?? defaultSettings.system.cpuWarnThresholdPercent,
      ramWarnThresholdPercent:
        systemRaw.ram_warn_threshold_percent ?? defaultSettings.system.ramWarnThresholdPercent,
    },
  };
}

/**
 * Convert from TypeScript camelCase to Rust snake_case
 */
function jsToRust(jsSettings: Settings): any {
  return {
    confirm_delete_files: jsSettings.confirmDeleteFiles,
    show_hidden_files: jsSettings.showHiddenFiles,
    show_file_extensions: jsSettings.showFileExtensions,
    show_alternate_data_streams: jsSettings.showAlternateDataStreams,
    show_hidden_folders: jsSettings.showHiddenFolders,
    show_system_files: jsSettings.showSystemFiles,
    active_tab_id: jsSettings.activeTabId,
    theme: jsSettings.theme,
    font_family: jsSettings.fontFamily,
    language: jsSettings.language,
    auto_save: jsSettings.autoSave,
    sidebar_width: jsSettings.sidebarWidth,
    panel_layout: jsSettings.panelLayout,
    toolbar_position: jsSettings.toolbarPosition,
    sidebar_position: jsSettings.sidebarPosition,
    show_status_bar: jsSettings.showStatusBar,
    show_tab_bar_when_only_one_tab: jsSettings.showTabBarWhenOnlyOneTab,
    remember_panel_sizes_per_tab: jsSettings.rememberPanelSizesPerTab,
    show_bookmarks_bar: jsSettings.showBookmarksBar,
    sort_by: jsSettings.sortBy,
    sort_order: jsSettings.sortOrder,
    font_size: jsSettings.fontSize,  // string → string in Rust
    icon_size: jsSettings.iconSize,
    icon_style: jsSettings.iconStyle,
    folder_icon_color: jsSettings.folderIconColor,
    file_icon_color: jsSettings.fileIconColor,
    row_style: jsSettings.rowStyle,
    show_icons: jsSettings.showIcons,
    confirm_copy: jsSettings.confirmCopy,
    confirm_move: jsSettings.confirmMove,
    confirm_rename: jsSettings.confirmRename,
    double_click_empty_goes_parent: jsSettings.doubleClickEmptyGoesParent,
    show_moved_notification: jsSettings.showMovedNotification,
    show_copied_notification: jsSettings.showCopiedNotification,
    play_sound_on_error: jsSettings.playSoundOnError,
    auto_sanitize_names: jsSettings.autoSanitizeNames,
    auto_refresh: jsSettings.autoRefresh,
    check_updates: jsSettings.checkUpdates,
    show_delete_snackbar: jsSettings.showDeleteSnackbar,
    show_copy_paste_snackbar: jsSettings.showCopyPasteSnackbar,
    show_cut_paste_snackbar: jsSettings.showCutPasteSnackbar,
    snackbar_duration: jsSettings.snackbarDuration,
    toast_position: jsSettings.toastPosition,
    toast_duration_seconds: jsSettings.toastDurationSeconds,
    toast_default_style: jsSettings.toastDefaultStyle,
    toast_color_mode: jsSettings.toastColorMode,
    toast_show_progress_bar: jsSettings.toastShowProgressBar,
    toast_show_delete_forever: jsSettings.toastShowDeleteForever,
    toast_show_undo_button: jsSettings.toastShowUndoButton,
    show_row_inline_actions: jsSettings.showRowInlineActions,
    smart_primary_row_action: jsSettings.smartPrimaryRowAction,
    show_paste_rename_dialog: jsSettings.showPasteRenameDialog,
    paste_rename_pattern: jsSettings.pasteRenamePattern,
    show_protected_system_folders: jsSettings.showProtectedSystemFolders,
    show_dot_folders: jsSettings.showDotFolders,
    open_folders_with: jsSettings.openFoldersWith,
    open_folders_in_new_tab: jsSettings.openFoldersInNewTab,
    enable_custom_icons: jsSettings.enableCustomIcons,
    prefer_thumbnails: jsSettings.preferThumbnails,
    show_thumbnails_list_view: jsSettings.showThumbnailsListView,
    show_thumbnails_details_view: jsSettings.showThumbnailsDetailsView,
    hide_backup_files: jsSettings.hideBackupFiles,
    hide_temporary_files: jsSettings.hideTemporaryFiles,
    hide_os_metadata_files: jsSettings.hideOsMetadataFiles,
    hide_version_control_folders: jsSettings.hideVersionControlFolders,
    use_os_icons: jsSettings.useOSIcons,
    telemetry_enabled: jsSettings.telemetryEnabled,
    system_debug_level: jsSettings.systemDebugLevel,
    date_format: jsSettings.dateFormat,
    start_behavior: jsSettings.startBehavior,
    launch_at_startup: jsSettings.launchAtStartup,
    new_tab_behavior: jsSettings.newTabBehavior,
    crash_report_level: jsSettings.crashReportLevel,
    system: {
      show_status_bar_metrics: jsSettings.system.showStatusBarMetrics,
      cpu_mem_interval_ms: jsSettings.system.cpuMemIntervalMs,
      disk_check_interval_sec: jsSettings.system.diskCheckIntervalSec,
      disk_warn_threshold_percent: jsSettings.system.diskWarnThresholdPercent,
      cpu_warn_threshold_percent: jsSettings.system.cpuWarnThresholdPercent,
      ram_warn_threshold_percent: jsSettings.system.ramWarnThresholdPercent,
    },
  };
}

export async function loadSettings(): Promise<Settings> {
  if (cache) return cache;

  try {
    // Use Tauri invoke command (authoritative source)
    const fromRust = await invoke<any>('get_settings');
    cache = rustToJs(fromRust);
    console.log('[Settings] Loaded from Rust backend:', cache);
    return cache;
  } catch (error) {
    console.warn('[Settings] Rust backend failed, using defaults:', error);
    cache = { ...defaultSettings };
    return cache;
  }
}

export async function saveSettings(next: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const merged: Settings = { ...current, ...next };
  cache = merged;

  try {
    // Use Tauri invoke command (authoritative write)
    const rustSettings = jsToRust(merged);
    const result = await invoke<any>('save_settings', {
      newSettings: rustSettings,
    });
    cache = rustToJs(result);
    return cache;
  } catch (error) {
    console.error('[Settings] Rust save failed:', error);
    throw error;
  }
}

export async function resetSettings(): Promise<Settings> {
  try {
    const result = await invoke<any>('reset_settings');
    cache = rustToJs(result);
    console.log('[Settings] Reset via Rust backend:', cache);
    return cache;
  } catch (error) {
    console.warn('[Settings] Rust reset failed, using defaults:', error);
    cache = { ...defaultSettings };
    return cache;
  }
}

/**
 * Get a specific setting value with type safety
 */
export async function getSetting<T = unknown>(
  key: keyof Settings | string,
  defaultValue?: T
): Promise<T> {
  const settings = await loadSettings();
  const fallback = defaultValue ?? (getValueByPath(defaultSettings, key as string) as T | undefined);
  return getValueByPath(settings, key as string, fallback ?? undefined);
}

/**
 * Set a specific setting value
 */
export async function setSetting(
  key: keyof Settings | string,
  value: unknown
): Promise<void> {
  console.log(`[Settings.ts] 🔧 setSetting('${key}', ${value})`);
  
  if (typeof key === 'string' && key.includes('.')) {
    const settings = await loadSettings();
    const next = setValueByPath(settings, key, value);
    await saveSettings(next);
    return;
  }
  
  const partial = { [key as keyof Settings]: value } as Partial<Settings>;
  console.log(`[Settings.ts] 💾 Saving partial:`, partial);
  await saveSettings(partial);
  console.log(`[Settings.ts] ✅ setSetting completed for ${key}`);
}

// Convenience functions for common settings
export async function getActiveTab(): Promise<string> {
  return await getSetting('activeTabId', '1');
}

export async function setActiveTab(tabId: string): Promise<void> {
  await setSetting('activeTabId', tabId);
}

export async function getTheme(): Promise<string> {
  return await getSetting('theme', 'light');
}

export async function setTheme(theme: string): Promise<void> {
  await setSetting('theme', theme);
}

export async function getShowHiddenFiles(): Promise<boolean> {
  return await getSetting('showHiddenFiles', false);
}

export async function setShowHiddenFiles(show: boolean): Promise<void> {
  await setSetting('showHiddenFiles', show);
}

export async function getConfirmDeleteFiles(): Promise<boolean> {
  return await getSetting('confirmDeleteFiles', defaultSettings.confirmDeleteFiles);
}

export async function setConfirmDeleteFiles(confirm: boolean): Promise<void> {
  await setSetting('confirmDeleteFiles', confirm);
}

// Settings Groups
export interface SettingsGroup {
  id: number;
  name: string;
  description: string;
}

export const settingsGroups: SettingsGroup[] = [
  { id: 1, name: 'General', description: 'General application settings' },
  { id: 2, name: 'Layout', description: 'Interface layout and appearance' },
  { id: 3, name: 'Files & Folders', description: 'File management and display options' },
  { id: 4, name: 'Appearance', description: 'Themes and visual customization' },
  { id: 5, name: 'Actions', description: 'File operations and confirmations' },
  { id: 6, name: 'About', description: 'Application information and updates' }
];

/**
 * Get settings for a specific group
 */
export async function getSettingsGroup(groupId: number): Promise<Partial<Settings>> {
  const settings = await loadSettings();
  
  switch (groupId) {
    case 1: // General
      return {
        activeTabId: settings.activeTabId,
        language: settings.language,
        autoSave: settings.autoSave
      };
    case 2: // Layout
      return {
        sidebarWidth: settings.sidebarWidth,
        panelLayout: settings.panelLayout
      };
    case 3: // Folders
      return {
        showHiddenFolders: settings.showHiddenFolders
      };
    case 4: // Files
      return {
        confirmDeleteFiles: settings.confirmDeleteFiles,
        showSystemFiles: settings.showSystemFiles,
        sortBy: settings.sortBy,
        sortOrder: settings.sortOrder,
        confirmRename: settings.confirmRename,
        autoSanitizeNames: settings.autoSanitizeNames
      };
    case 5: // Appearance
      return {
        theme: settings.theme,
        fontSize: settings.fontSize,
        iconSize: settings.iconSize,
        showIcons: settings.showIcons,
        showRowInlineActions: settings.showRowInlineActions,
        smartPrimaryRowAction: settings.smartPrimaryRowAction
      };
    case 6: // Notifications
      return {
        showDeleteSnackbar: settings.showDeleteSnackbar,
        showCopyPasteSnackbar: settings.showCopyPasteSnackbar,
        showCutPasteSnackbar: settings.showCutPasteSnackbar,
        snackbarDuration: settings.snackbarDuration,
        toastPosition: settings.toastPosition,
        toastDurationSeconds: settings.toastDurationSeconds,
        toastDefaultStyle: settings.toastDefaultStyle,
        showPasteRenameDialog: settings.showPasteRenameDialog,
        pasteRenamePattern: settings.pasteRenamePattern
      };
    case 7: // Actions
      return {
        confirmCopy: settings.confirmCopy,
        confirmMove: settings.confirmMove,
        confirmRename: settings.confirmRename,
        autoRefresh: settings.autoRefresh
      };
    case 8: // System
      return {
        system: settings.system
      };
    case 9: // About
      return {
        checkUpdates: settings.checkUpdates
      };
    case 10: // Icons
      return {
        enableCustomIcons: settings.enableCustomIcons,
        preferThumbnails: settings.preferThumbnails,
        useOSIcons: settings.useOSIcons
      };
    default:
      return {};
  }
}

