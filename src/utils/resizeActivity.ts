/**
 * This is src/lib/utils/resizeActivity.ts
 * Used by: src/lib/P2/folderTree/thumbnail/thumbnail.queue.ts, src/lib/folderTree/thumbnail/thumbnail.queue.ts, src/lib/components/Resizer.svelte
 * Purpose: Detects resize operations and notifies listeners
 * Trigger: tick() called during resize, onChange() subscribes
 * Event Flow: Tracks resizing state, emits on start/stop
 * List of functions: resizeActivity.tick, resizeActivity.onChange, resizeActivity.isResizing
 */

/**
 * Resize Activity Governor
 * Detects resize operations and notifies listeners when resize starts/stops
 * Used to pause heavy work (thumbnails, grid recalculation) during active resizing
 */

type Listener = () => void;

class ResizeActivity {
  private resizing = false;
  private idleTimer: number | null = null;
  private listeners: Set<Listener> = new Set();

  /**
   * Called during resize operations
   * Marks resizing as active and resets idle timer
   */
  tick() {
    if (!this.resizing) {
      this.resizing = true;
      this.emit(); // notify "started"
    }
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.resizing = false;
      this.idleTimer = null;
      this.emit(); // notify "stopped"
    }, 150); // 150ms idle = considered "stopped"
  }

  /**
   * Force cleanup - call when component unmounts to prevent memory leaks
   */
  cleanup() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.resizing = false;
  }

  /**
   * Subscribe to resize start/stop events
   * @returns unsubscribe function
   */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Check if currently resizing
   */
  isResizing(): boolean {
    return this.resizing;
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}

export const resizeActivity = new ResizeActivity();

// Expose for diagnostics
if (typeof window !== 'undefined') {
  (window as any).__resizeActivity = resizeActivity;
}

