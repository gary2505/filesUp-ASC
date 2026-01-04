/**
 * This is src/lib/utils/eventRegistry.ts
 * Used by: src/main.ts, src-tauri/src/main.ts, src/core/operations/SessionManager.svelte (in filesUp-ASC)
 * Purpose: Provides a registry for managing event listeners with deduplication and cleanup
 * Trigger: Called during startup for dev defaults, and used to add event listeners with options
 * Event Flow: Registers listeners with namespaces, handles cleanup on unmount
 * List of functions: on, off, offAll, has, installEventRegistryDevDefaults, onWindow, onDocument
 */

// src/lib/utils/eventRegistry.ts
type Listener = (e: any) => void;

export interface ListenOpts extends AddEventListenerOptions {
  /** Optional namespace to dedupe, e.g. "chevron.expand" */
  ns?: string;
  /** AbortSignal for auto-cleanup on unmount */
  signal?: AbortSignal;
  /** Force cross-namespace dedupe on the same element+type(+capture) */
  singleton?: boolean;
  /** Optional stable id to dedupe the same logical listener across call sites */
  id?: string;
}

type Key = string; // `${type}::${ns||''}::${capture}`
const ELEM_UID = Symbol('evt.uid');

function getUid(el: EventTarget & { [ELEM_UID]?: string }): string {
  if (!el[ELEM_UID]) (el as any)[ELEM_UID] = crypto.randomUUID();
  return (el as any)[ELEM_UID]!;
}

function isGlobalTarget(el: EventTarget) {
  // best-effort: in browsers window/document are singletons
  try {
    return el === window || el === document;
  } catch { return false; }
}

class EventRegistry {
  // element UID -> (key -> listener)
  private map = new Map<string, Map<Key, Listener>>();

  private key(type: string, ns?: string, capture?: boolean) {
    // capture influences listener identity on the platform, so key it as well
    const cap = capture ? '1' : '0';
    return `${type}::${ns ?? ''}::${cap}`;
  }

  has(el: EventTarget, type: string, ns?: string) {
    const uid = getUid(el as any);
    const inner = this.map.get(uid);
    // capture is unknown here, so check both phases
    return (inner?.has(this.key(type, ns, false)) || inner?.has(this.key(type, ns, true))) ?? false;
  }

  on(el: EventTarget, type: string, listener: Listener, opts?: ListenOpts) {
    const uid = getUid(el as any);
    // Default namespace for global targets without explicit ns -> __global__
    const ns = (isGlobalTarget(el) && !opts?.ns) ? '__global__' : opts?.ns;
    const key = this.key(type, ns, !!opts?.capture);
    let inner = this.map.get(uid);
    if (!inner) {
      inner = new Map();
      this.map.set(uid, inner);
    }

    // If singleton mode is requested OR this is a global target, we dedupe across namespaces
    if (inner.has(key) || opts?.singleton) {
      if (inner.has(key)) {
        // already attached with same (type, ns/capture) -> skip
        return;
      }
      // singleton: collapse different namespaces onto one slot by rewriting the key
      const singletonKey = this.key(type, '__singleton__', !!opts?.capture);
      if (inner.has(singletonKey)) return;
      // continue with singletonKey instead of original
      (inner as any).__useSingleton__ = true;
      (inner as any).__singletonKey__ = singletonKey;
    }

    // Wrap the listener so we can always remove the exact fn
    const wrapped: Listener = (e) => listener(e);
    const finalKey = (inner as any).__useSingleton__ ? (inner as any).__singletonKey__ : key;
    inner.set(finalKey, wrapped);
    // cleanup helper to clear flags for next call (not strictly needed, but tidy)
    (inner as any).__useSingleton__ = false;
    (inner as any).__singletonKey__ = undefined;

    // Normalize options: passive by default for scroll/touch, not for click
    const finalOpts: AddEventListenerOptions =
      typeof opts === 'object'
        ? { passive: opts.passive ?? (type !== 'click' && type !== 'keydown'), capture: opts.capture, once: opts.once, signal: opts.signal }
        : {};

    // Use the original method to avoid debug tracking noise for our managed listeners
    const originalAdd = (EventTarget.prototype as any).__originalAddEventListener || (el as any).addEventListener;
    originalAdd.call(el, type, wrapped, finalOpts);

    // If a signal is provided, cleanup automatically when aborted
    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => {
        this.off(el, type, opts?.ns);
      }, { once: true });
    }
  }

  off(el: EventTarget, type: string, ns?: string, capture?: boolean) {
    const uid = getUid(el as any);
    const inner = this.map.get(uid);
    if (!inner) return;
    // try exact key first, then singleton, then global default
    const tryKeys = [
      this.key(type, ns, !!capture),
      this.key(type, '__singleton__', !!capture),
      this.key(type, (isGlobalTarget(el) && !ns) ? '__global__' : ns, !!capture),
    ];
    const k = tryKeys.find(k => inner.has(k));
    const wrapped = k ? inner.get(k)! : undefined;
    if (!wrapped) return;
    // Use the original method to avoid debug tracking noise
    const originalRemove = (EventTarget.prototype as any).__originalRemoveEventListener || (el as any).removeEventListener;
    originalRemove.call(el, type, wrapped as EventListener, { capture: !!capture });
    inner.delete(k!);
    if (inner.size === 0) this.map.delete(uid);
  }

  offAll(el: EventTarget) {
    const uid = getUid(el as any);
    const inner = this.map.get(uid);
    if (!inner) return;
    for (const [k, fn] of inner) {
      const [type] = k.split('::');
      (el as any).removeEventListener(type, fn as EventListener);
    }
    this.map.delete(uid);
  }
}

export const eventRegistry = new EventRegistry();

// Backwards compatibility exports
export function on(el: EventTarget, type: string, nsOrListener: string | Listener, listenerOrOpts?: Listener | ListenOpts, opts?: ListenOpts): (() => void) {
  // Handle both old signature: on(el, type, ns, listener) and new: on(el, type, listener, opts)
  if (typeof nsOrListener === 'string') {
    // Old signature with namespace
    const ns = nsOrListener;
    const listener = listenerOrOpts as Listener;
    eventRegistry.on(el, type, listener, { ns, ...opts });
    return () => eventRegistry.off(el, type, ns, opts?.capture);
  } else {
    // New signature
    const listener = nsOrListener;
    const options = listenerOrOpts as ListenOpts;
    eventRegistry.on(el, type, listener, options);
    return () => eventRegistry.off(el, type, options?.ns, options?.capture);
  }
}

export const off = (el: EventTarget, type: string, ns?: string, capture?: boolean) => 
  eventRegistry.off(el, type, ns, capture);

export const offAll = (el: EventTarget) => 
  eventRegistry.offAll(el);

// Simple disposable bin for cleanup
export class DisposableBin {
  private cleanups: (() => void)[] = [];
  
  add(cleanup: () => void) {
    this.cleanups.push(cleanup);
  }
  
  dispose() {
    for (const cleanup of this.cleanups) {
      // Double-dispose happens in HMR/unmount races; keep it silent
      try { cleanup(); } catch { /* no-op */ }
    }
    this.cleanups.length = 0;
  }
}

// Development defaults installer (placeholder for compatibility)
export function installEventRegistryDevDefaults() {
  // No-op for now - the singleton registry handles everything
}

// Convenience helpers for common globals (opt into singleton by default)
export function onWindow(type: string, listener: Listener, opts?: ListenOpts) {
  eventRegistry.on(window, type, listener, { singleton: true, ...opts });
  return () => off(window, type, opts?.ns, opts?.capture);
}
export function onDocument(type: string, listener: Listener, opts?: ListenOpts) {
  eventRegistry.on(document, type, listener, { singleton: true, ...opts });
  return () => off(document, type, opts?.ns, opts?.capture);
}