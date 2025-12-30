// src/taskFlow/flows/openFolderFlow.ts
import { openFolderTask, type OpenFolderOutput } from '../tasks/openFolderTask';
import { checkOpenFolderContract } from '../contracts/openFolderContract';
import { runFlowWithContracts, type FlowContext } from '../core/runtime';

export async function openFolderFlow(folderPath: string) {
  return runFlowWithContracts('openFolderFlow', async (ctx: FlowContext) => {
    ctx.addEvent('OPEN_FOLDER_START', 'Opening folder', { folderPath });

    let output: OpenFolderOutput;
    try {
      output = await openFolderTask(folderPath);
      ctx.addEvent('OPEN_FOLDER_OK', `Opened folder with ${output.count} entries`, {
        folderPath,
        count: output.count
      });
    } catch (err) {
      ctx.addEvent('OPEN_FOLDER_FAIL', `Failed to open folder: ${err}`, { folderPath });
      throw err;
    }

    const contract = checkOpenFolderContract({ folderPath }, output);
    ctx.addContract(contract);

    if (!contract.ok) {
      ctx.addEvent(
        'K=20 FAIL open-folder-contract',
        'Folder structure contract failed',
        { contract }
      );
    }

    return output;
  }, {
    summary: `Open folder: ${folderPath}`,
    appVersion: '0.0.1',
    logTail: []
  });
}
