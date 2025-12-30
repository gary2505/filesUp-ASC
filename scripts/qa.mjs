// qa/qa.mjs
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * ============================================================================
 * FilesUP-Taskflow (filesup-asc) — QA Runtime (REAL gate, not stub)
 * ============================================================================
 * This is: qa/qa.mjs
 *
 * Used by:
 * - package.json -> scripts.qa -> `pnpm run qa`
 * - (not used elsewhere)
 *
 * Purpose:
 * - Run deterministic QA gates and always write canonical evidence:
 *     .ai/bundles/latest.bundle.md
 *     .ai/state.json
 *     .ai/state.md
 * - Contracts are the QA gate:
 *     { name, input, expected, got, ok }
 *   If any ok === false => QA FAIL => exit code 1
 *
 * Trigger:
 * - User/CI runs: `pnpm run qa`
 *
 * Event Flow:
 * - pnpm run qa
 *   -> node qa/qa.mjs
 *     -> runGates()
 *     -> write state.json/state.md
 *     -> write latest.bundle.md (events + contracts)
 *     -> exit 0 (PASS) or 1 (FAIL)
 *
 * List of functions:
 * - ensureDir(p): create folder (why: evidence must always write)
 * - safeReadText(p): read file or null (why: QA should not crash on missing optional files)
 * - writeText(p,s): write file (why: bundle/state artifacts are mandatory)
 * - nowIso(): ISO time (why: stable timestamps)
 * - listDirs(p): list subfolders (why: detect src/taskFlow structure)
 * - walkFiles(dir): list files recursively (why: size gates)
 * - countLines(text): count lines (why: ≤250 line gate)
 * - makeContract(...): build contract shape (why: canonical QA format)
 * - renderBundle(...): bundle markdown (why: canonical evidence)
 * - renderStateMd(...): state markdown (why: quick status for the agent)
 * - runGates(): main QA logic (why: single “factory” entry)
 */

/**
 * Ensure directory exists.
 * Why: QA must ALWAYS be able to write bundle/state artifacts.
 *
 * @param {string} p - dir path
 */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Read text safely.
 * Why: missing optional files should not crash QA.
 *
 * @param {string} p - file path
 * @returns {string|null}
 */
function safeReadText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/**
 * Write text file (UTF-8).
 * Why: evidence artifacts are mandatory outputs of QA.
 *
 * @param {string} p - file path
 * @param {string} s - content
 */
function writeText(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, "utf8");
}

/**
 * ISO timestamp helper.
 * Why: consistent, sortable timestamps in bundles and state.
 *
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * List immediate subdirectories.
 * Why: used to report src/taskFlow structure quickly.
 *
 * @param {string} p - dir path
 * @returns {string[]}
 */
function listDirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Recursively walk files.
 * Why: size gates need to inspect every *.ts/*.svelte in src/taskFlow.
 *
 * @param {string} rootDir - directory to walk
 * @returns {string[]}
 */
function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    let ents = [];
    try {
      ents = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of ents) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        // Skip common heavy folders (why: avoid slow QA + noise)
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === "target") {
          continue;
        }
        stack.push(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }

  return out;
}

/**
 * Count lines in a file.
 * Why: enforce ≤250 lines rule for taskFlow files.
 *
 * @param {string} text
 * @returns {number}
 */
function countLines(text) {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

/**
 * Build a contract in the required canonical shape.
 * Why: contracts are the QA gate and must be machine-readable.
 *
 * @param {string} name
 * @param {any} input
 * @param {any} expected
 * @param {any} got
 * @param {boolean} ok
 * @returns {{name:string,input:any,expected:any,got:any,ok:boolean}}
 */
function makeContract(name, input, expected, got, ok) {
  return { name, input, expected, got, ok };
}

/**
 * Render bundle markdown.
 * Why: `.ai/bundles/latest.bundle.md` is canonical evidence.
 *
 * @param {{summary:string,events:string[],contracts:any[],logTail:string|null}} param0
 * @returns {string}
 */
function renderBundle({ summary, events, contracts, logTail }) {
  const lines = [];
  lines.push("# DEBUG BUNDLE (latest)");
  lines.push("");
  lines.push("## TRACE_SUMMARY");
  lines.push(summary || "(none)");
  lines.push("");
  lines.push("## EVENTS");
  if (!events.length) lines.push("- (none)");
  for (const e of events) lines.push(`- ${e}`);
  lines.push("");
  lines.push("## CONTRACTS");
  if (!contracts.length) {
    lines.push("_(none)_");
  } else {
    for (const c of contracts) {
      lines.push(`- ${c.ok ? "✅" : "❌"} ${c.name}`);
      lines.push(`  - input: ${JSON.stringify(c.input)}`);
      lines.push(`  - expected: ${JSON.stringify(c.expected)}`);
      lines.push(`  - got: ${JSON.stringify(c.got)}`);
    }
  }
  lines.push("");
  lines.push("## LOG TAIL");
  if (!logTail) {
    lines.push("_(none)_");
  } else {
    lines.push("```");
    lines.push(logTail);
    lines.push("```");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Render state.md.
 * Why: quick “agent view” of current status without scanning full bundle.
 *
 * @param {any} state
 * @returns {string}
 */
function renderStateMd(state) {
  const lines = [];
  lines.push("# State Report");
  lines.push(`Generated: ${state.generated}`);
  lines.push("");
  lines.push("## Repo Structure");
  lines.push(`- Root: \`${state.root}\``);
  lines.push(`- taskFlow exists: ${state.taskFlowExists ? "true" : "false"}`);
  lines.push(`- subfolders: ${state.taskFlowSubfolders.join(", ") || "(none)"}`);
  lines.push("");
  lines.push("## Key Files");
  lines.push(`- bundlePath: ${state.bundlePathOk ? "✓" : "✗"}`);
  lines.push(`- qaPath: ${state.qaPathOk ? "✓" : "✗"}`);
  lines.push(`- packPath: ${state.packPathOk ? "✓" : "✗"}`);
  lines.push(`- bootFlowPath: ${state.bootFlowPathOk ? "✓" : "✗"}`);
  lines.push(`- tauriBackend: ${state.tauriBackendOk ? "✓" : "✗"}`);
  lines.push("");
  lines.push("## Status");
  lines.push(`- Last failing contract: ${state.lastFailingContract || "none"}`);
  lines.push("");
  lines.push("## Next Plan");
  for (const p of state.nextPlan) lines.push(`- ${p}`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Run all QA gates and produce contracts + state.
 * Why: single deterministic QA entry for CI + agents.
 *
 * @returns {{events:string[],contracts:any[],state:any,exitCode:number,logTail:string|null}}
 */
function runGates() {
  const events = [];
  const contracts = [];
  let exitCode = 0;
  let logTail = null;

  const ROOT = process.cwd();
  const AI_DIR = path.join(ROOT, ".ai");
  const BUNDLES_DIR = path.join(AI_DIR, "bundles");
  const BUNDLE_FILE = path.join(BUNDLES_DIR, "latest.bundle.md");
  const STATE_JSON = path.join(AI_DIR, "state.json");
  const STATE_MD = path.join(AI_DIR, "state.md");

  const qaPath = path.join(ROOT, "qa", "qa.mjs");
  const taskFlowDir = path.join(ROOT, "src", "taskFlow");
  const wrongTaskflowDir = path.join(ROOT, "src", "taskflow"); // MUST NOT exist

  const now = nowIso();
  events.push(`${now} [QA_START] pnpm run qa started`);

  // ---- Gate 0: basic files exist (informational, but also sanity) ----
  const bundlePathOk = true; // we can always write it (we control it)
  const qaPathOk = fs.existsSync(qaPath);

  // pack.mjs can live in different places depending on your setup.
  // Why: we accept multiple known locations to avoid false negatives.
  const packCandidates = [
    path.join(ROOT, "scripts", "pack.mjs"),
    path.join(ROOT, "filesUp-ASC", "scripts", "pack.mjs"),
    path.join(ROOT, ".ai", "scripts", "pack.mjs"),
  ];
  const packPathFound = packCandidates.find((p) => fs.existsSync(p)) || null;
  const packPathOk = Boolean(packPathFound);

  // boot flow detection (informational; don’t fail yet)
  const bootFlowDir = path.join(taskFlowDir, "flows");
  let bootFlowPathOk = false;
  try {
    if (fs.existsSync(bootFlowDir)) {
      const files = fs.readdirSync(bootFlowDir);
      bootFlowPathOk = files.some((f) => f.toLowerCase().includes("boot") && f.toLowerCase().includes("flow"));
    }
  } catch {
    bootFlowPathOk = false;
  }

  const tauriBackendOk = fs.existsSync(path.join(ROOT, "src-tauri", "src", "lib.rs"));

  // ---- Gate 1: enforce correct canonical folder name ----
  // On Windows, filesystem is case-insensitive, so we check actual directory listing
  let wrongDirExists = false;
  try {
    const srcEntries = fs.readdirSync(path.join(ROOT, "src"));
    // Check if there's a folder named exactly "taskflow" (lowercase) in the listing
    wrongDirExists = srcEntries.includes("taskflow");
  } catch {
    wrongDirExists = false;
  }
  const noWrongDirOk = !wrongDirExists;
  contracts.push(
    makeContract(
      "layoutGate/noLowercaseTaskflow",
      { forbidden: "src/taskflow" },
      { exists: false },
      { exists: wrongDirExists },
      noWrongDirOk
    )
  );
  if (!noWrongDirOk) exitCode = 1;

  // ---- Gate 2: enforce required taskFlow subfolders ----
  const required = ["contracts", "core", "flows", "tasks", "runtime", "trace"];
  const taskFlowExists = fs.existsSync(taskFlowDir);
  const subfolders = taskFlowExists ? listDirs(taskFlowDir) : [];
  const missing = required.filter((d) => !subfolders.includes(d));

  const layoutOk = taskFlowExists && missing.length === 0;
  contracts.push(
    makeContract(
      "layoutGate/requiredDirs",
      { required: required.map((d) => `src/taskFlow/${d}`) },
      { missing: [] },
      { missing: missing.map((d) => `src/taskFlow/${d}`) },
      layoutOk
    )
  );
  if (!layoutOk) exitCode = 1;

  // ---- Gate 3: size gate (≤250 lines) for taskFlow TS/Svelte files ----
  const MAX_LINES = 250;
  let violations = 0;

  if (taskFlowExists) {
    const files = walkFiles(taskFlowDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ext === ".ts" || ext === ".svelte";
    });

    for (const f of files) {
      const txt = safeReadText(f);
      if (txt == null) continue;
      const lines = countLines(txt);
      if (lines > MAX_LINES) {
        violations += 1;
        contracts.push(
          makeContract(
            "sizeGate/maxLines",
            { file: path.relative(ROOT, f).split(path.sep).join("/") },
            { maxLines: MAX_LINES },
            { lines },
            false
          )
        );
        exitCode = 1;
      }
    }
  }

  contracts.push(
    makeContract(
      "sizeGate/summary",
      { scope: "src/taskFlow" },
      { maxLines: MAX_LINES, violations: 0 },
      { maxLines: MAX_LINES, violations },
      violations === 0
    )
  );

  // ---- Gate 4: pack exists (so “one thread memory” can be generated) ----
  contracts.push(
    makeContract(
      "toolsGate/packExists",
      { candidates: packCandidates.map((p) => p.split(path.sep).join("/")) },
      { found: true },
      { found: packPathOk, path: packPathFound ? packPathFound.split(path.sep).join("/") : null },
      packPathOk
    )
  );
  if (!packPathOk) exitCode = 1;

  const ok = exitCode === 0;
  events.push(`${nowIso()} [QA_${ok ? "OK" : "FAIL"}] ${ok ? "QA passed" : "QA failed (see contracts)"}`);

  const firstFail = contracts.find((c) => !c.ok)?.name || null;

  const state = {
    generated: nowIso(),
    root: ROOT,
    taskFlowExists,
    taskFlowSubfolders: subfolders,
    bundlePathOk,
    qaPathOk,
    packPathOk,
    bootFlowPathOk,
    tauriBackendOk,
    lastFailingContract: firstFail,
    nextPlan: [
      "If QA FAIL: fix the first failing contract shown above",
      "Ensure app runtime writes bundle after every flow (bundle-first)",
      "Add Command + dispatch layer (mouse+keyboard unify)",
      "Implement sortFlow + sortContract and wire UI sort triggers to dispatch(Cmd.Sort)",
    ],
  };

  // Always write state artifacts (why: the agent needs them even on FAIL)
  writeText(STATE_JSON, JSON.stringify(state, null, 2));
  console.log(`✓ ${path.relative(ROOT, STATE_JSON)}`);
  
  writeText(STATE_MD, renderStateMd(state));
  console.log(`✓ ${path.relative(ROOT, STATE_MD)}`);

  // Always write bundle artifact (why: canonical evidence)
  ensureDir(BUNDLES_DIR);
  writeText(
    BUNDLE_FILE,
    renderBundle({
      summary: ok ? "QA executed" : "QA failed",
      events,
      contracts,
      logTail,
    })
  );
  console.log(`✓ ${path.relative(ROOT, BUNDLE_FILE)}`);
  
  if (ok) {
    console.log("\n✅ QA PASSED: All gates OK");
  } else {
    console.log("\n❌ QA FAILED: See contracts in bundle");
  }

  return { events, contracts, state, exitCode, logTail };
}

/**
 * MAIN
 * What: runs QA gates and exits with proper code.
 * Why: CI + agents depend on PASS=0 / FAIL=1 behavior.
 */
try {
  const res = runGates();
  process.exit(res.exitCode);
} catch (err) {
  /** @type {Error|unknown} */
  const error = err;
  const msg = (error instanceof Error ? error.stack : null) || String(err);
  const ROOT = process.cwd();
  const BUNDLE_FILE = path.join(ROOT, ".ai", "bundles", "latest.bundle.md");

  const now = nowIso();
  const events = [
    `${now} [QA_START] pnpm run qa started`,
    `${now} [QA_CRASH] ${String(msg).split("\n")[0]}`,
  ];

  writeText(
    BUNDLE_FILE,
    renderBundle({
      summary: "QA crashed",
      events,
      contracts: [],
      logTail: msg,
    })
  );

  process.exit(1);
}
