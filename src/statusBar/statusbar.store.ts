import { writable, derived } from 'svelte/store';
import { activeTab } from '$lib/stores/activeTab.store';
import { P1_State, P2_State, P3_State } from '$lib/stores/panelStates.store';

// StatusBar state interface
export interface StatusBarState {
  // Context information
  currentPath: string;
  currentPanel: string;
  
  // Selection information
  selectionCount: number;
  totalItems: number;
  selectedSize: number; // in bytes
  
  // Operation status
  operation: {
    type: 'copy' | 'move' | 'delete' | 'loading' | null;
    text: string;
    progress: number; // 0-100
    indeterminate: boolean;
  } | null;
  
  // Quick info
  language: string;
  theme: string;
  
  // Messages
  message: string;
  messageType: 'info' | 'success' | 'warning' | 'error';
}

// Default state
const defaultState: StatusBarState = {
  currentPath: 'This PC',
  currentPanel: 'MyPC',
  selectionCount: 0,
  totalItems: 0,
  selectedSize: 0,
  operation: null,
  language: 'EN',
  theme: 'Dark',
  message: 'Ready',
  messageType: 'info'
};

// Create the main store
export const statusBarStore = writable<StatusBarState>(defaultState);

// Enhanced context that derives from real application state
export const statusBarContext = derived(
  [statusBarStore, activeTab, P1_State, P2_State, P3_State],
  ([status, tab, p1, p2, p3]) => {
    // Determine current context based on active tab and panel states
    let currentPath = status.currentPath;
    let currentPanel = status.currentPanel;
    
    // Auto-update context based on panel states if not manually overridden
    if (status.currentPath === 'This PC' || !status.currentPath) {
      if (p3?.currentFolder) {
        currentPath = p3.currentFolder;
        currentPanel = 'FileView';
      } else if (p2?.currentFolder) {
        currentPath = p2.currentFolder;
        currentPanel = 'FolderTree';
      } else if (p1?.selectedFolder && p1.selectedFolder !== 'This PC') {
        currentPath = p1.selectedFolder;
        currentPanel = 'MyPC';
      }
    }
    
    return {
      ...status,
      currentPath,
      currentPanel,
      tabType: tab?.layoutType || 'explorer'
    };
  }
);

// Convenience functions for updating specific parts
export const statusBarActions = {
  // Update context
  setContext: (path: string, panel: string) => {
    statusBarStore.update(state => ({
      ...state,
      currentPath: path,
      currentPanel: panel
    }));
  },
  
  // Update selection
  setSelection: (count: number, total: number, size: number = 0) => {
    statusBarStore.update(state => ({
      ...state,
      selectionCount: count,
      totalItems: total,
      selectedSize: size
    }));
  },
  
  // Update operation status
  setOperation: (operation: StatusBarState['operation']) => {
    statusBarStore.update(state => ({
      ...state,
      operation
    }));
  },
  
  // Clear operation
  clearOperation: () => {
    statusBarStore.update(state => ({
      ...state,
      operation: null
    }));
  },
  
  // Set temporary message
  setMessage: (message: string, type: StatusBarState['messageType'] = 'info', duration: number = 3000) => {
    statusBarStore.update(state => ({
      ...state,
      message,
      messageType: type
    }));
    
    // Auto-clear message after duration
    if (duration > 0) {
      setTimeout(() => {
        statusBarStore.update(state => ({
          ...state,
          message: 'Ready',
          messageType: 'info'
        }));
      }, duration);
    }
  },
  
  // Update theme/language
  setQuickInfo: (language?: string, theme?: string) => {
    statusBarStore.update(state => ({
      ...state,
      ...(language && { language }),
      ...(theme && { theme })
    }));
  },
  
  // Reset to default
  reset: () => {
    statusBarStore.set(defaultState);
  }
};

// Helper functions for formatting
export const formatters = {
  // Format file size
  formatSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  },
  
  // Format path for display
  formatPath: (path: string, maxLength: number = 40): string => {
    if (!path || path === 'This PC') return 'This PC';
    
    if (path.length <= maxLength) return path;
    
    // Truncate from middle
    const start = path.substring(0, Math.floor(maxLength * 0.4));
    const end = path.substring(path.length - Math.floor(maxLength * 0.4));
    return `${start}...${end}`;
  },
  
  // Format selection text
  formatSelection: (count: number, total: number, size: number = 0): string => {
    if (count === 0) {
      return total > 0 ? `${total} items` : 'Ready';
    } else if (count === 1) {
      const sizeText = size > 0 ? ` (${formatters.formatSize(size)})` : '';
      return `1 item selected${sizeText}`;
    } else {
      const sizeText = size > 0 ? ` (${formatters.formatSize(size)})` : '';
      return `${count} items selected${sizeText}`;
    }
  }
};

// Export the formatters as named export for easy use
export { formatters as statusBarFormatters };
