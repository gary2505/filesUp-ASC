// src/taskFlow/flows/bootFlow.ts
// Used by: src/taskFlow/runtime/dispatch.ts
// Purpose: Boot flow that runs once on app startup to validate initial state.
// Trigger: Called by dispatch(cmdBoot()) on app mount.
// Event Flow: runFlowWithContracts -> BOOT_START -> runBootTask -> validate contract -> BOOT_OK/FAIL -> write bundle
// Functions:
//   - runBootFlow(appVersion): Execute boot validation and write initial bundle evidence

import { runBootTask } from "../tasks/bootTask";
import { checkBootContract } from "../contracts/bootContract";
import { runFlowWithContracts } from "../runtime/runFlowWithContracts";

/// Run the boot flow to validate app initialization.
/// Why: Produces initial bundle evidence proving the app started correctly.
/// Bundle: Written on both OK and FAIL (writeOnOk=true) for startup proof.
/// Example: await runBootFlow('0.0.1')
export async function runBootFlow(appVersion: string) {
  return runFlowWithContracts("bootFlow", async (ctx) => {
    ctx.addEvent("BOOT_START", "Boot flow started", { appVersion });

    const output = await runBootTask();

    const contract = checkBootContract({ appVersion }, output);
    ctx.addContract(contract);

    ctx.addEvent(
      contract.ok ? "BOOT_OK" : "BOOT_FAIL",
      contract.ok ? "Boot contract OK" : "Boot contract failed",
      { appVersion, output }
    );
  }, {
    writeOnOk: true // Write bundle even on success for startup proof
  });
}
