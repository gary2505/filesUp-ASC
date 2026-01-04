/**
 * This is src/lib/utils/namePolicy.ts
 * Used by: src/lib/services/NewItemService.ts, src/lib/services/file-ops.service.ts, src/lib/P2/contextMenu/newFileDialog.svelte, src/lib/P2/folderTree/dialogs/RenameInput.svelte, src/lib/folderTree/dialogs/RenameInput.svelte
 * Purpose: Validates file/folder names according to platform rules
 * Trigger: Called when creating or renaming files/folders
 * Event Flow: Checks name against rules, returns validation result
 * List of functions: validateName, getNameIssues, normalizeName
 */

export type NameKind = 'file' | 'folder';

export type NameIssueCode =
  | 'empty'
  | 'dot_only'
  | 'invalid_chars'
  | 'trailing_space_dot'
  | 'reserved_device'
  | 'too_long_chars'
  | 'too_long_bytes'
  | 'hidden_warning';

export type NameIssueSeverity = 'error' | 'warning';

export interface NameIssue {
  code: NameIssueCode;
  severity: NameIssueSeverity;
  message: string;
}

export interface NameValidationResult {
  ok: boolean;
  issues: NameIssue[];
  normalized: string;
}

const RESERVED_DEVICE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
]);

const MAX_SEGMENT_CHARS = 255;
const MAX_SEGMENT_BYTES = 255;

const INVALID_CHARS_REGEX = /[<>:"/\\|?*\u0000-\u001F]/;

export function normalizeName(raw: string): string {
  return raw.trim();
}

export function validatePortableName(raw: string, kind: NameKind): NameValidationResult {
  const issues: NameIssue[] = [];
  const normalized = normalizeName(raw);

  if (!normalized) {
    issues.push({
      code: 'empty',
      severity: 'error',
      message: 'Name cannot be empty.'
    });
    return { ok: false, issues, normalized };
  }

  if (normalized === '.' || normalized === '..') {
    issues.push({
      code: 'dot_only',
      severity: 'error',
      message: 'This name is reserved by the file system.'
    });
    return { ok: false, issues, normalized };
  }

  if (INVALID_CHARS_REGEX.test(normalized)) {
    issues.push({
      code: 'invalid_chars',
      severity: 'error',
      message: 'Name contains characters that are not allowed on some systems.'
    });
  }

  if (normalized.endsWith(' ') || normalized.endsWith('.')) {
    issues.push({
      code: 'trailing_space_dot',
      severity: 'error',
      message: 'Name cannot end with a space or dot.'
    });
  }

  const base = normalized.split('.')[0].trim();
  const upper = base.toUpperCase();
  if (RESERVED_DEVICE_NAMES.has(upper)) {
    issues.push({
      code: 'reserved_device',
      severity: 'error',
      message: 'This name is reserved on Windows.'
    });
  }

  const charCount = [...normalized].length;
  if (charCount > MAX_SEGMENT_CHARS) {
    issues.push({
      code: 'too_long_chars',
      severity: 'error',
      message: `Name is too long (max ${MAX_SEGMENT_CHARS} characters).`
    });
  }

  const byteLength = new TextEncoder().encode(normalized).length;
  if (byteLength > MAX_SEGMENT_BYTES) {
    issues.push({
      code: 'too_long_bytes',
      severity: 'error',
      message: `Name is too long for some file systems (max ${MAX_SEGMENT_BYTES} bytes).`
    });
  }

  if (normalized.startsWith('.') && normalized !== '.' && normalized !== '..') {
    issues.push({
      code: 'hidden_warning',
      severity: 'warning',
      message: 'Names starting with a dot are hidden on some systems.'
    });
  }

  const hasError = issues.some((issue) => issue.severity === 'error');
  return { ok: !hasError, issues, normalized };
}
