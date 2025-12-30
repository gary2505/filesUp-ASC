// src/taskFlow/contracts/openFolderContract.ts
import type { OpenFolderOutput } from '../tasks/openFolderTask';

export type OpenFolderInput = { folderPath: string };

export function checkOpenFolderContract(
  input: OpenFolderInput,
  output: OpenFolderOutput
) {
  const ok =
    output !== null &&
    typeof output === 'object' &&
    typeof output.path === 'string' &&
    Array.isArray(output.entries) &&
    typeof output.count === 'number' &&
    output.count === output.entries.length &&
    output.path === input.folderPath;

  return {
    name: 'open-folder-contract',
    input,
    expected: {
      path: input.folderPath,
      entriesIsArray: true,
      countMatchesLength: true
    },
    got: {
      path: output?.path,
      entriesIsArray: Array.isArray(output?.entries),
      countMatchesLength: output?.count === output?.entries?.length
    },
    ok
  };
}
