// src/taskFlow/trace/index.ts

/**
 * ============================================================================
 * FilesUP-Taskflow (filesup-asc) — Trace + Flow Context (Events + Contracts)
 * ============================================================================
 * This is: src/taskFlow/trace/index.ts
 *
 * Used by:
 * - src/taskFlow/runtime/* (Flow runtime / runner) / (not used yet)
 * - src/taskFlow/flows/* (Flow orchestrators) / (not used yet)
 * - src/taskFlow/contracts/* (Contract helpers) / (not used yet)
 *
 * Purpose:
 * - Provide a tiny, deterministic tracing surface for TaskFlow:
 *   - ctx.addEvent(key,msg,data)  -> collects readable events
 *   - ctx.addContract(contract)  -> collects QA contracts (ok=false => FAIL)
 * - Keep all flow evidence in-memory so runtime can write bundle artifacts.
 *
 * Trigger:
 * - Called when a Flow starts (runtime creates ctx) and throughout flow steps.
 *
 * Event Flow:
 * - Runtime creates ctx via createTaskFlowCtx()
 * - Flow uses ctx.addEvent(...) and ctx.addContract(...)
 * - Runtime reads getTraceEvents()/getContracts() and writes bundle
 *
 * List of functions:
 * - createTaskFlowCtx(): creates a ctx with addEvent/addContract
 * - traceEvent(): add an event (and console.log for live dev)
 * - addContract(): add a QA contract (and console.log ok/fail)
 * - getTraceEvents(): read collected events
 * - getContracts(): read collected contracts
 * - resetTrace(): clear collected events/contracts
 **/

export type TraceEvent = {
  t: string; // ISO time
  k: string; // event key
  msg: string; // human-readable message
  data?: unknown;
};

/**
 * Contract shape is a QA gate:
 * - ok=false => flow FAIL => bundle marks FAIL => QA exits non-zero.
 */
export type TaskFlowContract = {
  name: string;
  input: unknown;
  expected: unknown;
  got: unknown;
  ok: boolean;
};

/**
 * The only ctx API flows should rely on.
 * Why: keeps flows deterministic and easy to replay/test.
 */
export interface TaskFlowCtx {
  addEvent: (k: string, msg: string, data?: unknown) => void;
  addContract: (c: TaskFlowContract) => void;
}

let traceEvents: TraceEvent[] = [];
let contracts: TaskFlowContract[] = [];

// Keep trace bounded to avoid runaway memory during long dev sessions.
// Why: dev mistakes shouldn’t crash the app by accumulating unbounded arrays.
const MAX_EVENTS = 5000;
const MAX_CONTRACTS = 2000;

/**
 * Add a trace event.
 * What: records an event in memory (and logs to console for live debugging).
 * Why: flows must emit readable events that later end up in latest.bundle.md.
 *
 * @param k - short key (e.g. "FLOW_START", "SORT_OK", "K=10 FAIL sort/name")
 * @param msg - human-readable summary
 * @param data - optional structured data (keep small)
 */
export function traceEvent(k: string, msg: string, data?: unknown): void {
  const event: TraceEvent = {
    t: new Date().toISOString(),
    k,
    msg,
    data,
  };

  traceEvents.push(event);
  if (traceEvents.length > MAX_EVENTS) {
    traceEvents = traceEvents.slice(traceEvents.length - MAX_EVENTS);
  }

  // Console is useful during dev, but bundle is canonical evidence.
  // Why: you can reproduce bugs from bundle even if console is missing.
  // eslint-disable-next-line no-console
  console.log(`[${k}] ${msg}`, data ?? "");
}

/**
 * Add a contract result.
 * What: stores a deterministic regression check outcome.
 * Why: contracts are the QA gate; failures must be obvious and machine-readable.
 *
 * @param c - contract object in the required shape
 */
export function addContract(c: TaskFlowContract): void {
  contracts.push(c);
  if (contracts.length > MAX_CONTRACTS) {
    contracts = contracts.slice(contracts.length - MAX_CONTRACTS);
  }

  // Make FAIL loud in dev logs.
  // eslint-disable-next-line no-console
  console.log(
    c.ok ? `[CONTRACT OK] ${c.name}` : `[CONTRACT FAIL] ${c.name}`,
    { input: c.input, expected: c.expected, got: c.got }
  );
}

/**
 * Create a TaskFlow ctx.
 * What: returns the ctx object flows will receive.
 * Why: standardizes tracing & contract collection across all flows.
 *
 * @returns TaskFlowCtx
 */
export function createTaskFlowCtx(): TaskFlowCtx {
  return {
    addEvent: traceEvent,
    addContract,
  };
}

/**
 * Get all trace events.
 * What: returns the in-memory event list.
 * Why: runtime needs this to write .ai/bundles/latest.bundle.md.
 */
export function getTraceEvents(): TraceEvent[] {
  return traceEvents;
}

/**
 * Get all contracts.
 * What: returns the in-memory contract list.
 * Why: QA/runtime uses these to decide PASS/FAIL and to print evidence.
 */
export function getContracts(): TaskFlowContract[] {
  return contracts;
}

/**
 * Reset trace + contracts.
 * What: clears in-memory arrays.
 * Why: each flow (or QA run) should start from a clean slate.
 */
export function resetTrace(): void {
  traceEvents = [];
  contracts = [];
}
