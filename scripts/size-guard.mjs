#!/usr/bin/env node
// scripts/size-guard.mjs
// Size gate: prevent files from growing > 250 lines

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const MAX_LINES = 250;
const patterns = [
  'src/**/*.ts',
  'src/**/*.svelte'
];

function countLines(/** @type {string} */ filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (err) {
    return 0;
  }
}

function runSizeGuard() {
  console.log(`📏 Size Guard: checking files (MAX_LINES=${MAX_LINES})\n`);

  const violations = [];
  let totalFiles = 0;

  for (const pattern of patterns) {
    const files = globSync(pattern, { cwd: rootDir });
    
    for (const file of files) {
      totalFiles++;
      const fullPath = path.join(rootDir, file);
      const lines = countLines(fullPath);

      if (lines > MAX_LINES) {
        violations.push({
          file,
          lines,
          excess: lines - MAX_LINES
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`✅ All ${totalFiles} files are within size limits\n`);
    return 0;
  }

  console.error(`❌ SIZE GATE VIOLATIONS: ${violations.length} file(s) exceed ${MAX_LINES} lines\n`);
  
  for (const v of violations) {
    console.error(`  📄 ${v.file}`);
    console.error(`     Lines: ${v.lines} (+${v.excess} over limit)`);
  }
  
  console.error(`\n🔨 Action: split large files into smaller modules\n`);
  return 1;
}

process.exit(runSizeGuard());
