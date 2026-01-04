/**
 * This is src/lib/utils/global.d.ts
 * Used by: src/lib/folderTree/controls/NewViewControl.svelte, src/lib/utils/bodyScrollLock.ts
 * Purpose: Extends global Window interface with FilesUP-specific tracking properties
 * Trigger: TypeScript compilation - globally available type augmentation
 * Event Flow: Type definition loaded → Window interface extended → components access properties with type safety
 * List of functions: N/A (type definitions only)
 */

/**
 * This is global.d.ts
 * Used by: $lib/folderTree/controls/NewViewControl.svelte, $lib/utils/bodyScrollLock.ts
 * Purpose: Extends global Window interface with FilesUP-specific tracking properties for view control listeners and body scroll lock reference counting
 * Trigger: TypeScript compilation - globally available type augmentation
 * Event Flow: Type definition loaded → Window interface extended → components access __filesup_vc_listeners and __filesup_bodyLocks with type safety
 * Functions: N/A (type definitions only)
 */

declare global {
  interface Window {
    __filesup_vc_listeners?: number;
    __filesup_bodyLocks?: Map<string, number>;
  }
}

export {};