// Boot Flow: orchestrates initial ASC startup
import { helloTask, type HelloTaskInput, type HelloTaskOutput } from '../tasks/hello';
import { ContractTracker } from '../contracts/index';

export interface BootFlowState {
  hello?: HelloTaskOutput;
  contracts: ContractTracker;
  trace: string[];
}

export async function bootFlow(): Promise<BootFlowState> {
  const state: BootFlowState = {
    contracts: new ContractTracker(),
    trace: []
  };

  try {
    state.trace.push('[FLOW:BOOT] Starting boot flow');

    const helloInput: HelloTaskInput = { name: 'ASC' };
    state.trace.push('[FLOW:BOOT] Executing hello task');
    state.hello = await helloTask(helloInput);
    state.trace.push('[FLOW:BOOT] Hello task completed');

    state.trace.push('[FLOW:BOOT] Boot flow finished successfully');
  } catch (err) {
    state.trace.push(`[FLOW:BOOT:ERROR] ${err}`);
  }

  return state;
}
