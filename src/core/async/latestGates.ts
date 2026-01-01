// src/lib/async/latestGates.ts
// Panel-specific InflightGates to prevent stale results
import { InflightGate } from './inflightGate';

// One gate per panel + one global
export const latestP1 = new InflightGate();
export const latestP2 = new InflightGate();
export const latestP3 = new InflightGate();
export const latestGLOBAL = new InflightGate();

// Convenience map for dynamic access
export const latestGates = {
  P1: latestP1,
  P2: latestP2,
  P3: latestP3,
  GLOBAL: latestGLOBAL
} as const;
