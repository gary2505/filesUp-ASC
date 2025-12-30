// src/taskFlow/flows/checkUpdatesFlow.ts
//
// ASC flow that uses:
//   - traceEvent for compact tracer
//   - runFlowWithContracts for bundle + QA
//
// It glues together:
//   - checkUpdatesTask (Tauri TUF client)
//   - checkUpdatesContract (shape + logic)
// and writes everything into .ai/bundles/latest.bundle.md.

import { traceEvent } from '../core/trace';
import { runFlowWithContracts, type FlowContext } from '../core/runtime';
import { checkUpdatesTask } from '../tasks/checkUpdatesTask';
import { checkUpdatesContract } from '../contracts/checkUpdatesContract';

export interface CheckUpdatesFlowInput {
  currentVersion: string;
  platformId: string;
}

export interface CheckUpdatesFlowOutput {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
}

export async function runCheckUpdatesFlow(
  input: CheckUpdatesFlowInput
): Promise<CheckUpdatesFlowOutput> {
  return runFlowWithContracts<CheckUpdatesFlowInput, CheckUpdatesFlowOutput>(
    'check_updates_flow',
    async (ctx: FlowContext<CheckUpdatesFlowInput, CheckUpdatesFlowOutput>) => {
      traceEvent('UPD_FLOW_START', 'Starting TUF update check', {
        currentVersion: input.currentVersion,
        platformId: input.platformId
      });

      const result = await checkUpdatesTask(
        input.currentVersion,
        input.platformId
      );

      traceEvent('UPD_FLOW_RESULT', 'TUF update check result', result);

      // Contract: shape + basic logic
      const contractResult = checkUpdatesContract(input.currentVersion, result);
      ctx.addContract('checkUpdatesContract', {
        input,
        result,
        contractResult
      });

      if (!contractResult.ok) {
        ctx.fail(`Update check contract failed: ${contractResult.reason ?? 'unknown reason'}`);
      }

      const output: CheckUpdatesFlowOutput = {
        updateAvailable: result.update_available,
        currentVersion: result.current_version,
        latestVersion: result.latest_version
      };

      ctx.setOutput(output);

      traceEvent('UPD_FLOW_DONE', 'Update check flow completed', output);

      return output;
    },
    input
  );
}
