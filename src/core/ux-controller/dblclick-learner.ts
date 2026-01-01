/**
 * Adaptive double-click delay learner using EWMA + hysteresis.
 * - Observes real double-click intervals and adjusts recommended delay gradually.
 * - Clamped bounds to avoid over/under reaction.
 */

export type DblClickLearnerOpts = {
  /** Minimum allowed delay (ms). Default: 200 */
  minMs?: number;
  /** Maximum allowed delay (ms). Default: 450 */
  maxMs?: number;
  /** EWMA alpha (0..1). Higher = faster adaptation. Default: 0.15 */
  alpha?: number;
  /** Require at least this gap to actually change exposed delay (ms). Default: 25 */
  hysteresisMs?: number;
  /** Margin below the EWMA for the exposed delay (ms). Default: -20 (slightly below) */
  floorMarginMs?: number;
  /** Margin above the EWMA for the exposed delay (ms). Default: +40 (a bit of headroom) */
  ceilMarginMs?: number;
};

export class DblClickLearner {
  private value: number; // exposed recommended delay
  private ewma: number;  // internal smoother
  private opts: Required<DblClickLearnerOpts>;

  constructor(seedMs: number, opts: DblClickLearnerOpts = {}) {
    this.opts = {
      minMs: opts.minMs ?? 200,
      maxMs: opts.maxMs ?? 450,
      alpha: opts.alpha ?? 0.15,
      hysteresisMs: opts.hysteresisMs ?? 25,
      floorMarginMs: opts.floorMarginMs ?? -20,
      ceilMarginMs: opts.ceilMarginMs ?? 40,
    };
    const clamped = this.clamp(seedMs);
    this.value = clamped;
    this.ewma = clamped;
  }

  /** Call this ONLY when the browser fired a genuine dblclick and intervalMs is valid. */
  observe(intervalMs: number) {
    const raw = this.clamp(intervalMs);
    // update EWMA
    this.ewma = this.opts.alpha * raw + (1 - this.opts.alpha) * this.ewma;

    // propose new target window around EWMA with margins
    let target = this.ewma;
    target = Math.min(
      Math.max(target + this.opts.floorMarginMs, this.opts.minMs),
      this.opts.maxMs
    );

    // hysteresis: change only if sufficiently different
    if (Math.abs(target - this.value) >= this.opts.hysteresisMs) {
      this.value = target;
    }
  }

  get delayMs() {
    return this.value;
  }

  /** Manual override: sets both value and resets EWMA baseline */
  setManually(ms: number) {
    const c = this.clamp(ms);
    this.value = c;
    this.ewma = c;
  }

  private clamp(ms: number) {
    return Math.min(Math.max(Math.round(ms), this.opts.minMs), this.opts.maxMs);
  }
}