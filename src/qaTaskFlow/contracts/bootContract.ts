// scr/qaTaskFlow/bootContract.ts
export type BootInput = { appVersion: string };
export type BootOutput = { ok: boolean };

export function checkBootContract(input: BootInput, output: BootOutput) {
  const expected = { ok: true };
  const ok = output.ok === expected.ok;

  return {
    name: "boot-contract",
    input,
    expected,
    got: output,
    ok
  };
}
