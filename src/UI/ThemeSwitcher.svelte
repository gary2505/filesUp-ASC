<script lang="ts">
import { onMount } from 'svelte';
import { logEx } from '../core/logging/logger-tauri';

export let themes: string[] = [
  "light", "dark", "aqua","cupcake","bumblebee", "synthwave", "valentine", "halloween", "garden", "luxury", "night", "coffee", "winter"
];
export let currentTheme: string = 'light';
export let onThemeChange: (theme: string) => void = () => {};
let showPopup = false;
const themeIcons: Record<string, string> = {
  light: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><circle cx="12" cy="12" r="5" stroke="currentColor"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  dark: '<svg class="w-5 h-5" fill="none" stroke="#111519" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="#111519"/></svg>',
  aqua: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="aqua"><stop offset="50%" stop-color="#345DA7"/><stop offset="50%" stop-color="#08ECF3"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#aqua)"/></svg>',
  bumblebee: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="bumblebee"><stop offset="50%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#FFD900"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#bumblebee)"/></svg>',
  coffee: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="coffee"><stop offset="50%" stop-color="#20161F"/><stop offset="50%" stop-color="#DB924B"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#coffee)"/></svg>',
  cupcake: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="cupcake"><stop offset="50%" stop-color="#FAF7F5"/><stop offset="50%" stop-color="#65C3C8"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#cupcake)"/></svg>',
  halloween: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="halloween"><stop offset="50%" stop-color="#212121"/><stop offset="50%" stop-color="#FF8F00"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#halloween)"/></svg>',
  garden: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="garden"><stop offset="50%" stop-color="#E9E7E7"/><stop offset="50%" stop-color="#FE0075"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#garden)"/></svg>',
  luxury: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="luxury"><stop offset="50%" stop-color="#09090B"/><stop offset="50%" stop-color="#DCA54C"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#luxury)"/></svg>',
  night: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="night"><stop offset="50%" stop-color="#0F172A"/><stop offset="50%" stop-color="#38BDF8"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#night)"/></svg>',
  synthwave: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="synthwave"><stop offset="50%" stop-color="#1A103D"/><stop offset="50%" stop-color="#E779C1"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#synthwave)"/></svg>',
  valentine: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="valentine"><stop offset="50%" stop-color="#FAE7F4"/><stop offset="50%" stop-color="#E96D7B"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#valentine)"/></svg>',
  winter: '<svg class="w-5 h-5" viewBox="0 0 24 24" style="pointer-events: none;"><defs><linearGradient id="winter"><stop offset="50%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#0069FF"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#winter)"/></svg>'
};

function handleThemeClick() {
  showPopup = !showPopup;
}

async function selectTheme(theme: string) {
  showPopup = false;
  await logEx(`[ThemeSwitcher] Theme changed: ${theme}`, 'log');
  
  // Apply theme to document immediately
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  
  // Force a style recalculation
  document.documentElement.offsetHeight;
  
  // Call the parent callback to update stores/persistence
  onThemeChange(theme);
}

let popupRef: HTMLDivElement | null = null;
const fallbackIcon = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>';

// Reactive statement to ensure theme is always applied when currentTheme changes
$: if (currentTheme) {
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.body.setAttribute('data-theme', currentTheme);
}
// Close popup only on outside click
onMount(() => {
  // Apply the current theme immediately on mount
  if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
  }
  
  function handle(e: MouseEvent) {
    if (!popupRef?.contains(e.target as Node)) showPopup = false;
  }
  document.addEventListener('click', handle);
  return () => document.removeEventListener('click', handle);
});
</script>

<div class="relative inline-block">
  <button class="btn btn-ghost btn-sm flex items-center gap-2 border border-base-300 rounded-full p-1"
    aria-label="Change theme"
    on:click|stopPropagation={handleThemeClick}
    style="color: var(--primary); background: var(--b1);">
    {@html themeIcons[currentTheme] || fallbackIcon}
  </button>
  {#if showPopup}
    <div class="absolute right-0 mt-2 z-[2000] bg-base-100 border border-base-300 rounded-box shadow w-max min-w-[180px] p-2 flex flex-col items-start" bind:this={popupRef}>
      <div class="flex justify-between items-center w-full mb-2">
        <span class="font-semibold text-base">Theme</span>
        <button class="btn btn-xs btn-circle btn-ghost" on:click={() => showPopup = false} aria-label="Close theme panel">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <ul class="menu p-0 w-full">
        {#each themes as theme}
          <li>
            <button class="flex items-center gap-2 w-full px-2 py-1 text-sm hover:bg-base-200 min-h-0 h-7 {currentTheme === theme ? 'bg-primary/20 text-primary' : ''}"
              on:click={() => selectTheme(theme)}>
              <span>{@html themeIcons[theme] || fallbackIcon}</span>
              <span class="flex-1 text-left">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
              {#if currentTheme === theme}
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
/* Theme switcher styles handled by component classes */
</style>
