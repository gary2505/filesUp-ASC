import fs from "fs";
import path from "path";

const BUNDLE_PATH = path.join(process.cwd(), ".ai", "bundles", "latest.bundle.md");

export type TraceEvent = {
  t: string;        // ISO time
  k: string;        // key, e.g. "BOOT_OK" or "K=10 FAIL boot-contract"
  msg: string;
  data?: any;
};

export type DebugBundle = {
  TRACE_SUMMARY: string;
  events: TraceEvent[];
  contracts: Array<{
    name: string;
    input: any;
    expected: any;
    got: any;
    ok: boolean;
  }>;
  logTail: string[];
};

export function writeDebugBundle(bundle: DebugBundle) {
  const lines: string[] = [];

  lines.push("# DEBUG BUNDLE (latest)");
  lines.push("");
  lines.push("## TRACE_SUMMARY");
  lines.push(bundle.TRACE_SUMMARY || "no summary");
  lines.push("");

  lines.push("## EVENTS");
  for (const e of bundle.events) {
    lines.push(`- ${e.t} [${e.k}] ${e.msg}`);
  }
  lines.push("");

  lines.push("## CONTRACTS");
  for (const c of bundle.contracts) {
    lines.push(`### ${c.name}`);
    lines.push("- ok: " + c.ok);
    lines.push("- input: `" + JSON.stringify(c.input) + "`");
    lines.push("- expected: `" + JSON.stringify(c.expected) + "`");
    lines.push("- got: `" + JSON.stringify(c.got) + "`");
    lines.push("");
  }

  lines.push("## LOG TAIL");
  for (const line of bundle.logTail) {
    lines.push("- " + line);
  }

  fs.mkdirSync(path.dirname(BUNDLE_PATH), { recursive: true });
  fs.writeFileSync(BUNDLE_PATH, lines.join("\n"), "utf8");
}
