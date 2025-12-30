// src/taskFlow/flows/bootFlow.ts
import { runBootTask } from "../tasks/bootTask";
import { checkBootContract } from "../contracts/bootContract";
import { runFlowWithContracts, FlowContext } from "../core/runtime";

export async function runBootFlow(appVersion: string) {
  return runFlowWithContracts("bootFlow", async (ctx: FlowContext) => {
    ctx.addEvent("BOOT_FLOW_START", "Boot flow started", { appVersion });

    const output = await runBootTask();

    const contract = checkBootContract({ appVersion }, output);
    ctx.addContract(contract);

    ctx.addEvent(
      contract.ok ? "BOOT_OK" : "K=10 FAIL boot-contract",
      contract.ok ? "Boot contract OK" : "Boot contract failed",
      { appVersion, output }
    );

    // Can return output if needed elsewhere
    return output;
  }, {
    summary: `Boot flow for version ${appVersion}`,
    appVersion,
    logTail: [] // later: add log tail here
  });
}
