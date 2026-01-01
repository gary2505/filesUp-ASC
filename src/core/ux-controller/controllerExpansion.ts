/**
 * expansion-controller.ts
 * Path-scoped expansion with per-path AbortController to cancel stale toggles.
 * Use this from both chevron and name dblclick to avoid cross-talk.
 */

export type ExpandOps = {
  expand: (path: string, loadChildren: () => Promise<void> | void) => Promise<void>;
  collapse: (path: string, clearChildren?: () => Promise<void> | void) => Promise<void>;
  toggle: (path: string, isExpanded: () => boolean, loadChildren: () => Promise<void> | void, clearChildren?: () => Promise<void> | void) => Promise<void>;
};

type Slot = { id: number; abort: AbortController };
const slots = new Map<string, Slot>();
let seq = 1;

function start(path: string): Slot {
  // Cancel any in-flight for this path
  const prev = slots.get(path);
  if (prev) prev.abort.abort("superseded");
  const s: Slot = { id: seq++, abort: new AbortController() };
  slots.set(path, s);
  return s;
}

function finish(path: string, s: Slot) {
  const cur = slots.get(path);
  if (cur && cur.id === s.id) {
    slots.delete(path);
  }
}

export const expansionController: ExpandOps = {
  async expand(path, loadChildren) {
    const s = start(path);
    try {
      await loadChildren();
    } finally {
      finish(path, s);
    }
  },
  async collapse(path, clearChildren) {
    const s = start(path);
    try {
      await (clearChildren?.());
    } finally {
      finish(path, s);
    }
  },
  async toggle(path, isExpanded, loadChildren, clearChildren) {
    if (isExpanded()) {
      return this.collapse(path, clearChildren);
    } else {
      return this.expand(path, loadChildren);
    }
  }
};
