/**
 * This is src/lib/utils/fontSizeUtils.ts
 * Used by: src/lib/P2/parts/TreeRowDets.svelte, src/lib/P3/parts/TreeRowDets.svelte, src/lib/P3/cells/NameCellWithThumbP1.svelte, src/lib/P2/cells/NameCellWithThumbP1.svelte, src/lib/P2/cells/NameCellWithThumb.svelte, src/lib/P3/cells/NameCellWithThumb.svelte, src/lib/P1/parts/DetailsTreeRow.svelte, src/lib/P1/cells/NameCellWithThumbP1.svelte, src/lib/P1/cells/NameCellWithThumb.svelte, src/lib/folderTree/cells/NameCellWithThumbP1.svelte, src/lib/folderTree/cells/NameCellWithThumb.svelte
 * Purpose: Converts font size settings to pixel values for UI components
 * Trigger: Called when rendering UI elements that need font sizes
 * Event Flow: Maps setting strings to pixel numbers
 * List of functions: getBaseFontSize, getAdjustedFontSize, fontSizeToString
 */

/**
 * Font size utilities for converting between settings and pixel values
 * 
 * Base font sizes from settings:
 * - small: 10px
 * - medium: 12px (default)
 * - large: 16px
 * - extra-large: 18px
 * 
 * Icon size adjustments (relative to base):
 * - small (xs): base - 2px
 * - medium (sm): base
 * - large (md): base + 2px
 */

export type FontSizeSetting = 'small' | 'medium' | 'large' | 'extra-large';
export type IconSizeSetting = 'small' | 'medium' | 'large';

/**
 * Get base font size in pixels from settings
 */
export function getBaseFontSize(fontSize: FontSizeSetting): number {
  switch (fontSize) {
    case 'small':
      return 10;
    case 'medium':
      return 12;
    case 'large':
      return 16;
    case 'extra-large':
      return 18;
    default:
      return 12; // medium default
  }
}

/**
 * Get adjusted font size based on icon size setting
 * s = currentSize - 2
 * m = currentSize
 * l = currentSize + 2
 */
export function getAdjustedFontSize(
  baseFontSize: number,
  iconSize: IconSizeSetting
): { name: number; secondary: number } {
  let nameSize: number;
  
  switch (iconSize) {
    case 'small':
      nameSize = baseFontSize - 2;
      break;
    case 'medium':
      nameSize = baseFontSize;
      break;
    case 'large':
      nameSize = baseFontSize + 2;
      break;
    default:
      nameSize = baseFontSize;
  }
  
  // Secondary size is always 2px smaller than name size
  const secondarySize = nameSize - 2;
  
  // Minimum sizes to ensure readability
  return {
    name: Math.max(nameSize, 8),
    secondary: Math.max(secondarySize, 6),
  };
}

/**
 * Convert font size setting to string suitable for inline styles
 */
export function fontSizeToString(size: number): string {
  return `${size}px`;
}
