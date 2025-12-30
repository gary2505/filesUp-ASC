// filesUp-ASC/scripts/pack.mjs
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * ============================================================================
 * FilesUP-Taskflow (filesup-asc) — Pack Generator
 * ============================================================================
 * This is: filesUp-ASC/scripts/pack.mjs
 *
 * Used by:
 * - package.json -> scripts.pack -> `pnpm run pack` (recommended)
 * - (not used elsewhere)
 *
 * Purpose:
 * - Generate a compact “one-thread memory” artifact so you (and any AI agent)
 *   can continue work without re-pasting huge logs.
 * - Reads canonical evidence:
 *     .ai/bundles/latest.bundle.md
 *   Optionally reads:
 *     .ai/state.json
 *     .ai/state.md
 * - Writes:
 *     .ai/pack/latest.pack.md
 *   (and optionally a timestamped pack copy in the same folder)
 *
 * Trigger:
 * - User/CI runs: `pnpm run pack`
 *
 * Event Flow:
 * - pnpm run pack
 *   -> node filesUp-ASC/scripts/pack.mjs
 *     -> read latest bundle + state
 *     -> build a small pack (tail-only)
 *     -> write .ai/pack/latest.pack.md
 *
 * List of functions:
 * - ensureDir(p): create directory (why: pack must always be written)
 * - safeReadText(p): read file or null (why: missing files should not crash pack)
 * - safeReadJson(p): read JSON or null (why: state.json may not exist yet)
 * - nowIso(): timestamp (why: stable provenance)
 * - tailLines(text, n): last N lines (why: token-friendly)
 * - renderPackMd(opts): create pack markdown
 */

/**
 * Ensure a directory exists.
 * Why: pack writing must not fail just because folders are missing.
 *
 * @param {string} p - Directory path
 */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Safely read a UTF-8 text file.
 * Why: pack generation should not crash if optional files are missing.
 *
 * @param {string} p - Absolute path to file
 * @returns {string|null} File text or null if missing/unreadable
 */
function safeReadText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/**
 * Safely read a JSON file.
 * Why: state.json may not exist in early stages; pack should still generate.
 *
 * @param {string} p - Absolute path to JSON file
 * @returns {any|null} Parsed JSON or null if missing/invalid
 */
function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Return current time in ISO format.
 * Why: makes pack traceable and sortable.
 *
 * @returns {string} ISO timestamp
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Return the last N lines of a string.
 * Why: keep pack small and token-friendly while preserving recent evidence.
 *
 * @param {string} text - Full text
 * @param {number} n - Number of lines to keep
 * @returns {string} Tail text (<= n lines)
 */
function tailLines(text, n) {
  const lines = (text || "").split(/\r\n|\r|\n/);
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

/**
 * Render the pack markdown.
 * Why: produce a stable “single-thread memory” file the agent can use.
 *
 * @param {object} opts
 * @param {string} opts.generated - ISO timestamp
 * @param {string} opts.bundleTail - Tail of latest.bundle.md
 * @param {{lastFailingContract?: string, root?: string, missingRequiredDirs?: string[], nextPlan?: string[]}|null} opts.stateJson - Parsed state.json (optional)
 * @param {string|null} opts.stateMd - Raw state.md (optional)
 * @returns {string} Pack markdown content
 */
function renderPackMd({ generated, bundleTail, stateJson, stateMd }) {
  const lastFail = stateJson?.lastFailingContract ?? "none";
  const root = stateJson?.root ?? "(unknown)";
  const missingDirs = Array.isArray(stateJson?.missingRequiredDirs)
    ? stateJson.missingRequiredDirs
    : [];

  const nextPlan = Array.isArray(stateJson?.nextPlan) ? stateJson.nextPlan : [];

  const lines = [];
  lines.push("# FilesUP-Taskflow Pack (latest)");
  lines.push(`Generated: ${generated}`);
  lines.push("");

  lines.push("## Identity");
  lines.push(`- Project: FilesUP-Taskflow (filesup-asc)`);
  lines.push(`- Repo root (from state.json): \`${root}\``);
  lines.push("");

  lines.push("## Non-negotiables (recap)");
  lines.push("- Bundle-first: `.ai/bundles/latest.bundle.md` is canonical evidence");
  lines.push("- Patch-only by default");
  lines.push("- Layout: `src/taskFlow/{core,runtime,trace,contracts,tasks,flows}`");
  lines.push("- Contracts: `{ name, input, expected, got, ok }` and `ok=false` fails QA");
  lines.push("- Tracing: flows emit readable events via `ctx.addEvent(key,msg,data)`");
  lines.push("");

  lines.push("## Current QA status");
  lines.push(`- Last failing contract: **${lastFail}**`);
  if (missingDirs.length) {
    lines.push(`- Missing required dirs: ${missingDirs.join(", ")}`);
  } else {
    lines.push("- Missing required dirs: (none)");
  }
  lines.push("");

  if (nextPlan.length) {
    lines.push("## Next plan (from state.json)");
    for (const p of nextPlan) lines.push(`- ${p}`);
    lines.push("");
  }

  if (stateMd) {
    lines.push("## State report (tail)");
    lines.push("```md");
    lines.push(tailLines(stateMd, 120));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Latest bundle (tail)");
  lines.push("```md");
  lines.push(bundleTail || "# DEBUG BUNDLE (latest)\n\n_(missing)_\n");
  lines.push("```");
  lines.push("");

  lines.push("## What to paste into the next chat");
  lines.push("- `.ai/bundles/latest.bundle.md` (required)");
  lines.push("- `.ai/state.md` (optional)");
  lines.push("- ONE code anchor excerpt (±80 lines) around the failing area (if QA FAIL)");
  lines.push("");

  return lines.join("\n");
}

/**
 * MAIN
 * What: reads bundle/state and writes a compact pack markdown.
 * Why: creates a “single thread” memory artifact so debugging continues fast.
 */
const ROOT = process.cwd();
const AI_DIR = path.join(ROOT, ".ai");

const bundlePath = path.join(AI_DIR, "bundles", "latest.bundle.md");
const stateJsonPath = path.join(AI_DIR, "state.json");
const stateMdPath = path.join(AI_DIR, "state.md");

const packDir = path.join(AI_DIR, "pack");
const packLatestPath = path.join(packDir, "latest.pack.md");
const packStampedPath = path.join(packDir, `pack.${nowIso().replace(/[:.]/g, "-")}.md`);

const bundleText = safeReadText(bundlePath) ?? "";
const stateJson = safeReadJson(stateJsonPath);
const stateMd = safeReadText(stateMdPath);

const bundleTail = tailLines(bundleText, 220);

const packMd = renderPackMd({
  generated: nowIso(),
  bundleTail,
  stateJson,
  stateMd,
});

ensureDir(packDir);
fs.writeFileSync(packLatestPath, packMd, "utf8");

// Optional: keep a timestamped copy (handy when “latest” gets overwritten).
fs.writeFileSync(packStampedPath, packMd, "utf8");

console.log(`Wrote ${path.relative(ROOT, packLatestPath)}`);
console.log(`Wrote ${path.relative(ROOT, packStampedPath)}`);
