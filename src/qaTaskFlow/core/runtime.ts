// src/qaTaskFlow/core/runtime.ts
import { writeDebugBundle } from "./debugBundle";
import { traceEvent, resetTrace, getTraceEvents, getTraceSummary } from "./trace";

export type ContractResult = {
  name: string;
  input: any;
  expected: any;
  got: any;
  ok: boolean;
};

export type TraceEvent = {
  t: string;         // ISO timestamp
  k: string;         // key, e.g. "FLOW_START" or "K=10 FAIL boot-contract"
  msg: string;
  data?: any;
};

export type TaskContext = {
  flowName: string;
  addEvent: (k: string, msg: string, data?: any) => void;
  addContract: (c: ContractResult) => void;
};

export type FlowContext = TaskContext;

export type RunFlowOptions = {
  summary?: string;       // custom TRACE_SUMMARY (if needed)
  logTail?: string[];     // log tail if available
  appVersion?: string;    // metadata (optional)
};

export type FlowImpl<T = any> = (ctx: FlowContext) => Promise<T>;

/**
 * Unified runtime for any Flows.
 *
 * - resets events/contracts
 * - logs FLOW_START
 * - calls impl(ctx)
 * - writes .ai/bundles/latest.bundle.md
 * - if any contract ok === false → throws error
 */
export async function runFlowWithContracts<T>(
  flowName: string,
  impl: FlowImpl<T>,
  opts: RunFlowOptions = {}
): Promise<T> {
  // Reset trace buffer at start
  resetTrace();
  
  const contracts: ContractResult[] = [];

  const ctx: FlowContext = {
    flowName,
    addEvent: (k, msg, data) => {
      traceEvent(k, msg, data);
    },
    addContract: (c) => {
      contracts.push(c);
    }
  };

  traceEvent("FLOW_START", `Flow ${flowName} started`, { opts });

  let result: T;

  try {
    result = await impl(ctx);

    const allOk = contracts.every((c) => c.ok);
    const summaryBase =
      opts.summary ??
      (allOk
        ? `Flow ${flowName} completed successfully`
        : `Flow ${flowName} completed with contract failures`);

    const failedNames = contracts.filter((c) => !c.ok).map((c) => c.name);
    if (!allOk) {
      traceEvent(
        "FLOW_CONTRACT_FAIL",
        `Flow ${flowName} has failing contracts`,
        { failedContracts: failedNames }
      );
    } else {
      traceEvent("FLOW_CONTRACT_OK", `All contracts passed for ${flowName}`);
    }

    writeDebugBundle({
      TRACE_SUMMARY: summaryBase,
      events: getTraceEvents(),
      contracts,
      logTail: opts.logTail ?? []
    });

    if (!allOk) {
      throw new Error(
        `Flow ${flowName} has failing contracts: ${failedNames.join(", ")}`
      );
    }

    return result;
  } catch (err: any) {
    const msg = err?.message ?? String(err);

    traceEvent("FLOW_ERROR", "Flow threw an error", { errorMessage: msg });

    const summary =
      opts.summary ??
      `Flow ${flowName} threw error: ${msg}`;

    writeDebugBundle({
      TRACE_SUMMARY: summary,
      events: getTraceEvents(),
      contracts,
      logTail: opts.logTail ?? []
    });

    throw err;
  }
}
