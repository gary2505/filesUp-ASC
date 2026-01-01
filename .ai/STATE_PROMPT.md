# STATE PROMPT

You are the Implementer agent for FilesUP-Taskflow (Tauri 2 + Svelte 5 runes + Tailwind + DaisyUI, pnpm).
Goal: Add automatic generation of `.ai/state.json` and `.ai/state.md` during `pnpm run qa` (and optionally during `pnpm run pack`).
Rules: patch-only diffs, no full file dumps unless asked, keep new files small (<250 lines), minimal dependencies.

CONTEXT / CURRENT STRUCTURE

- Canonical source folder is `src/qaTaskFlow/` (DO NOT create `src/taskflow/`).
- Debug bundle path: `.ai/bundles/latest.bundle.md` (already written by QA or app).
- Scripts live in `/scripts/` and are run via pnpm.
- We want state artifacts in `.ai/`:
  - `.ai/state.json`
  - `.ai/state.md`

REQUIREMENTS (what to implement)

1) Create a Node script module: `scripts/state.mjs` (or `scripts/state.js`) that exports:
   - `generateState({ repoRoot, planPath? }) -> { json, md }`
   - `writeStateFiles({ repoRoot, json, md })`
2) Update `scripts/qa.mjs` to call `generateState()` after bundle generation and write:
   - `.ai/state.json`
   - `.ai/state.md`
   QA must still exit 0/1 as before.
3) `state.json` must include:
   - `generatedAt` ISO timestamp
   - `repoRoot` (absolute path or ".")
   - `foldersFound`:
       - whether `src/qaTaskFlow` exists
       - list of subfolders under `src/qaTaskFlow` limited to: `flows`, `tasks`, `contracts`, `core`
   - `keyFilesFound` (booleans + paths if present):
       - `.ai/bundles/latest.bundle.md`
       - `scripts/qa.mjs`
       - `scripts/pack.mjs` (optional)
       - `src/qaTaskFlow/flows/bootFlow.ts` (if exists)
       - `src-tauri/src/main.rs` or `src-tauri/src/lib.rs` (whichever exists)
   - `lastFailingContractId`:
       - parse `.ai/bundles/latest.bundle.md` and extract the first contract heading after "## CONTRACTS"
         Example: "### boot-contract" -> "boot-contract"
       - if no contracts or missing bundle -> null
   - `nextPlan`:
       - load from a stored checklist file if present: `docs/next_plan.md` (preferred) or `.ai/next_plan.md`
       - if missing, set a default 5-step plan array (strings):
         1) fix dev boot
         2) ensure bundle writes on startup
         3) ensure pnpm run qa writes bundle + returns 0/1
         4) add size gates
         5) add consult pack
4) `state.md` must be a short human-readable mirror of json:
   - Title + generated time
   - Canonical paths (src/qaTaskFlow)
   - Folders found
   - Key files found
   - Last failing contract id
   - Next plan list
   Keep it under ~150 lines.
5) Do NOT add new dependencies. Use only Node built-ins (`fs`, `path`).
6) Must be cross-platform (Windows/macOS/Linux path safe).

ACCEPTANCE TESTS

- Run: `pnpm run qa`
  - `.ai/state.json` is created and valid JSON
  - `.ai/state.md` is created
  - `.ai/bundles/latest.bundle.md` still created (existing behavior)
  - QA exit code unchanged
- If bundle has contracts, `lastFailingContractId` matches the first "### <id>" in bundle.
- If bundle missing, state still generates with null contract id and file booleans.

OUTPUT

- Return a minimal unified diff patch for:
  - `scripts/state.mjs` (new)
  - `scripts/qa.mjs` (modified)
  - optionally `docs/next_plan.md` (new, tiny default plan) if you choose to add it
- Keep changes minimal and consistent with existing code style.
