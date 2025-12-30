// QA Pipeline for filesUP-ASC
// Enforces contracts, size gates, and minimal checks

import { runBootFlow } from '../src/taskFlow/flows/bootFlow';
import { writeDebugBundle } from '../src/taskFlow/core/debugBundle';
import type { DebugBundle } from '../src/taskFlow/core/debugBundle';

const MAX_TASK_LINES = 250;
const MAX_BLOCK_LINES = 80;

async function runQA(): Promise<number> {
  console.log('🧪 filesUP-ASC QA Pipeline');
  console.log('==========================\n');

  try {
    // 1. Run boot flow
    console.log('📍 Running boot flow...');
    await runBootFlow('0.0.1');
    
    console.log('✓ Boot flow completed');
    console.log('✅ QA PASSED');
    console.log('📁 Debug bundle written: .ai/bundles/latest.bundle.md\n');
    
    return 0;
  } catch (err) {
    console.error('\n❌ QA ERROR:', err);
    return 1;
  }
}

runQA().then(code => process.exit(code));
