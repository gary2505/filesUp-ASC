// src/lib/ux/key-controller.ts
import { forbidRapidRepeat } from '$lib/core/operations/actionGate';
import { createDebugLogger } from '$lib/core';
import { runExclusive } from '$lib/core/operations/raceOps';

/** Normalized key info */
export type KeyInfo = {
  key: string;          // "a", "Delete", "F2"
  code: string;         // "KeyA", "Delete", "F2"
  combo: string;        // "Ctrl+A", "Ctrl+Shift+Delete", "Enter"
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  repeat: boolean;      // OS-level repeat
};

export type KeyHandlerCtx = { signal: AbortSignal; originalEvent: KeyboardEvent };
export type KeyHandler = (info: KeyInfo, ctx: KeyHandlerCtx) => void | Promise<void>;

export type KeyControllerOptions = {
  /** Drop repeats faster than this window per combo (ms). */
  minRepeatMs?: number;                // default 120
  /** If true, call onRepeat handlers for OS repeat; otherwise coalesce. */
  allowHoldRepeat?: boolean;           // default false
  /** Prevent default for handled keys. */
  preventDefault?: boolean;            // default true
  /** Stop propagation for handled keys. */
  stopPropagation?: boolean;           // default true
  /** Filter targets (skip inputs/textarea/contentEditable by default). */
  acceptTarget?: (t: EventTarget | null) => boolean;
  /** Platform mapping: treat Meta as Ctrl on macOS for combos. */
  macMetaAsCtrl?: boolean;             // default true
};

export type Keybinding = {
  /** Normalized combo e.g., "Ctrl+A", "Delete", "Ctrl+Shift+V" */
  combo: string;
  /** Handler for initial press */
  onPress: KeyHandler;
  /** Optional handler for OS repeat if allowHoldRepeat=true */
  onRepeat?: KeyHandler;
};

const debug = createDebugLogger('KeyController');

/** Normalize OS/meta modifiers into a stable "Ctrl/Alt/Shift/Meta + Key" string */
function normalize(ev: KeyboardEvent, macMetaAsCtrl = true): KeyInfo {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const ctrl = !!ev.ctrlKey || (isMac && macMetaAsCtrl ? !!ev.metaKey : false);
  const meta = !!ev.metaKey; // still expose meta flag explicitly
  const alt = !!ev.altKey;
  const shift = !!ev.shiftKey;

  // Prefer printable ev.key when available; uppercase letters normalize in combo only
  const prettyKey = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;

  const mods = [
    ctrl ? 'Ctrl' : null,
    shift ? 'Shift' : null,
    alt ? 'Alt' : null,
    (!ctrl && meta) ? 'Meta' : null, // include Meta only if it isn't already acting as Ctrl
  ].filter(Boolean).join('+');

  const combo = mods ? `${mods}+${prettyKey}` : prettyKey;

  return {
    key: ev.key,
    code: ev.code,
    combo,
    ctrl,
    alt,
    shift,
    meta,
    repeat: ev.repeat,
  };
}

/** Default acceptTarget: ignore typing fields */
function defaultAcceptTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return true;
  if (el.closest?.('input, textarea, [contenteditable=""], [contenteditable="true"]')) return false;
  return true;
}

export function createKeyController(bindings: Keybinding[], opts: KeyControllerOptions = {}) {
  const minRepeatMs = opts.minRepeatMs ?? 120;
  const allowHoldRepeat = opts.allowHoldRepeat ?? false;
  const preventDefault = opts.preventDefault ?? true;
  const stopPropagation = opts.stopPropagation ?? true;
  const macMetaAsCtrl = opts.macMetaAsCtrl ?? true;
  const acceptTarget = opts.acceptTarget ?? defaultAcceptTarget;

  // Fast lookup map for bindings
  const map = new Map<string, Keybinding>();
  for (const b of bindings) map.set(b.combo, b);

  let busy = false;                         // simple mutex (no re-entrancy)
  let currentAbort: AbortController | null = null;
  let pending: { kind: 'press' | 'repeat'; b: Keybinding; info: KeyInfo; ev: KeyboardEvent } | null = null;

  function abortCurrent() {
    if (currentAbort) { currentAbort.abort(); currentAbort = null; }
  }

  async function run(kind: 'press' | 'repeat', b: Keybinding, info: KeyInfo, ev: KeyboardEvent) {
    pending = null;                 // consume last-only pending
    abortCurrent();                 // cancel previous run
    currentAbort = new AbortController();
    const signal = currentAbort.signal;

    debug.debug('ui', 'keyExec', `Executing ${kind}`, { combo: info.combo, code: info.code });

    busy = true;
    try {
      const op = `${kind}:${b.combo}`;
      await runExclusive(op, 'ui', kind, async () => {
        if (kind === 'press') {
          await b.onPress(info, { signal, originalEvent: ev });
        } else if (b.onRepeat) {
          await b.onRepeat(info, { signal, originalEvent: ev });
        }
      });
      debug.debug('ui', 'keyComplete', `${kind} done`, { combo: info.combo });
    } finally {
      busy = false;
      currentAbort = null;

      if (pending) {
        const { kind, b, info, ev } = pending;
        pending = null;
        // hop to next tick to avoid recursion
        setTimeout(() => { void run(kind, b, info, ev); }, 0);
      }
    }
  }

  function markHandled(ev: KeyboardEvent) {
    if (preventDefault) ev.preventDefault();
    if (stopPropagation) ev.stopPropagation();
  }

  const onKeyDown = (ev: KeyboardEvent) => {
    const info = normalize(ev, macMetaAsCtrl);

    const b = map.get(info.combo);
    if (!b) return;                 // not our combo

    if (!acceptTarget(ev.target)) return;

    // Rapid-repeat guard per combo
    const gateKey = `key:${b.combo}`;
    if (!forbidRapidRepeat(gateKey, minRepeatMs)) {
      debug.warn('overhead', 'rapidKey', 'Key press blocked (rapid)', { combo: info.combo });
      return;
    }

    // Coalesce OS auto-repeat unless enabled
    const kind: 'press' | 'repeat' = (info.repeat && allowHoldRepeat) ? 'repeat' : 'press';

    markHandled(ev);

    if (busy) {
      // Keep last-only pending
      pending = { kind: 'press', b, info, ev };
      return;
    }

    void run(kind, b, info, ev);
  };

  const onKeyUp = (_ev: KeyboardEvent) => { /* optional */ };

  return {
    onKeyDown,
    onKeyUp,
    isBusy: () => busy,
    abort: () => abortCurrent(),
    /** Extend at runtime (for feature flags, etc.) */
    addBinding(kb: Keybinding) { map.set(kb.combo, kb); },
    removeBinding(combo: string) { map.delete(combo); },
  };
}
