//scripts/state.mjs
import fs from "node:fs";
import path from "node:path";

/**
 * Generate state JSON and Markdown from the current repo.
 * Examines folder structure, key files, and bundle for contract IDs.
 * @param {Object} opts - Options
 * @param {string} [opts.repoRoot] - Repository root path (defaults to cwd)
 * @param {string} [opts.planPath] - Path to next_plan.md
 * @returns {{json: Object, md: string}} State object with json and md properties
 */
export function generateState(opts = {}) {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const planPath = opts.planPath ?? path.join(repoRoot, "docs", "next_plan.md");

  // 1. Check folders
  const taskFlowPath = path.join(repoRoot, "src", "qaTaskFlow");
  const taskFlowExists = fs.existsSync(taskFlowPath);
  const subfolders = [];
  if (taskFlowExists) {
    const items = fs.readdirSync(taskFlowPath, { withFileTypes: true });
    for (const item of items) {
      if (
        item.isDirectory() &&
        ["flows", "tasks", "contracts", "core"].includes(item.name)
      ) {
        subfolders.push(item.name);
      }
    }
  }

  // 2. Check key files
  const bundlePath = path.join(repoRoot, ".ai", "bundles", "latest.bundle.md");
  const qaPath = path.join(repoRoot, "scripts", "qa.mjs");
  const packPath = path.join(repoRoot, "scripts", "pack.mjs");
  const bootFlowPath = path.join(repoRoot, "src", "qaTaskFlow", "flows", "bootFlow.ts");
  const libPath = path.join(repoRoot, "src-tauri", "src", "lib.rs");
  const mainPath = path.join(repoRoot, "src-tauri", "src", "main.rs");

  // 3. Extract lastFailingContractId from bundle
  let lastFailingContractId = null;
  if (fs.existsSync(bundlePath)) {
    const bundleContent = fs.readFileSync(bundlePath, "utf8");
    const contractMatch = bundleContent.match(/^### (.+?)$/m);
    if (contractMatch) {
      lastFailingContractId = contractMatch[1];
    }
  }

  // 4. Load nextPlan from file or use default
  let nextPlan = [
    "Fix dev boot (Vite + Tauri alignment)",
    "Ensure bundle writes on startup",
    "Ensure pnpm run qa writes bundle + returns 0/1",
    "Add size gates (≤250 lines)",
    "Add consult pack generator"
  ];
  if (fs.existsSync(planPath)) {
    try {
      const content = fs.readFileSync(planPath, "utf8");
      const items = content.match(/^- (.+?)$/gm);
      if (items) {
        nextPlan = items.map((line) => line.replace(/^- /, ""));
      }
    } catch {
      // Use default on error
    }
  }

  // 5. Build state object
  const state = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    foldersFound: {
      taskFlowExists,
      subfolders
    },
    keyFilesFound: {
      bundlePath: {
        exists: fs.existsSync(bundlePath),
        path: bundlePath
      },
      qaPath: {
        exists: fs.existsSync(qaPath),
        path: qaPath
      },
      packPath: {
        exists: fs.existsSync(packPath),
        path: packPath
      },
      bootFlowPath: {
        exists: fs.existsSync(bootFlowPath),
        path: bootFlowPath
      },
      tauriBackend: {
        exists: fs.existsSync(libPath) || fs.existsSync(mainPath),
        path: fs.existsSync(libPath) ? libPath : mainPath
      }
    },
    lastFailingContractId,
    nextPlan
  };

  // 6. Generate markdown
  const md = [
    "# State Report",
    `Generated: ${state.generatedAt}\n`,
    "## Repo Structure",
    `- Root: \`${state.repoRoot}\``,
    `- qaTaskFlow exists: ${state.foldersFound.taskFlowExists}`,
    `- subfolders: ${state.foldersFound.subfolders.join(", ") || "(none)"}\n`,
    "## Key Files",
    ...Object.entries(state.keyFilesFound).map(
      ([key, val]) => `- ${key}: ${val.exists ? "✓" : "✗"}`
    ),
    "",
    "## Status",
    `- Last failing contract: ${state.lastFailingContractId ?? "none"}\n`,
    "## Next Plan",
    ...state.nextPlan.map((item) => `- ${item}`)
  ].join("\n");

  return { json: state, md };
}

/**
 * Write state files to disk.
 * @param {Object} opts - Options (required: json, md)
 * @param {string} [opts.repoRoot] - Repository root path (defaults to cwd)
 * @param {Object} opts.json - State JSON object to write (required)
 * @param {string} opts.md - State Markdown string to write (required)
 */
export function writeStateFiles(opts) {
  if (!opts || !opts.json || !opts.md) {
    throw new Error("opts.json and opts.md are required");
  }
  const repoRoot = opts.repoRoot ?? process.cwd();
  const json = opts.json;
  const md = opts.md;

  const outDir = path.join(repoRoot, ".ai");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outDir, "state.json"),
    JSON.stringify(json, null, 2),
    "utf8"
  );
  fs.writeFileSync(path.join(outDir, "state.md"), md, "utf8");

  console.log("✓ State files written (.ai/state.json, .ai/state.md)");
}

// Execute when run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const result = generateState();
  writeStateFiles({ json: result.json, md: result.md });
}
