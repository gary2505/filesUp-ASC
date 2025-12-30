// src/taskFlow/runtime/runFlowWithContracts.ts
// Used by: src/taskFlow/flows/bootFlow.ts, other flows
// Purpose: Wrapper that runs flows with automatic trace/contract collection and bundle writing.
// Trigger: Called by flow entry points (e.g., runBootFlow).
// Event Flow: resetTrace -> FLOW_START event -> run fn(ctx) -> catch errors -> collect events/contracts -> format -> write bundle
// Functions:
//   - runFlowWithContracts(flowName, fn, options): Execute flow with evidence pipeline

import { resetTrace, createTaskFlowCtx, getTraceEvents, getContracts, traceEvent, addContract, type TaskFlowCtx } from '../trace/index';
import { formatBundleMarkdown } from './formatBundle';
import { writeBundle } from './writeBundle';

export interface FlowOptions {
  writeOnOk?: boolean; // Write bundle even if flow succeeds (default: false, only write on FAIL)
}

export interface FlowResult {
  ok: boolean;
  contracts: ReturnType<typeof getContracts>;
}

/// Run a flow with automatic trace collection and bundle writing.
/// Why: Ensures every flow execution produces canonical evidence in .ai/bundles/latest.bundle.md.
/// Bundle written: ALWAYS on FAIL, on OK only if writeOnOk=true (for Boot proof).
/// Example: await runFlowWithContracts('bootFlow', async (ctx) => { ctx.addEvent('START', '...'); }, {writeOnOk: true})
export async function runFlowWithContracts(
  flowName: string,
  fn: (ctx: TaskFlowCtx) => Promise<void>,
  options: FlowOptions = {}
): Promise<FlowResult> {
  // Reset trace to start clean
  resetTrace();
  
  const ctx = createTaskFlowCtx();
  
  // Add FLOW_START event
  traceEvent('FLOW_START', `Flow ${flowName} started`);
  
  let flowError: Error | null = null;
  
  try {
    // Run the flow function
    await fn(ctx);
    
    // Check if any contract failed
    const contracts = getContracts();
    const hasFailed = contracts.some(c => !c.ok);
    
    if (hasFailed) {
      traceEvent('FLOW_FAIL', `Flow ${flowName} failed (contract failure)`);
    } else {
      traceEvent('FLOW_OK', `Flow ${flowName} completed successfully`);
    }
    
  } catch (err) {
    flowError = err as Error;
    
    // Add error contract
    addContract({
      name: `${flowName}/runtime-error`,
      input: { flowName },
      expected: { error: null },
      got: { error: flowError.message },
      ok: false
    });
    
    traceEvent('FLOW_ERROR', `Flow ${flowName} threw exception`, { error: flowError.message });
  }
  
  // Collect final events and contracts
  const events = getTraceEvents();
  const contracts = getContracts();
  const ok = !flowError && contracts.every(c => c.ok);
  
  // Write bundle: ALWAYS on FAIL, on OK only if writeOnOk=true
  const shouldWrite = !ok || options.writeOnOk;
  
  if (shouldWrite) {
    const summary = ok 
      ? `Flow ${flowName} executed successfully`
      : `Flow ${flowName} failed`;
    
    const logTail = flowError ? flowError.stack || flowError.message : undefined;
    
    const md = formatBundleMarkdown({
      summary,
      events,
      contracts,
      logTail
    });
    
    await writeBundle(md);
  }
  
  return { ok, contracts };
}
