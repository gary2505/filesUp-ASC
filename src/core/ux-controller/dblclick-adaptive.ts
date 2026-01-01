/**
 * Thin glue to combine the click controller with the adaptive delay learner.
 * You can recreate the controller when the learned delay changes,
 * or keep a stable controller if live retuning is not needed.
 */

import { DblClickLearner } from "./dblclick-learner";
import { createClickController } from "$lib/core/ux-controller/click-controller";
import type { ClickHandlers } from "$lib/core/ux-controller/click-controller";
import { createDebugLogger } from '$lib/core';

const debug = createDebugLogger('AdaptiveController');

export type AdaptiveController = ReturnType<typeof createClickController> & {
  noteDoubleInterval: (ms: number) => void;
  readonly currentDelay: number;
};

export function makeAdaptiveController(seedDelayMs: number, handlers: ClickHandlers): AdaptiveController {
  const learner = new DblClickLearner(seedDelayMs);

  debug.debug('ui', 'adaptiveInit', 'Adaptive controller created', { 
    seedDelayMs, 
    initialDelay: learner.delayMs 
  });

  const ctl = createClickController(
    {
      onSingle: handlers.onSingle,
      onDouble: handlers.onDouble,
    },
    { delayMs: learner.delayMs }
  );

  return {
    ...ctl,
    noteDoubleInterval(ms: number) {
      // Only observe plausible double intervals
      if (ms >= 120 && ms <= 700) {
        const oldDelay = learner.delayMs;
        learner.observe(ms);
        const newDelay = learner.delayMs;
        
        debug.debug('ui', 'adaptiveLearn', 'Double-click interval observed', { 
          intervalMs: ms, 
          oldDelay, 
          newDelay, 
          changed: oldDelay !== newDelay 
        });
      } else {
        debug.debug('ui', 'adaptiveReject', 'Double-click interval rejected', { 
          intervalMs: ms, 
          reason: 'outside plausible range (120-700ms)' 
        });
      }
    },
    get currentDelay() {
      return learner.delayMs;
    },
  };
}