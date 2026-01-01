// scripts/state.mjs
import fs from "node:fs";
import path from "node:path";

/**
 * ============================================================================
 * FilesUP-Taskflow (filesup-asc) — State Generator
 * ============================================================================
 * This is: scripts/state.mjs
 *
 * Used by:
 * - qa/qa.mjs (recommended to import and call generateState + writeStateFiles)
 * - (optional) manual runs from node scripts, CI helpers
 *
 * Purpose:
 * - Produce a compact “repo snapshot” for the agent:
 *   - verifies canonical layout: src/qaTaskFlow/{core,runtime,trace,contracts,tasks,flows}
 *   - detects forbidden folder: src/taskflow (lowercase)
 *   - checks key files exist (bundle, qa, pack, bootFlow, tauri backend)
 *   - extracts last failing contract from latest.bundle.md
 * - Outputs:
 *   - .ai/state.json
 *   - .ai/state.md
 *
 * Trigger:
 * - Called from QA runtime (pnpm run qa) or pack tooling
 *
 * Event Flow:
 * - QA runs
 *   -> generateState()
 *   -> writeStateFiles()
 *   -> agent reads .ai/state.md next session
 *
 * List of functions:
 * - ensureDir(p): create folder (why: writing state must never fail)
 * - safeReadText(p): read text or null (why: missing files shouldn’t crash)
 * - listSubdirs(p): list subfolders (why: repo structure snapshot)
 * - parseLastFailingContract(bundleText): extract first failing contract name
 * - fileExists(p): boolean exists check
 * - generateState(opts): build {json, md}
 * - writeStateFiles(opts): write .ai/state.json + .ai/state.md
 */

const REQUIRED_TASKFLOW_SUBFOLDERS = [
  "contracts",
  "core",
  "flows",
  "tasks",
  "runtime",
  "trace",
];

/**
 * Ensure a directory exists.
 * Why: state writing must never fail due to missing folders.
 *
 * @param {string} p - Directory path
 */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Read a text file safely.
 * Why: missing files (bundle/state) should not crash state generation.
 *
 * @param {string} p - File path
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
 * List immediate subdirectories.
 * Why: gives agent a quick view of what exists under src/qaTaskFlow.
 *
 * @param {string} p - Directory path
 * @returns {string[]} Sorted folder names
 */
function listSubdirs(p) {
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
 * Parse the first failing contract name from bundle markdown.
 * Why: agent needs a single “first target” to fix without scanning everything.
 *
 * Accepted patterns (any one of these):
 * - "- ❌ contractName"
 * - "- ❌ **contractName**"
 *
 * @param {string|null} bundleText - Full bundle markdown
 * @returns {string|null}
 */
function parseLastFailingContract(bundleText) {
  if (!bundleText) return null;

  // Find the first failing contract line in CONTRACTS section.
  // Keep it simple and robust.
  const lines = bundleText.split(/\r\n|\r|\n/);
  for (const line of lines) {
    // Example: "- ❌ layoutGate/requiredDirs"
    if (line.startsWith("- ❌ ")) {
      const raw = line.slice("- ❌ ".length).trim();

      // Strip simple markdown bold if present: **name**
      const boldMatch = raw.match(/^\*\*(.+?)\*\*$/);
      if (boldMatch) return boldMatch[1].trim();

      return raw;
    }
  }

  return null;
}

/**
 * Exists helper.
 * Why: keeps generateState readable and consistent.
 *
 * @param {string} p
 * @returns {boolean}
 */
function fileExists(p) {
  return fs.existsSync(p);
}

/**
 * Generate state JSON + Markdown from the current repo.
 * Why: agent uses this as a compact “where are we” snapshot every session.
 *
 * @param {Object} opts - Options
 * @param {string} [opts.repoRoot] - Repository root path (defaults to cwd)
 * @param {string} [opts.planPath] - Path to docs/next_plan.md (optional)
 * @returns {{json: Object, md: string}}
 */
export function generateState(opts = {}) {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const planPath = opts.planPath ?? path.join(repoRoot, "docs", "next_plan.md");

  // ---- 1) Canonical folder checks ----
  const taskFlowPath = path.join(repoRoot, "src", "qaTaskFlow");
  const taskFlowExists = fileExists(taskFlowPath);

  // Forbidden lowercase path (must NOT exist)
  const wrongTaskflowPath = path.join(repoRoot, "src", "taskflow");
  const wrongTaskflowExists = fileExists(wrongTaskflowPath);

  const subfolders = taskFlowExists ? listSubdirs(taskFlowPath) : [];
  const missingRequiredSubfolders = REQUIRED_TASKFLOW_SUBFOLDERS.filter(
    (d) => !subfolders.includes(d)
  );

  // ---- 2) Key file checks (support multiple known locations) ----
  const bundlePath = path.join(repoRoot, ".ai", "bundles", "latest.bundle.md");

  const qaCandidates = [
    path.join(repoRoot, "qa", "qa.mjs"),
    path.join(repoRoot, "scripts", "qa.mjs"),
  ];
  const qaPathFound = qaCandidates.find((p) => fileExists(p)) ?? null;

  const packCandidates = [
    path.join(repoRoot, "scripts", "pack.mjs"),
    path.join(repoRoot, "filesUp-ASC", "scripts", "pack.mjs"),
    path.join(repoRoot, ".ai", "scripts", "pack.mjs"),
  ];
  const packPathFound = packCandidates.find((p) => fileExists(p)) ?? null;

  const bootFlowPath = path.join(repoRoot, "src", "qaTaskFlow", "flows", "bootFlow.ts");
  const libPath = path.join(repoRoot, "src-tauri", "src", "lib.rs");
  const mainPath = path.join(repoRoot, "src-tauri", "src", "main.rs");
  const tauriPathFound = fileExists(libPath) ? libPath : fileExists(mainPath) ? mainPath : null;

  // ---- 3) Extract last failing contract from bundle ----
  const bundleContent = safeReadText(bundlePath);
  const lastFailingContractId = parseLastFailingContract(bundleContent);

  // ---- 4) Load next plan from file or use default ----
  let nextPlan = [
    "Fix dev boot (Vite + Tauri alignment)",
    "Ensure bundle writes on startup",
    "Ensure pnpm run qa writes bundle + returns 0/1",
    "Add size gates (≤250 lines)",
    "Add consult pack generator",
  ];

  if (fileExists(planPath)) {
    try {
      const content = safeReadText(planPath) ?? "";
      const items = content.match(/^- (.+?)$/gm);
      if (items) nextPlan = items.map((line) => line.replace(/^- /, ""));
    } catch {
      // ignore; keep defaults
    }
  }

  // ---- 5) Build state object ----
  const state = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    foldersFound: {
      taskFlowExists,
      wrongTaskflowExists,
      subfolders,
      requiredSubfolders: REQUIRED_TASKFLOW_SUBFOLDERS,
      missingRequiredSubfolders,
    },
    keyFilesFound: {
      bundlePath: { exists: fileExists(bundlePath), path: bundlePath },
      qaPath: { exists: Boolean(qaPathFound), path: qaPathFound },
      packPath: { exists: Boolean(packPathFound), path: packPathFound },
      bootFlowPath: { exists: fileExists(bootFlowPath), path: bootFlowPath },
      tauriBackend: { exists: Boolean(tauriPathFound), path: tauriPathFound },
    },
    lastFailingContractId,
    nextPlan,
  };

  // ---- 6) Generate markdown ----
  const md = [
    "# State Report",
    `Generated: ${state.generatedAt}\n`,
    "## Repo Structure",
    `- Root: \`${state.repoRoot}\``,
    `- qaTaskFlow exists: ${state.foldersFound.taskFlowExists}`,
    `- forbidden src/taskflow exists: ${state.foldersFound.wrongTaskflowExists}`,
    `- subfolders: ${state.foldersFound.subfolders.join(", ") || "(none)"}`,
    `- missing required: ${
      state.foldersFound.missingRequiredSubfolders.length
        ? state.foldersFound.missingRequiredSubfolders.join(", ")
        : "(none)"
    }\n`,
    "## Key Files",
    ...Object.entries(state.keyFilesFound).map(
      ([key, val]) => `- ${key}: ${val.exists ? "✓" : "✗"}`
    ),
    "",
    "## Status",
    `- Last failing contract: ${state.lastFailingContractId ?? "none"}\n`,
    "## Next Plan",
    ...state.nextPlan.map((item) => `- ${item}`),
    "",
  ].join("\n");

  return { json: state, md };
}

/**
 * Write state files to disk.
 * Why: QA + agents depend on stable artifact paths:
 *   .ai/state.json
 *   .ai/state.md
 *
 * @param {Object} opts
 * @param {string} [opts.repoRoot] - Repository root path (defaults to cwd)
 * @param {Object} opts.json - State JSON object to write (required)
 * @param {string} opts.md - State Markdown string to write (required)
 */
export function writeStateFiles(opts) {
  if (!opts || !opts.json || !opts.md) {
    throw new Error("opts.json and opts.md are required");
  }

  const repoRoot = opts.repoRoot ?? process.cwd();
  const outDir = path.join(repoRoot, ".ai");
  ensureDir(outDir);

  fs.writeFileSync(path.join(outDir, "state.json"), JSON.stringify(opts.json, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "state.md"), opts.md, "utf8");

  // eslint-disable-next-line no-console
  console.log("✓ State files written (.ai/state.json, .ai/state.md)");
}

// Main: execute when run directly (not imported)
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const { json, md } = generateState();
  writeStateFiles({ json, md });
}
