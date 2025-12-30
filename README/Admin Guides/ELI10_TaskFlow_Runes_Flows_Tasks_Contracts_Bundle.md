# ELI10: Runes, Flows, Tasks, Contracts, and the Debug Bundle (FilesUP TaskFlow)

**Goal:** You run the app, click something (Open folder, Sort, Paste), it breaks → the **issue appears automatically** in  
`.ai/bundles/latest.bundle.md` so an AI agent can fix it without you copy‑pasting logs.

---

## 1) What is what (ELI10)

### Runes (Svelte 5)
Runes are **how the UI updates** (reactivity).  
Runes are **not** “what the app does”. They do not describe actions like “sort folder”.

### Flow
A **Flow** is a **user action**: “Open folder”, “Sort”, “Paste”, “Delete”.
A Flow:
- logs **events** (checkpoints)
- adds **contracts** (quality checks)
- returns output
- writes/updates the **debug bundle**

### Task
A **Task** is a **small reusable step** used by flows:
- build a sort comparator
- normalize names
- calculate folder size
- read directory listing

### Contract
A **Contract** is a “did we get the right result?” check:
`{ input, expected, got, ok }`

If `ok === false` → flow must FAIL → bundle shows FAIL.

### Debug Bundle
The **single report** you always read:
`.ai/bundles/latest.bundle.md`

It contains:
- TRACE_SUMMARY (what action ran)
- EVENTS timeline
- CONTRACTS (expected vs got)
- LOG TAIL (optional)

---

## 2) Why NOT “one runesFlow.ts”
You asked: “Can we have one flow for all runes (runesFlow.ts)?”

**No.** Because:
- a flow must represent **one action** so failures are obvious
- one mega-flow becomes a huge file (same old problem)
- contracts and events become unreadable (“where did it fail?”)

✅ **Runes** stay in UI.  
✅ **Flows** are one per action (but parameterized).  
✅ You may centralize ONE dispatcher.

---

## 3) The correct pipeline (ELI10)

**UI (Runes) → Dispatcher → Flow → Tasks → Contract → Bundle**

1) User clicks “Sort by Name”
2) UI calls `dispatch(Cmd.Sort({ key:'name', dir:'asc' }))`
3) Dispatcher calls `runSortFlow(...)`
4) Flow runs tasks, adds events, checks contract
5) Flow ends → runtime writes bundle

If sorting fails, bundle includes:
- `SORT_START`, `SORT_APPLY`, `SORT_FAIL`
- Contract shows expected “sorted=true”, got “sorted=false”

---

## 4) Minimal Flow requirements (copy-paste rule)

Every new flow MUST:
- use `runFlowWithContracts("flowName", async (ctx)=>{...})`
- call `ctx.addEvent(key, message, data)` for major steps
- add ≥1 contract using `ctx.addContract(checkXyzContract(...))`
- return output from the callback

Example:
```ts
const output = await runFlowWithContracts("sortFlow", async (ctx) => {
  ctx.addEvent("SORT_START", "Sorting...", { key, dir });

  const result = await sortTask(input);

  const contract = checkSortContract(input, result);
  ctx.addContract(contract);

  ctx.addEvent(
    contract.ok ? "SORT_OK" : "K=10 FAIL sort-contract",
    contract.ok ? "Sorted OK" : "Sorted FAILED",
    { key, dir }
  );

  return result;
});
```

---

## 5) How “sorting doesn’t work” goes into the bundle

### Before (bad)
Sorting runs inside UI only → no events/contracts → bundle stays “boot ok”.

### After (good)
Sorting is a flow:
- Flow adds `SORT_START`
- Flow computes result
- Flow checks `sort-contract`
- If `ok=false` → bundle shows FAIL

So the agent sees the bug immediately in `.ai/bundles/latest.bundle.md`.

---

## 6) How many flows does a file explorer need?

You do NOT need hundreds.

### MVP (about 12–20 flows)
- bootFlow
- openFolderFlow
- refreshFolderFlow
- sortFlow (parameterized: name/date/size + asc/desc)
- groupFlow
- changeViewModeFlow
- selectFlow
- copyFlow / cutFlow / pasteFlow
- deleteFlow
- renameFlow
- createFolderFlow

A mature app may grow to ~30–60 flows, but each remains small.

---

## 7) One good thing to centralize: Dispatcher
Instead of one runesFlow, make ONE dispatcher file:

- `dispatch(cmd)` routes commands to flows
- UI uses runes, but calls only `dispatch(...)`

This keeps UI tiny and flows debuggable.

---

## 8) Super short checklist (for every new feature)
- [ ] Is there a Flow for this user action?
- [ ] Does it log 2–6 key events?
- [ ] Does it add at least one contract?
- [ ] Does runtime write bundle after the flow?
- [ ] Can I diagnose the bug by reading the bundle only?

---

**Source of truth:** If it can break and you care, it should appear in the bundle via a flow.
