// src/taskFlow/contracts/checkUpdatesContract.ts
//
// Simple contract for update checks:
// - current_version must be a non-empty string
// - If update_available === true, latest_version must be non-empty
// - If update_available === false, latest_version may be null or equal to current_version

import type { UpdateCheckResult } from '../tasks/checkUpdatesTask';

export interface CheckUpdatesContractResult {
  ok: boolean;
  reason?: string;
}

export function checkUpdatesContract(
  inputCurrentVersion: string,
  result: UpdateCheckResult
): CheckUpdatesContractResult {
  if (!result.current_version) {
    return { ok: false, reason: 'current_version is empty in result' };
  }

  if (result.current_version !== inputCurrentVersion) {
    return {
      ok: false,
      reason: `current_version mismatch: input=${inputCurrentVersion}, result=${result.current_version}`
    };
  }

  if (result.update_available) {
    if (!result.latest_version) {
      return { ok: false, reason: 'update_available=true but latest_version is null' };
    }
    if (result.latest_version === result.current_version) {
      return {
        ok: false,
        reason: 'update_available=true but latest_version == current_version'
      };
    }
  }

  return { ok: true };
}
