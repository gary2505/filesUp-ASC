import { writable } from 'svelte/store';

// Global open state for the log viewer modal
export const logViewerOpen = writable(false);
