import type { BootOutput } from "../contracts/bootContract";

export async function runBootTask(): Promise<BootOutput> {
  // later: more checks (env, config, etc.)
  return { ok: true };
}
