# Prompt 1

You are the Implementer agent for FilesUP-Taskflow.
Follow AGENTS rules: patch-only, bundle-first, QA loop until green.
I will paste: latest.bundle.md + the referenced task/flow anchor excerpts.
Your job: output a minimal unified diff and keep iterating until the bundle shows no failures.
If you need more context, request only the next anchor excerpt, not whole files.

TARGET STACK

- Desktop app using Tauri 2 (Rust backend, WebView UI, no plugins)
- Frontend: Svelte 5 with Runes enabled
- UI: TailwindCSS + DaisyUI
- Tooling/runtime: pnpm
- OS target: desktop only (no SSR, no PWA)

ARCHITECTURE: ASC (Agent System Coding) — key rules

1) Patch-only development

   - You must return changes as patch/unified diff or clearly scoped edits.
   - Never dump full files unless I explicitly ask for full file content.
   - Aim to keep each file under 250 lines. Prefer to split instead of growing a giant file.

2) Debug Bundle = single source of truth for you
   - App must always write a debug bundle after each run / failure:
     `.ai/bundles/latest.bundle.md`
   - This file will contain:
     - TRACE_SUMMARY: compact map of the last run (key checkpoints)
     - Last N trace events (timeline)
     - Failing contracts: {input, expected, got}
     - Log tail (frontend + backend)
     - Minimal code anchors (file + line ranges, not the full file)
   - In future sessions you MUST assume you FIRST read this file before changing code.

3) Contracts = QA
   - Important units of logic must have contracts:
     `{input, expected, got}`
   - On mismatch: log trace event like `K=10 FAIL <contract_name>` and return non-zero exit.
   - `pnpm run qa` === “green / fixed”. If QA fails, you keep iterating with minimal changes.

4) Agent-first modularity: Tasks & Flows
   - Do NOT build a classic `stores/services/utils`-jungle.
   - Primary structure:
     - `src/asc/tasks/`    → small, focused units (max ~250 lines per file)
     - `src/asc/flows/`    → composition of tasks into flows (user-level actions)
     - `src/asc/contracts/`→ contract definitions + helpers
   - Existing “platform” modules from old FilesUP architecture must be respected and ported later:
     - Core/GPS (orchestration)
     - Smart Errors
     - Click & Key Control
   - For now, just create clean stubs for these.

5) Size gates (enforced by QA later)
   - Target: `MAX_TASK_LINES = 250`, `MAX_BLOCK_LINES ≈ 80`.
   - You must set up a simple check in `pnpm run qa` that fails if any TS/Svelte/Rust file grows too big (stub logic is enough for now; real enforcement can be refined later).

SESSION GOAL (THIS REQUEST)
Bootstrap a fresh project `filesup-asc` with:

1. Working Tauri 2 + Svelte 5 (runes) + Tailwind + DaisyUI desktop app.
2. qaTaskFlow folder layout for Tasks/Flows/Contracts and debug bundles.
3. Basic QA pipeline wired to `pnpm run qa` (even if QA is mostly stubs now).
4. A minimal “Hello ASC” flow that uses:
   - one Task (in `src/qaTaskFlow/tasks/`)
   - one Flow (in `src/qaTaskFlow/flows/`)
   - one Contract (in `src/qaTaskFlow/contracts/`)
   - and writes `.ai/bundles/latest.bundle.md` on startup.

CONSTRAINTS & BEHAVIOR

- No human editing: assume only you will change code.
- Prefer smaller, composable files over “god files”.
- Always think about future debugging by agent:
  - logs must be structured and short,
  - trace points must be easy to scan in the bundle.
- Do not create unnecessary abstractions; keep it simple and explicit.
- Use clear, consistent naming so future agents can grep by name.
