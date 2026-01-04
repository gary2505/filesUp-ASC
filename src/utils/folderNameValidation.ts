
/**
 * This is src/lib/utils/folderNameValidation.ts
 * Used by: src/lib/utils/uniqueNameGenerator.ts, src/lib/services/file-ops.service.ts
 * Purpose: Validates and sanitizes folder names according to platform rules
 * Trigger: Called when creating or renaming folders
 * Event Flow: Checks against platform-specific forbidden chars, sanitizes if needed
 * List of functions: validateFolderName, sanitizeFolderName, generateUniqueFolderName, detectRuntimeOS, isValidFolderName, getForbiddenChars, isCaseSensitive, getMaxLength
 */

/**
 * Cross-platform Folder Name Validation Utility
 * 
 * Platform-specific rules:
 * - Windows: forbids \ / : * ? " < > |, trims trailing spaces/dots, blocks reserved names
 * - macOS: forbids ":" (Finder), allows "/", keeps trailing spaces/dots
 * - Linux: forbids "/", keeps trailing spaces/dots
 * 
 * Common rules: disallow empty/whitespace-only, ".", "..", length > 255
 * 
 * Features:
 * - Uses centralized platform detection
 * - Validates folder names with detailed error messages
 * - Sanitizes invalid names to make them valid
 * - Generates unique names by appending numbers
 * - Handles case sensitivity per platform
 * - Provides utility functions for forbidden chars, case sensitivity checks
 * 
 * @example
 * ```typescript
 * import { validateFolderName, sanitizeFolderName } from './folderNameValidation';
 * 
 * const result = validateFolderName('my folder');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * 
 * const safe = sanitizeFolderName('invalid/name');
 * ```
 */

import { isTauriContext } from '$lib/utils/platform';

/** Supported operating system types */
export type OSKind = 'windows' | 'macos' | 'linux' | 'unknown';

/** Result of folder name validation */
export interface ValidationResult {
  /** Whether the folder name is valid */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Sanitized version of the name (only when valid is true) */
  sanitized?: string;
}

/** Internal rule set for each operating system */
interface RuleSet {
  /** Global regex for forbidden characters */
  forbiddenChars: RegExp;
  /** Whether to trim trailing spaces and dots (Windows only) */
  trimTrailingSpaceDot: boolean;
  /** Whether to check reserved device names (Windows only) */
  checkReservedNames: boolean;
  /** Whether filesystem is case-insensitive (Windows + most macOS volumes) */
  caseInsensitiveFs: boolean;
}

/** Windows reserved device names (case-insensitive) */
const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]) as ReadonlySet<string>;

// ---- OS Detection (using centralized platform detection) ----

/**
 * Get the current operating system using centralized platform detection.
 * This replaces the previous scattered detection logic.
 * 
 * @returns The detected operating system
 */
export function detectRuntimeOS(): OSKind {
  // Simple OS detection for folder validation
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
  }
  
  // Fallback to unknown
  return 'unknown';
}

/**
 * Reset OS detection cache.
 * This is now handled by the centralized platform system.
 */
export function resetOSDetection(): void {
  // Note: This now delegates to the centralized platform detection
  // Individual modules should not manage their own OS detection
  console.warn('[FolderValidation] resetOSDetection is deprecated. Use platform store reset instead.');
}

// ---- Rule Sets per OS ----

/**
 * Get validation rules for the specified operating system.
 * 
 * @param os - The operating system to get rules for
 * @returns Rule set for the OS
 */
function getRuleSet(os: OSKind): RuleSet {
  switch (os) {
    case 'windows':
      return {
        // Global flag to replace ALL forbidden chars in sanitize()
        forbiddenChars: /[\\/:*?"<>|]/g,
        trimTrailingSpaceDot: true,
        checkReservedNames: true,
        caseInsensitiveFs: true
      };
    case 'macos':
      return {
        // Finder forbids ":" - safer to be consistent across tools
        forbiddenChars: /[:]/g,
        trimTrailingSpaceDot: false,
        checkReservedNames: false,
        caseInsensitiveFs: true // Most macOS volumes are case-insensitive by default
      };
    case 'linux':
      return {
        // Only "/" is forbidden on Linux (NUL can't appear in JS strings)
        forbiddenChars: /[\/]/g,
        trimTrailingSpaceDot: false,
        checkReservedNames: false,
        caseInsensitiveFs: false
      };
    default:
      // Conservative fallback: use Linux-like rules
      return {
        forbiddenChars: /[\/]/g,
        trimTrailingSpaceDot: false,
        checkReservedNames: false,
        caseInsensitiveFs: false
      };
  }
}

/** Check if name is "." or ".." */
function isDotOrDotDot(name: string): boolean {
  return name === '.' || name === '..';
}

/** Extract base name (without extension) in uppercase */
function baseWithoutExtensionUpper(name: string): string {
  const up = name.toUpperCase();
  const dotIndex = up.indexOf('.');
  return dotIndex >= 0 ? up.slice(0, dotIndex) : up;
}

export class FolderNameValidator {
  // Optionally allow callers to force an OS (for testing), else auto-detect
  static validate(name: string, os: OSKind = detectRuntimeOS()): ValidationResult {
    const rules = getRuleSet(os);

    // 1) Empty / whitespace only
    if (!name || !name.trim()) {
      return { valid: false, error: 'Folder name cannot be empty' };
    }

    // NOTE: Windows allows leading spaces; we keep the original string for checks,
    // but we also keep a trimmed version for common length/emptiness guardrails.
    // For a friendlier UX across platforms, we normalize using simple trimStart here
    // only for checks that don’t need to enforce Windows leading-space allowance.
    const original = name;
    const trimmed = original.trim();

    // 2) Disallow "." and ".." (problematic in shells and APIs)
    if (isDotOrDotDot(original)) {
      return { valid: false, error: 'Folder name cannot be "." or ".."' };
    }

    // 3) Length (common 255-char limit for a single path component)
    if (trimmed.length === 0) {
      return { valid: false, error: 'Folder name cannot be empty' };
    }
    if (original.length > 255) {
      return { valid: false, error: 'Folder name cannot exceed 255 characters' };
    }

    // 4) Forbidden characters
    if (rules.forbiddenChars.test(original)) {
      // Collect unique offending characters for the error message
      const found = Array.from(new Set(original.match(rules.forbiddenChars) || []));
      // Reset lastIndex because global regex was used
      rules.forbiddenChars.lastIndex = 0;
      const charList = found.map(c => `"${c}"`).join(', ');
      return { 
        valid: false, 
        error: `Folder name contains forbidden character(s): ${charList}` 
      };
    }

    // 5) Windows-only trailing space/dot rule
    if (rules.trimTrailingSpaceDot) {
      if (/\s$/.test(original)) {
        return { valid: false, error: 'Folder name cannot end with a space on Windows' };
      }
      if (/\.$/.test(original)) {
        return { valid: false, error: 'Folder name cannot end with a dot on Windows' };
      }
    }

    // 6) Windows reserved device names
    if (rules.checkReservedNames) {
      const upperName = original.toUpperCase();
      const baseUpper = baseWithoutExtensionUpper(original);
      if (WINDOWS_RESERVED.has(upperName) || WINDOWS_RESERVED.has(baseUpper)) {
        return { 
          valid: false, 
          error: `"${original}" is a reserved device name on Windows` 
        };
      }
    }

    // All validations passed
    return { valid: true, sanitized: original };
  }

  /**
   * Sanitizes a folder name by removing/replacing invalid characters.
   * 
   * @param name - The folder name to sanitize
   * @param os - Target OS (auto-detected if not provided)
   * @returns A sanitized folder name that should pass validation
   */

  static sanitize(name: string, os: OSKind = detectRuntimeOS()): string {
    const rules = getRuleSet(os);
    if (!name) return 'New Folder';

    let result = name;

    // Remove forbidden characters (replace with underscore)
    result = result.replace(rules.forbiddenChars, '_');
    rules.forbiddenChars.lastIndex = 0; // Reset global regex

    // Windows-specific trailing spaces/dots
    if (rules.trimTrailingSpaceDot) {
      result = result.replace(/[\s.]+$/, '');
    }

    // Handle "." and ".." special cases
    if (isDotOrDotDot(result)) {
      result = 'New Folder';
    }

    // Handle Windows reserved names
    if (rules.checkReservedNames) {
      const upperName = result.toUpperCase();
      const baseUpper = baseWithoutExtensionUpper(result);
      if (WINDOWS_RESERVED.has(upperName) || WINDOWS_RESERVED.has(baseUpper)) {
        result = `${result}_folder`;
      }
    }

    // Ensure result is not empty after sanitization
    if (!result.trim()) {
      result = 'New Folder';
    }

    // Truncate to maximum length
    if (result.length > 255) {
      result = result.slice(0, 252) + '...'; // Leave room for ellipsis
    }

    return result;
  }

  /**
   * Generates a unique name by appending " (n)" suffix.
   * Handles case sensitivity based on OS filesystem rules.
   * 
   * @param baseName - The base name to make unique
   * @param existingNames - Array of existing names to avoid
   * @param os - Target OS (auto-detected if not provided)
   * @returns A unique folder name
   */
  static generateUniqueName(baseName: string, existingNames: string[], os: OSKind = detectRuntimeOS()): string {
    const rules = getRuleSet(os);
    const baseValid = this.validate(baseName, os);
    const cleanBase = baseValid.valid ? baseName : this.sanitize(baseName, os);

    // Helper function to check if name exists (case-sensitive or not)
    const nameExists = (target: string): boolean => {
      if (rules.caseInsensitiveFs) {
        const targetLower = target.toLowerCase();
        return existingNames.some(name => name.toLowerCase() === targetLower);
      }
      return existingNames.includes(target);
    };

    // Return base name if it's unique
    if (!nameExists(cleanBase)) {
      return cleanBase;
    }

    // Find the next available numbered variant
    let counter = 2;
    const maxAttempts = 10000;

    while (counter <= maxAttempts) {
      const candidate = `${cleanBase} (${counter})`;
      if (!nameExists(candidate)) {
        return candidate;
      }
      counter++;
    }

    // Extreme fallback: use timestamp
    const timestamp = Date.now();
    const timestampName = `${cleanBase} ${timestamp}`;
    
    if (!nameExists(timestampName)) {
      return timestampName;
    }

    // Final fallback: timestamp + random
    const random = Math.floor(Math.random() * 10000);
    return `${cleanBase} ${timestamp}_${random}`;
  }

  /**
   * Quick validation check that returns only a boolean.
   * 
   * @param name - The folder name to validate
   * @param os - Target OS (auto-detected if not provided)
   * @returns True if the name is valid
   */
  static isValid(name: string, os: OSKind = detectRuntimeOS()): boolean {
    return this.validate(name, os).valid;
  }

  /**
   * Get a human-readable error message for an invalid name.
   * 
   * @param name - The folder name to check
   * @param os - Target OS (auto-detected if not provided)
   * @returns Error message or null if valid
   */
  static getErrorMessage(name: string, os: OSKind = detectRuntimeOS()): string | null {
    const result = this.validate(name, os);
    return result.valid ? null : (result.error || 'Invalid folder name');
  }

  /**
   * Get the list of forbidden characters for the specified OS.
   * 
   * @param os - Target OS (auto-detected if not provided)
   * @returns Array of forbidden characters
   */
  static getForbiddenChars(os: OSKind = detectRuntimeOS()): string[] {
    const rules = getRuleSet(os);
    const source = rules.forbiddenChars.source;
    // Extract characters from regex character class
    const match = source.match(/\[([^\]]+)\]/);
    if (match) {
      return match[1].split('').filter(c => c !== '\\');
    }
    return [];
  }

  /**
   * Check if the current OS supports case-sensitive filenames.
   * 
   * @param os - Target OS (auto-detected if not provided)
   * @returns True if filesystem is case-sensitive
   */
  static isCaseSensitive(os: OSKind = detectRuntimeOS()): boolean {
    const rules = getRuleSet(os);
    return !rules.caseInsensitiveFs;
  }
}

// ---- Convenience Exports ----

/**
 * Convenience function for validating folder names.
 * @see FolderNameValidator.validate
 */
export const validateFolderName = (name: string, os?: OSKind) => 
  FolderNameValidator.validate(name, os);

/**
 * Convenience function for sanitizing folder names.
 * @see FolderNameValidator.sanitize
 */
export const sanitizeFolderName = (name: string, os?: OSKind) => 
  FolderNameValidator.sanitize(name, os);

/**
 * Convenience function for generating unique folder names.
 * @see FolderNameValidator.generateUniqueName
 */
export const generateUniqueFolderName = (baseName: string, existingNames: string[], os?: OSKind) =>
  FolderNameValidator.generateUniqueName(baseName, existingNames, os);

/**
 * Convenience function for quick validation check.
 * @see FolderNameValidator.isValid
 */
export const isFolderNameValid = (name: string, os?: OSKind) => 
  FolderNameValidator.isValid(name, os);

/**
 * Convenience function for getting validation error messages.
 * @see FolderNameValidator.getErrorMessage
 */
export const getFolderNameError = (name: string, os?: OSKind) => 
  FolderNameValidator.getErrorMessage(name, os);

/**
 * Convenience function for getting forbidden characters.
 * @see FolderNameValidator.getForbiddenChars
 */
export const getForbiddenChars = (os?: OSKind) => 
  FolderNameValidator.getForbiddenChars(os);

/**
 * Convenience function for checking case sensitivity.
 * @see FolderNameValidator.isCaseSensitive
 */
export const isCaseSensitive = (os?: OSKind) => 
  FolderNameValidator.isCaseSensitive(os);
