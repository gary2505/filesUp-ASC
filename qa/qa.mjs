// qa/qa.mjs
import fs from "node:fs";
import path from "node:path";

/**
 * ============================================================================
 * FilesUP-Taskflow (filesup-asc) — QA Runtime (stub v0)
 * ============================================================================
 * This is: qa/qa.mjs
 *
 * Used by:
 * - package.json -> scripts.qa -> `pnpm run qa`
 * - (not used elsewhere)
 *
 * Purpose:
 * - Minimal QA entrypoint that ALWAYS writes canonical evidence to:
 *     .ai/bundles/latest.bundle.md
 * - Today it is a "green by default" stub.
 * - Later it becomes a real QA gate (contracts, size gates, tests) that exits
 *   non-zero on FAIL.
 *
 * Trigger:
 * - User/CI runs: `pnpm run qa`
 *
 * Event Flow (current stub):
 * - pnpm run qa
 *   -> node qa/qa.mjs
 *     -> buildStubBundleMarkdown()
 *     -> writeBundle()
 *     -> process.exit(0)
 *
 * List of functions:
 * - ensureDir(p): ensures directory exists (why: bundle output must not fail)
 * - writeBundle(md): writes canonical bundle markdown to .ai/bundles/latest.bundle.md
 * - isoNow(): returns ISO timestamp string (why: consistent bundle timestamps)
 * - buildStubBundleMarkdown(nowIso): creates the stub bundle content
 *
 */

/**
 * Ensure a directory exists (creates it if missing).
 * Why: QA must ALWAYS be able to write canonical evidence to disk.
 *
 * @param {string} p - Directory path to create (recursively)
 */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Write the canonical debug bundle to `.ai/bundles/latest.bundle.md`.
 * Why: bundle-first workflow requires a single, predictable evidence file.
 *
 * @param {string} md - Markdown content to write as the bundle
 */
function writeBundle(md) {
  const outDir = path.join(process.cwd(), ".ai", "bundles");
  ensureDir(outDir);

  const outFile = path.join(outDir, "latest.bundle.md");
  fs.writeFileSync(outFile, md, "utf8");
}

/**
 * Get the current time in ISO string form.
 * Why: bundles should be timestamped consistently (machine + human readable).
 *
 * @returns {string} ISO timestamp
 */
function isoNow() {
  return new Date().toISOString();
}

/**
 * Build a stub bundle markdown payload.
 * Why: even when QA is a stub, we still produce canonical evidence that a run happened.
 *
 * @param {string} now - ISO timestamp to embed in the bundle
 * @returns {string} Bundle markdown
 */
function buildStubBundleMarkdown(now) {
  return [
    "# DEBUG BUNDLE (latest)",
    "",
    "## TRACE_SUMMARY",
    "QA stub executed",
    "",
    "## EVENTS",
    `- ${now} [QA_START] pnpm run qa started`,
    `- ${now} [QA_OK] Stub QA passed`,
    "",
    "## CONTRACTS",
    "_(none in stub)_",
    "",
    "## LOG TAIL",
    "_(none)_",
    "",
  ].join("\n");
}

/**
 * MAIN
 * What: builds the stub bundle and writes it to disk.
 * Why: establishes the canonical evidence pipeline before adding real QA gates.
 */
const now = isoNow();
const bundleMd = buildStubBundleMarkdown(now);

writeBundle(bundleMd);
process.exit(0);
