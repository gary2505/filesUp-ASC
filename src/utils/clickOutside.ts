/**
 * This is src/lib/utils/clickOutside.ts
 * Used by: src/lib/P2/selection/SelectAllControl.svelte, src/lib/P3/selection/SelectAllControl.svelte, src/lib/P2/parts/HeaderChevronMenu.svelte
 * Purpose: Svelte action to detect clicks outside an element, useful for closing dropdowns or menus
 * Trigger: Applied as use:clickOutside={callback} in Svelte components
 * Event Flow: Listens for document clicks, checks if target is outside the node, calls callback if so
 * List of functions: clickOutside
 */

/**
 * Svelte action for detecting clicks outside an element
 */
export function clickOutside(node: HTMLElement, callback: () => void) {
  const handleClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
      // Use setTimeout to avoid closing immediately on the same click that opened
      setTimeout(() => callback(), 0);
    }
  };

  // Add listener after a small delay to prevent immediate closing
  const timeoutId = setTimeout(() => {
    document.addEventListener('click', handleClick, true);
  }, 100);

  return {
    destroy() {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClick, true);
    }
  };
}
