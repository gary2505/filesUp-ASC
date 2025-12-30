# DEBUG BUNDLE (latest)

## TRACE_SUMMARY
QA executed

## EVENTS
- 2025-12-30T21:21:10.505Z [QA_START] pnpm run qa started
- 2025-12-30T21:21:10.516Z [QA_OK] QA passed

## CONTRACTS
- ✅ layoutGate/noLowercaseTaskflow
  - input: {"forbidden":"src/taskflow"}
  - expected: {"exists":false}
  - got: {"exists":false}
- ✅ layoutGate/requiredDirs
  - input: {"required":["src/taskFlow/contracts","src/taskFlow/core","src/taskFlow/flows","src/taskFlow/tasks","src/taskFlow/runtime","src/taskFlow/trace"]}
  - expected: {"missing":[]}
  - got: {"missing":[]}
- ✅ sizeGate/summary
  - input: {"scope":"src/taskFlow"}
  - expected: {"maxLines":250,"violations":0}
  - got: {"maxLines":250,"violations":0}
- ✅ toolsGate/packExists
  - input: {"candidates":["V:/filesUp-ASC/scripts/pack.mjs","V:/filesUp-ASC/filesUp-ASC/scripts/pack.mjs","V:/filesUp-ASC/.ai/scripts/pack.mjs"]}
  - expected: {"found":true}
  - got: {"found":true,"path":"V:/filesUp-ASC/scripts/pack.mjs"}

## LOG TAIL
_(none)_
