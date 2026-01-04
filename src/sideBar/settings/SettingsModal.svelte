<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { loadSettings, saveSettings, setSetting, defaultSettings, type AppSettings } from '$lib/tauri/settings';
  import { appSettings } from '$lib/stores/settings.store';
  import settingsGroupsConfig from './settings_group.json';
  import { createDebugLogger } from '$lib/core/logging/unified-logger';
  import { onWindow, DisposableBin } from '$lib/utils/eventRegistry';
  import SelectField from './SelectField.svelte';
  import { locale, isRTL } from '$lib/languages/i18n';
  import { toast } from '$lib/utils/toast';
  import { statusBarActions } from '$lib/stores/statusbar.store';
  import { logEx } from '$lib/core/logging/logger-tauri';
  import { updateConfirmDeleteFiles } from '$lib/stores/settings.store';
  
  // Helper to get default value from settings.ts for a given key
  function getDefaultValue(key: string): any {
    if (!key.includes('.')) {
      return (defaultSettings as any)[key];
    }
    const parts = key.split('.');
    let cursor: any = defaultSettings;
    for (const part of parts) {
      if (cursor == null) return undefined;
      cursor = cursor[part];
    }
    return cursor;
  }
  
  // Get theme-specific default color for icon colors
  function getThemeDefaultColor(theme: string): string {
    const themeColors: Record<string, string> = {
      'light': '#ffc95a',
      'dark': '#ffc95a',
      'cupcake': '#f9a8d4',
      'bumblebee': '#fbbf24',
      'synthwave': '#e879f9',
      'valentine': '#f472b6',
      'halloween': '#ff6600',
      'garden': '#4ade80',
      'aqua': '#06b6d4',
      'luxury': '#d4af37',
      'night': '#38bdf8',
      'coffee': '#d2691e',
      'winter': '#60a5fa',
    };
    return themeColors[theme] || '#ffc95a';
  }
  
  const log = createDebugLogger('SettingsModal');
  const SCOPE = 'settings' as const;
  log.debug(SCOPE, 'init', 'Settings modal loading...');
  
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  let selectedGroupId = 1;
  let currentSettings: any = {};
  let isLoading = true;
  
  // Reset confirmation dialog
  let showResetConfirmDialog = false;
  
  // Drag state
  let dragging = false;
  let startPointerX = 0;
  
  // Event listener management
  let bin: DisposableBin | null = null;
  let startPointerY = 0;
  let startLeft = 0;
  let startTop = 0;
  let modalElement: HTMLElement;
  
  // Get settings groups from config and sort by ID
  const settingsGroups = settingsGroupsConfig.settingsGroups
    .map((group: any) => ({
      ...group,
      description: group.desc ?? group.description,
      settings: (group.settings ?? []).map((setting: any) => {
        const inline = setting.inline ?? false;
        const tip = setting.tip ?? setting.description ?? '';
        const selectWidth = setting.selectWidth ?? setting['select width'] ?? null;
        const buttonWidth = setting.buttonWidth ?? setting['button width'] ?? null;
        const inlineGroup = setting.inlineGroup ?? setting['inline group'] ?? null;
        return {
          ...setting,
          inline,
          tip,
          selectWidth,
          buttonWidth,
          inlineGroup,
        };
      }),
    }))
    .sort((a, b) => a.id - b.id);
  
  $: selectedGroup = settingsGroups.find(g => g.id === selectedGroupId);

  // Helper function to group settings by inlineGroup
  function getGroupedSettings(settings: any[]): any[] {
    const visibleSettings = settings.filter((s: any) => !s.hidden);
    return visibleSettings.reduce((acc: any[], setting: any) => {
      if (setting.inlineGroup) {
        const lastGroup = acc[acc.length - 1];
        if (lastGroup && lastGroup.type === 'inlineGroup' && lastGroup.groupId === setting.inlineGroup) {
          lastGroup.items.push(setting);
        } else {
          acc.push({ type: 'inlineGroup', groupId: setting.inlineGroup, items: [setting] });
        }
      } else {
        acc.push({ type: 'single', item: setting });
      }
      return acc;
    }, []);
  }

  function getValueByPath(source: any, path: string, fallback?: any) {
    if (!path.includes('.')) {
      return source?.[path] ?? fallback;
    }
    const parts = path.split('.');
    let cursor = source;
    for (const part of parts) {
      if (cursor == null) return fallback;
      cursor = cursor[part];
    }
    return cursor ?? fallback;
  }

  function setValueByPath(source: any, path: string, value: any) {
    const base = source ? { ...source } : {};
    if (!path.includes('.')) {
      base[path] = value;
      return base;
    }
    const parts = path.split('.');
    let cursor = base;
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
    return base;
  }

  function getSettingValue(key: string, fallback?: any) {
    return getValueByPath(currentSettings, key, fallback);
  }

  function updateCurrentSettings(key: string, value: any) {
    currentSettings = setValueByPath(currentSettings, key, value);
  }

  function syncAppSettings(key: string, value: any) {
    console.log(`[SettingsModal] 🔄 syncAppSettings('${key}', ${value})`);
    appSettings.update((previous) => {
      const updated = setValueByPath(previous, key, value) as AppSettings;
      if (key === 'showDeleteSnackbar' || key === 'showCopyPasteSnackbar' || key === 'showCutPasteSnackbar' || key === 'snackbarDuration') {
        console.log(`[SettingsModal] ✅ Updated appSettings.${key} from ${previous[key]} to ${updated[key]}`);
      }
      return updated;
    });
  }

  function ensureSystemDefaults(settings: any) {
    const systemDefaults = defaultSettings.system;
    const mergedSystem = {
      ...systemDefaults,
      ...(settings?.system ?? {}),
    };
    return {
      ...settings,
      system: mergedSystem,
    };
  }
  
  // Close modal handlers
  function closeModal() {
    open = false;
    dispatch('close');
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }
  
  function handleOutsideClick(event: MouseEvent) {
    if (dragging) return; // Don't close while dragging
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal') || target.classList.contains('modal-backdrop')) {
      closeModal();
    }
  }
  
  // Ensure we can restore center on open
  function resetModalPosition() {
    if (!modalElement) return;
    modalElement.style.position = ''; // let daisyUI center it
    modalElement.style.left = '';
    modalElement.style.top = '';
    modalElement.style.transform = ''; // clear any previous transforms
  }
  
  // Start drag with Pointer Events
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if (!modalElement) return;

    // Compute current absolute position from its rect
    const rect = modalElement.getBoundingClientRect();

    // Switch to fixed positioning at the current visual location
    modalElement.style.position = 'fixed';
    modalElement.style.left = `${rect.left}px`;
    modalElement.style.top = `${rect.top}px`;
    modalElement.style.transform = ''; // IMPORTANT: avoid transform conflicts

    dragging = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    // Capture the pointer so we keep getting moves
    (e.target as Element).setPointerCapture?.(e.pointerId);

    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !modalElement) return;

    // Calculate new position
    let newLeft = startLeft + (e.clientX - startPointerX);
    let newTop  = startTop  + (e.clientY - startPointerY);

    // Optional: keep the modal within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = modalElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    newLeft = Math.min(Math.max(newLeft, 8), vw - w - 8);
    newTop  = Math.min(Math.max(newTop, 8), vh - h - 8);

    modalElement.style.left = `${newLeft}px`;
    modalElement.style.top = `${newTop}px`;
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    // releasePointerCapture is optional—most browsers auto-release on up
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
  }
  
  // Load settings when modal opens
  async function loadCurrentSettings() {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let didTimeout = false;
    try {
      isLoading = true;
      const timeoutMs = 60_000;
      const timeoutMessage = 'Settings load timed out. Please try again.';

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(async () => {
          didTimeout = true;
          isLoading = false;
          toast.error(timeoutMessage, 6000);
          statusBarActions.setMessage(timeoutMessage, 'warning', 6000);
          try {
            await logEx(`[SettingsModal] ${timeoutMessage}`, 'exception');
          } catch (logError) {
            console.warn('[SettingsModal] Failed to log timeout:', logError);
          }
          reject(new Error('SETTINGS_LOAD_TIMEOUT'));
        }, timeoutMs);
      });

      const loaded = await Promise.race([loadSettings(), timeoutPromise]);

      console.log('[SettingsModal] Settings loaded from backend', loaded);

      if (didTimeout) {
        log.warn(SCOPE, 'loadSettingsWithTimeout', 'Settings load abandoned after timeout.');
        return;
      }

      currentSettings = ensureSystemDefaults({
        ...loaded,
        confirmDeleteFiles:
          (loaded as any).confirmDeleteFiles ?? (loaded as any).askBeforeDelete ?? true
      });
      appSettings.set(currentSettings as AppSettings);
      // Ensure select fields have fallback values to avoid blank states
      for (const group of settingsGroups) {
        for (const setting of group.settings) {
          if (setting.type !== 'select') {
            continue;
          }

          const existing = getSettingValue(setting.key);
          const hasExisting = typeof existing === 'string' ? existing.trim().length > 0 : existing != null;
          let fallback = hasExisting ? existing : undefined;

          if (!fallback) {
            // Use default from settings.ts instead of JSON
            fallback = getDefaultValue(setting.key) ?? (setting.options?.[0]?.value ?? '');
          }

          if (!fallback) {
            continue;
          }

          if (!hasExisting || existing !== fallback) {
            updateCurrentSettings(setting.key, fallback);
            syncAppSettings(setting.key, fallback);
            try {
              await setSetting(setting.key as any, fallback);
            } catch (error) {
              console.error(`[SettingsModal] Failed to ensure fallback for ${setting.key}:`, error);
            }
          }
        }
      }
      console.log('[SettingsModal] Loaded settings:', currentSettings);
    } catch (error) {
      if ((error as Error)?.message === 'SETTINGS_LOAD_TIMEOUT') {
        log.warn(SCOPE, 'loadSettings', 'Settings loading timed out.');
        return;
      }
      console.error('[SettingsModal] Failed to load settings:', error);
      currentSettings = {};
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (!didTimeout) {
        isLoading = false;
      }
    }
  }
  
  // Save settings
  async function saveCurrentSettings() {
    try {
      await saveSettings(currentSettings);
      console.log('[SettingsModal] Settings saved successfully');
      // Show success feedback if needed
    } catch (error) {
      console.error('[SettingsModal] Failed to save settings:', error);
      // Show error feedback if needed
    }
  }
  
  // Reset all settings to defaults
  function handleResetToDefault() {
    showResetConfirmDialog = true;
  }
  
  function confirmReset() {
    console.log('[SettingsModal] Resetting to defaults, clearing localStorage...');
    localStorage.clear();
    console.log('[SettingsModal] ✓ localStorage cleared, reloading...');
    window.location.reload();
  }
  
  function cancelReset() {
    showResetConfirmDialog = false;
  }
  
  // Handle setting value changes
  async function handleSettingChange(key: string, value: any) {
    console.log('[SettingsModal] Setting changed:', key, '=', value);

    if (key === 'confirmDeleteFiles') {
      console.log('[SettingsModal] 🛡️ confirmDeleteFiles toggled', {
        value
      });
      currentSettings = setValueByPath(currentSettings, key, value);
      try {
        await updateConfirmDeleteFiles(value);
      } catch (error) {
        console.error('[SettingsModal] Failed to update confirmDeleteFiles store:', error);
      }
      return;
    }

    // Log snackbar settings specifically
    if (key === 'showDeleteSnackbar' || key === 'showCopyPasteSnackbar' || key === 'showCutPasteSnackbar' || key === 'snackbarDuration') {
      console.log(`[SettingsModal] 🔔 ${key} toggled`, { value, before: currentSettings[key] });
    }

    // Directly update currentSettings to trigger reactivity
    currentSettings = setValueByPath(currentSettings, key, value);
    if (key !== 'confirmDeleteFiles') {
      syncAppSettings(key, value);
      console.log(`[SettingsModal] 🔄 syncAppSettings called for ${key}`);
    }
    
    // Auto-save each change immediately
    try {
      console.log(`[SettingsModal] 💾 Calling setSetting('${key}', ${value})`);
      await setSetting(key as any, value);
      console.log(`[SettingsModal] ✅ setSetting completed for ${key}`);
    } catch (error) {
      console.error('[SettingsModal] Failed to save setting:', error);
    }
  }
  
  // Load settings when modal opens
  $: if (open) {
    loadCurrentSettings();
    // Reset position so it opens centered again
    resetModalPosition();
  }
  
  onMount(() => {
    // Initial load
    if (open) {
      loadCurrentSettings();
    }
    
    // Setup singleton global keydown listener
    bin = new DisposableBin();
    bin.add(onWindow('keydown', handleKeyDown, { ns: 'SettingsModal' }));
  });
  
  onDestroy(() => {
    if (bin) {
      bin.dispose();
    }
  });

  let currentLanguage: string = 'en';
  let direction: 'ltr' | 'rtl' | 'auto' = 'ltr';

  $: currentLanguage = $locale || 'en';
  $: direction = $isRTL ? 'rtl' : 'ltr';
</script>

<!-- Keyboard event handler now managed by singleton system in onMount -->

{#if open}
  <!-- Modal backdrop -->
  <div 
    class="modal modal-open" 
    on:click={handleOutsideClick}
    on:keydown={handleKeyDown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
  >
    <!-- Modal container -->
    <div id="settings-main"
      bind:this={modalElement}
      class="modal-box w-4/5 max-w-3xl h-3/5 max-h-[500px] p-0 flex flex-col" 
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      tabindex="-1"
    >
      <!-- Header - Draggable -->
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-base-300 bg-base-200 flex-shrink-0">
        <div 
          class="flex-1 cursor-move select-none py-1"
          on:pointerdown={onPointerDown}
          on:pointermove={onPointerMove}
          on:pointerup={onPointerUp}
          role="button"
          tabindex="0"
          aria-label="Drag to move modal"
          on:keydown={(e) => e.key === 'Enter' && e.preventDefault()}
        >
          <h3 id="settings-title" class="font-medium text-sm pointer-events-none">Settings</h3>
        </div>
        <button 
          class="btn btn-xs btn-circle btn-ghost pointer-events-auto" 
          on:click={closeModal}
          on:mousedown|stopPropagation
          aria-label="Close settings"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <!-- Content area -->
      <div id="settings-content" class="flex flex-1 min-h-0 overflow-hidden">
        <!-- Left sidebar - Settings groups -->
        <div id="settings-groups" class="w-40 bg-base-200 border-r border-base-300 overflow-y-auto scrollbar-none flex flex-col">
          <div class="p-1.5">
            <h4 class="text-xs font-medium text-base-content/70 mb-1">Categories</h4>
            <nav class="space-y-0.5">
              {#each settingsGroups as group}
                <button
                  class="w-full text-left px-1.5 py-0.5 rounded text-xs transition-colors {
                    selectedGroupId === group.id 
                      ? 'bg-primary text-primary-content' 
                      : 'hover:bg-base-300 text-base-content'
                  }"
                  on:click={() => selectedGroupId = group.id}
                >
                  <div class="flex items-center gap-1">
                    <span class="text-xs">
                      {#if group.icon === 'gear'}⚙️
                      {:else if group.icon === 'layout'}📐
                      {:else if group.icon === 'folder'}📁
                      {:else if group.icon === '📄'}📄
                      {:else if group.icon === 'palette'}🎨
                      {:else if group.icon === 'action'}⚡
                      {:else if group.icon === 'info'}ℹ️
                      {:else}⚙️{/if}
                    </span>
                    <span class="truncate text-xs">{group.name}</span>
                  </div>
                </button>
              {/each}
            </nav>
          </div>
          
          <!-- Bottom action bar: Reset to Default -->
          <div class="mt-auto p-2 border-t border-base-300">
            <button
              class="btn btn-sm btn-outline btn-error w-full"
              on:click={handleResetToDefault}
              title="Reset all settings to their default values"
            >
              Reset to Default
            </button>
          </div>
        </div>
        
        <!-- Right content - Settings for selected group -->
        <div id="settings-details" class="flex-1 overflow-y-auto">
          <div class="p-4">
            {#if isLoading}
              <div class="flex items-center justify-center py-4">
                <div class="loading loading-spinner loading-sm"></div>
                <span class="ml-2 text-sm">Loading settings...</span>
              </div>
            {:else if selectedGroup}
              <!-- Group header -->
              <div class="mb-2">
                <!-- <h2 class="text-lg font-medium mb-1">{selectedGroup.name}</h2> -->
                <h2 class="text-sm font-medium text-base-content/90">{selectedGroup.description}</h2>
              </div>
              
              <!-- Settings list -->
              <div class="space-y-1">
                {#each getGroupedSettings(selectedGroup.settings) as group}
                  {#if group.type === 'inlineGroup'}
                    <!-- Inline group: multiple settings on same row -->
                    <div class="form-control flex flex-row items-center justify-between gap-3 py-1">
                      {#each group.items as setting}
                        {#if setting.type === 'label'}
                          <div class="font-semibold text-sm text-base-content/90" title={setting.tip}>
                            {setting.name}
                          </div>
                        {:else if setting.type === 'button'}
                          <button 
                            class="btn btn-sm btn-outline"
                            style={setting.buttonWidth ? `width: ${setting.buttonWidth}` : undefined}
                            on:click={() => {
                              if (setting.action === 'checkUpdates') {
                                console.log('[Settings] Check for updates clicked');
                              } else if (setting.action === 'exportDiagnostics') {
                                console.log('[Settings] Export diagnostics clicked');
                              } else if (setting.action === 'deleteDiagnostics') {
                                console.log('[Settings] Delete diagnostics clicked');
                              }
                            }}
                          >
                            {setting.label || setting.name}
                          </button>
                        {:else if setting.type === 'link'}
                          <a 
                            href={setting.url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-primary hover:underline text-sm"
                          >
                            {setting.label || 'Click here'}
                          </a>
                        {/if}
                      {/each}
                    </div>
                  {:else}
                    <!-- Single setting -->
                    {@const setting = group.item}
                    <div class={`form-control ${setting.inline ? 'flex flex-row items-center justify-between gap-3 py-1 whitespace-nowrap' : ''}`}>
                      <!-- Standard settings layout (skip for label/note/link/button types as they render their own content) -->
                      {#if setting.type !== 'label' && setting.type !== 'note' && setting.type !== 'link' && setting.type !== 'button'}
                        <div class={`mb-1 ${setting.inline ? 'flex-1 mb-0' : ''}`}>
                          <span
                            class="label-text text-sm font-medium"
                            title={setting.tip}
                          >
                            {setting.name}
                          </span>
                        </div>
                      {/if}
                      <div class={`${setting.inline ? 'flex items-center gap-3 flex-shrink-0 whitespace-nowrap' : 'space-y-1'}`}>
                        {#if setting.type === 'boolean'}
                          <!-- Toggle switch for boolean settings -->
                          <label
                            class="label cursor-pointer justify-start items-center py-0.5 gap-3"
                            for={`setting-${setting.key}`}
                          >
                            <input
                              id={`setting-${setting.key}`}
                              type="checkbox"
                              class="toggle toggle-primary"
                              checked={getSettingValue(setting.key, getDefaultValue(setting.key))}
                              on:change={(e) => {
                                const target = e.target as HTMLInputElement;
                                handleSettingChange(setting.key, target.checked);
                              }}
                            />
                          </label>
                        {:else if setting.type === 'select'}
                          <!-- Custom select dropdown (bulletproof DaisyUI version) -->
                          <SelectField
                            items={Array.isArray(setting.options) ? setting.options : []}
                            value={getSettingValue(setting.key, getDefaultValue(setting.key) ?? '')}
                            lang={currentLanguage}
                            dir={direction}
                            placeholder="Choose…"
                            className={`${setting.inline ? 'min-w-[16rem]' : setting.selectWidth ? '' : 'w-full max-w-2xl'}`}
                            style={setting.selectWidth ? `width: ${setting.selectWidth}` : undefined}
                            ariaLabel={setting.name}
                            on:change={(event) => {
                              const rawValue = event.detail;
                              // Parse number for numeric select options
                              const parsedValue = setting.options?.some((opt: any) => typeof opt.value === 'number')
                                ? (typeof rawValue === 'string' ? parseInt(rawValue, 10) : rawValue)
                                : rawValue;
                              handleSettingChange(setting.key, parsedValue);
                            }}
                          />
                          {#if setting.description && !setting.descriptionTooltip}
                            <div class="text-xs text-base-content/60 mt-1">{setting.description}</div>
                          {/if}
                        {:else if setting.type === 'number'}
                          <!-- Number input -->
                          <label for="number-{setting.key}" class="sr-only">{setting.name}</label>
                          <input 
                            id="number-{setting.key}"
                            type="number"
                            class={`input input-bordered input-sm ${setting.inline ? 'w-[6rem]' : setting.selectWidth ? '' : 'w-full max-w-xs'}`}
                            value={getSettingValue(setting.key, getDefaultValue(setting.key))}
                            min={'min' in setting ? setting.min : undefined}
                            max={'max' in setting ? setting.max : undefined}
                            step={'step' in setting && typeof setting.step === 'number' ? setting.step : undefined}
                            on:input={(e) => {
                              const target = e.target as HTMLInputElement;
                              handleSettingChange(setting.key, parseInt(target.value) || getDefaultValue(setting.key));
                            }}
                          />
                          {#if setting.description && !setting.descriptionTooltip}
                            <div class="text-xs text-base-content/60 mt-1">{setting.description}</div>
                          {/if}
                        {:else if setting.type === 'text'}
                          <!-- Text input -->
                          <label for="text-{setting.key}" class="sr-only">{setting.name}</label>
                          <input 
                            id="text-{setting.key}"
                            type="text"
                            class={`input input-bordered input-sm ${setting.inline ? 'w-[12rem]' : setting.selectWidth ? '' : 'w-full max-w-xs'}`}
                            value={getSettingValue(setting.key, getDefaultValue(setting.key))}
                            on:input={(e) => {
                              const target = e.target as HTMLInputElement;
                              handleSettingChange(setting.key, target.value);
                            }}
                          />
                          {#if setting.description && !setting.descriptionTooltip}
                            <div class="text-xs text-base-content/60 mt-1">{setting.description}</div>
                          {/if}
                        {:else if setting.type === 'color'}
                          <!-- Color input with hex display -->
                          {#key currentSettings}
                            {@const colorValue = getSettingValue(setting.key, getDefaultValue(setting.key))}
                            <div class="flex items-center gap-2">
                              <label for="color-{setting.key}" class="sr-only">{setting.name}</label>
                              <input 
                                id="color-{setting.key}"
                                type="color"
                                class="w-10 h-8 rounded cursor-pointer border border-base-300"
                                value={colorValue || getThemeDefaultColor(getSettingValue('theme', 'light'))}
                                on:input={(e) => {
                                  const target = e.target as HTMLInputElement;
                                  handleSettingChange(setting.key, target.value);
                                }}
                              />
                              {#if colorValue}
                                <span class="text-sm font-mono text-base-content/80">
                                  {colorValue}
                                </span>
                                <button
                                  class="btn btn-xs btn-outline"
                                  on:click={() => handleSettingChange(setting.key, '')}
                                >
                                  Reset to Default
                                </button>
                              {:else}
                                <span class="text-sm text-base-content/60">
                                  Default
                                </span>
                              {/if}
                            </div>
                          {/key}
                          {#if setting.description && !setting.descriptionTooltip}
                            <div class="text-xs text-base-content/60 mt-1">{setting.description}</div>
                          {/if}
                        {:else if setting.type === 'label'}
                          <!-- Section label -->
                          <div class="mt-3 mb-1">
                            <div class="font-semibold text-sm text-base-content/90" title={setting.description}>
                              {setting.name}
                            </div>
                          </div>
                        {:else if setting.type === 'note'}
                          <!-- Informational note -->
                          <div class="alert bg-base-200 text-xs p-2 my-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-4 h-4">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span>{setting.description || setting.name}</span>
                          </div>
                        {:else if setting.type === 'link'}
                          <!-- External link -->
                          <a 
                            href={setting.url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-primary hover:underline text-sm"
                          >
                            {setting.label || 'Click here'}
                          </a>
                        {:else if setting.type === 'button'}
                          <!-- Action button -->
                          <button 
                            class="btn btn-sm btn-outline"
                            style={setting.buttonWidth ? `width: ${setting.buttonWidth}` : undefined}
                            on:click={() => {
                              if (setting.action === 'checkUpdates') {
                                console.log('[Settings] Check for updates clicked');
                              } else if (setting.action === 'exportDiagnostics') {
                                console.log('[Settings] Export diagnostics clicked');
                                // TODO: Implement export diagnostics handler
                              } else if (setting.action === 'deleteDiagnostics') {
                                console.log('[Settings] Delete diagnostics clicked');
                                // TODO: Implement delete diagnostics handler
                              }
                            }}
                          >
                            {setting.label || setting.name}
                          </button>
                        {/if}
                      </div>
                  </div>
                  {/if}
                {/each}
              </div>
            {:else}
              <div class="text-center py-4 text-base-content/60 text-sm">
                No settings group selected
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Footer intentionally removed: settings save automatically on change -->
    </div>
  </div>
{/if}

<!-- Reset Confirmation Dialog -->
{#if showResetConfirmDialog}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">⚠️ Reset to Defaults?</h3>
      <p class="py-4">
        This will:
      </p>
      <ul class="list-disc list-inside space-y-1 text-sm mb-4">
        <li>Clear all stored settings and preferences</li>
        <li>Reset to default values (1000ms refresh, 95% thresholds, etc.)</li>
        <li>Reload the application</li>
      </ul>
      <p class="text-warning text-sm mb-4">
        This action cannot be undone.
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" on:click={cancelReset}>
          Cancel
        </button>
        <button class="btn btn-error" on:click={confirmReset}>
          Reset to Defaults
        </button>
      </div>
    </div>
  </div>
{/if}
