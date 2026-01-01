/**
 * per-node-click-controller.ts
 * Creates isolated click controllers per nodePath so events from different rows never collide.
 */
import { createClickController, type ClickHandlers } from "./click-controller";

type Ctl = ReturnType<typeof createClickController>;

const map = new Map<string, Ctl>();

export function getControllerForNode(nodePath: string, handlers: ClickHandlers, opts?: { delayMs?: number }) {
  let ctl = map.get(nodePath);
  if (!ctl) {
    ctl = createClickController(handlers, { delayMs: opts?.delayMs ?? 0 });
    map.set(nodePath, ctl);
  }
  return ctl;
}

/** Optional: clear a controller for a node (e.g., when a row unmounts) */
export function disposeControllerForNode(nodePath: string) {
  map.delete(nodePath);
}
