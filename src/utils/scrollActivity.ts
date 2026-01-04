/**
 * This is src/lib/utils/scrollActivity.ts
 * Used by: src/lib/P2/folderTree/thumbnail/thumbnail.queue.ts, src/lib/folderTree/thumbnail/thumbnail.queue.ts
 * Purpose: Detects scroll bursts and notifies listeners
 * Trigger: tick() called on scroll, onChange() subscribes
 * Event Flow: Tracks scrolling state, emits on start/stop
 * List of functions: scrollActivity.tick, scrollActivity.onChange, scrollActivity.isScrolling
 */

/**
 * Scroll Activity Governor
 * Detects scroll bursts and notifies listeners when scroll starts/stops
 * Used to pause heavy work (thumbnails, FS refresh) during active scrolling
 */

type Listener = () => void;

class ScrollActivity {
  private scrolling = false;
  private idleTimer: number | null = null;
  private listeners: Set<Listener> = new Set();

  /**
   * Called on every scroll event (RAF-throttled)
   * Marks scrolling as active and resets idle timer
   */
  tick() {
    if (!this.scrolling) {
      this.scrolling = true;
      this.emit(); // notify "started"
    }
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.scrolling = false;
      this.idleTimer = null;
      this.emit(); // notify "stopped"
    }, 160); // 160ms idle = considered "stopped"
  }

  /**
   * Force cleanup - call when component unmounts to prevent memory leaks
   */
  cleanup() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.scrolling = false;
  }

  /**
   * Subscribe to scroll start/stop events
   * @returns unsubscribe function
   */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Check if currently scrolling
   */
  isScrolling(): boolean {
    return this.scrolling;
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}

export const scrollActivity = new ScrollActivity();

// Expose for diagnostics
if (typeof window !== 'undefined') {
  (window as any).__scrollActivity = scrollActivity;
}
