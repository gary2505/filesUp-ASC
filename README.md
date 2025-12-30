# filesUP-ASC

github.com/gary2505/filesUp-ASC

**Solo AI Coding Agent** desktop app using **Tauri 2 + Svelte 5 (runes) + TailwindCSS + DaisyUI + pnpm**.

## Architecture: ASC (Agent System Coding)

- **Tasks** (`src/taskFlow/tasks/`) — focused units of logic (~250 lines max)
- **Flows** (`src/taskFlow/flows/`) — composition of tasks into user-level actions
- **Contracts** (`src/taskFlow/contracts/`) — input/output validation
- **Debug Bundles** (`.ai/bundles/latest.bundle.md`) — single source of truth for debugging

## Setup

### 1. Install dependencies

```bash
cd filesUp-ASC
pnpm install
```

### 2. Install Tauri CLI

```bash
pnpm add -D @tauri-apps/cli@latest
```

### 3. Run dev

```bash
pnpm dev
```

### 4. Run QA

```bash
pnpm qa
```

## File Structure

```text
src/
  ├── taskFlow/
  │   ├── tasks/        → bootTask.ts (example task)
  │   ├── flows/        → bootFlow.ts (example flow)
  │   ├── contracts/    → bootContract.ts (contract definitions)
  │   ├── core/         → debugBundle.ts (debug bundle writer)
  │   └── debug/        → (legacy, can be removed)
  ├── App.svelte        → root component
  └── main.ts           → entry point

src-tauri/
  ├── src/
  │   ├── main.rs       → Tauri entry
  │   └── lib.rs        → Tauri commands
  └── tauri.conf.json   → Tauri config

qa/
  └── index.ts          → QA pipeline
  
scripts/
  └── run-contracts.mjs → Contract runner
  
.ai/
  ├── AGENT_PROMPT.md   → VS Code agent prompt
  └── bundles/
      └── latest.bundle.md → debug bundle (auto-generated)
```

## QA Pipeline

- Runs boot flow (tasks/flows/contracts)
- Validates all contracts
- Writes debug bundle on success/failure

## Next Steps

- Port FilesUP core modules (GPS, Smart Errors, Click & Key Control)
- Expand tasks/flows for actual file scanning logic
- Add real size gate enforcement in QA
