import './app.css';
import App from './App.svelte';
import { runBootFlow } from './taskFlow/flows/bootFlow';
import { writeLatestBundle } from './taskFlow/core/writeBundle';

const app = new App({
  target: document.getElementById('app') as HTMLElement,
});

// Startup: run boot flow + write debug bundle
(async () => {
  const r = await runBootFlow("0.0.1");
  const lines: string[] = [];
  lines.push("# DEBUG BUNDLE (latest)\n");
  lines.push("## TRACE_SUMMARY");
  lines.push(`Boot flow for version 0.0.1\n`);
  lines.push("## EVENTS");
  lines.push(`- ${new Date().toISOString()} [FLOW_START] Flow bootFlow started`);
  lines.push(`- ${new Date().toISOString()} [BOOT_OK] Boot contract ${r.ok ? "OK" : "FAIL"}`);
  lines.push(`- ${new Date().toISOString()} [FLOW_CONTRACT_${r.ok ? "OK" : "FAIL"}] All contracts ${r.ok ? "passed" : "failed"} for bootFlow\n`);
  lines.push("## CONTRACTS");
  lines.push("### boot-contract");
  lines.push(`- ok: ${r.contract.ok}`);
  lines.push(`- input: \`${JSON.stringify(r.contract.input)}\``);
  lines.push(`- expected: \`${JSON.stringify(r.contract.expected)}\``);
  lines.push(`- got: \`${JSON.stringify(r.contract.got)}\`\n`);
  lines.push("## LOG TAIL\n");

  await writeLatestBundle(lines.join("\n"));
})();

export default app;
