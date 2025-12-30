// src/taskFlow/runtime/formatBundle.ts
// Used by: src/taskFlow/runtime/runFlowWithContracts.ts
// Purpose: Format trace events and contracts into the canonical bundle markdown format.
// Trigger: Called after flow execution to generate bundle content.
// Event Flow: getTraceEvents() + getContracts() -> formatBundleMarkdown() -> markdown string
// Functions:
//   - formatBundleMarkdown({summary, events, contracts, logTail}): Generate bundle markdown

import type { TraceEvent, TaskFlowContract } from '../trace/index';

export interface BundleData {
  summary: string;
  events: TraceEvent[];
  contracts: TaskFlowContract[];
  logTail?: string;
}

/// Format bundle markdown in the canonical style.
/// Why: The .ai/bundles/latest.bundle.md format must match QA bundle style for consistency.
/// Format: TRACE_SUMMARY, EVENTS, CONTRACTS, LOG TAIL sections.
/// Example: formatBundleMarkdown({summary: 'Boot flow executed', events: [...], contracts: [...]})
export function formatBundleMarkdown(data: BundleData): string {
  const lines: string[] = [];
  
  lines.push('# DEBUG BUNDLE (latest)');
  lines.push('');
  
  // TRACE_SUMMARY section
  lines.push('## TRACE_SUMMARY');
  lines.push(data.summary || '(none)');
  lines.push('');
  
  // EVENTS section
  lines.push('## EVENTS');
  if (!data.events.length) {
    lines.push('- (none)');
  } else {
    for (const e of data.events) {
      const dataStr = e.data ? ` ${JSON.stringify(e.data)}` : '';
      lines.push(`- ${e.t} [${e.k}] ${e.msg}${dataStr}`);
    }
  }
  lines.push('');
  
  // CONTRACTS section
  lines.push('## CONTRACTS');
  if (!data.contracts.length) {
    lines.push('_(none)_');
  } else {
    for (const c of data.contracts) {
      const icon = c.ok ? '✅' : '❌';
      lines.push(`- ${icon} ${c.name}`);
      lines.push(`  - input: ${JSON.stringify(c.input)}`);
      lines.push(`  - expected: ${JSON.stringify(c.expected)}`);
      lines.push(`  - got: ${JSON.stringify(c.got)}`);
    }
  }
  lines.push('');
  
  // LOG TAIL section
  lines.push('## LOG TAIL');
  if (!data.logTail) {
    lines.push('_(none)_');
  } else {
    lines.push('```');
    lines.push(data.logTail);
    lines.push('```');
  }
  lines.push('');
  
  return lines.join('\n');
}
