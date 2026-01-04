/**
 * lib/utils/types.ts - Core Type Definitions for FilesUP Application
 * 
 * Used by: 47+ files across the entire application (utilities, stores, components, services)
 * Purpose: Central type definitions repository providing core data structures for the FilesUP file manager
 * Trigger: Imported throughout the application wherever type safety for file system operations is needed
 * Event Flow: 
 *   1. Types define contracts for data structures (FileItem, TreeNode, MyPCItem, etc.)
 *   2. Backend/Tauri APIs populate these structures with file system data
 *   3. Stores manage state using these types (session, pinned folders, mypc navigation)
 *   4. Components consume typed data for rendering (file views, trees, previews)
 *   5. Utilities transform and classify data using these type definitions
 * 
 * Core Type Categories:
 *   - File System: FileItem, TreeNode, DriveInfo, TreeItem
 *   - UI Configuration: ViewMode, IconSize, SortKey/Dir, GroupKey
 *   - Navigation: MyPCItem, PinnedItem, FileRef
 *   - File Classification: FileGroup, Classified, GroupDefaults
 *   - UI Feedback: ToastNotification, ToastType
 * 
 * Architecture: Single source of truth for all application type definitions,
 * ensuring consistency across components and enabling TypeScript compilation safety
 */

export interface FileItem {
  id: string;
  path: string;
  name: string;
  kind: string; // "file" | "folder"
  is_directory: boolean; // computed from kind === "folder"
  size?: number; // File size in bytes (optional for directories)
  mtime?: number; // Date modified in millis since epoch (from Rust)
  ctime?: number; // Date created in millis since epoch (from Rust)
  ext?: string; // File extension
  mime?: string; // MIME type
  tags?: string[]; // reserved for future
  authors?: string[]; // reserved for future  
  title?: string; // reserved for future
  hidden?: boolean;
  system?: boolean;
  symlink?: boolean;
  link_target?: string;
  broken_link?: boolean;
  isEmpty?: boolean; // ⚡ NEW: true/false for folders, undefined for files (Rust is_empty → camelCase)
  
  // ✅ Computed properties for compatibility
  modified?: string | null; // Computed from mtime for backward compatibility
}

// ✅ NEW: File Groups Types
export type ViewMode = 'list' | 'grid' | 'details';
export type IconSize = 'small' | 'medium' | 'large';
export type SortDir = 'asc' | 'desc';
export type SortKey =
  | 'name'
  | 'size'
  | 'modifiedAt'
  | 'createdAt'
  | 'type'
  | 'extension'
  | 'artist'
  | 'album'
  | 'duration'
  | 'dateTaken';

export type GroupKey =
  | 'none'
  | 'type'
  | 'extension'
  | 'artist'
  | 'album'
  | 'year'
  | 'date'
  | 'author';

export type FileGroup =
  | 'text'
  | 'docs'
  | 'pictures'
  | 'video'
  | 'songs'
  | 'web'
  | 'code'
  | 'pdfs'
  | 'archives'
  | 'spreadsheets'
  | 'presentations'
  | 'ebooks'
  | 'fonts'
  | 'executables'
  | 'other';

export interface GroupDefaults {
  [group: string]: {
    view: ViewMode;
    iconSize?: IconSize;
    sort: { key: SortKey; dir: SortDir };
    group?: GroupKey;
  };
}

export interface Classified {
  group: FileGroup;
  extension: string;
  subtype?: string;
}

export interface FileRef {
  path: string;
  name: string;
}

export interface TreeNode {
  uid: string;
  item: FileItem | TreeItem;
  children: TreeNode[];
  expanded: boolean;
  loading: boolean;
  isDrive: boolean;
  version?: number; // ✅ Bulletproof: Version for deterministic re-rendering
}

export interface DriveInfo {
  name: string;
  path: string;
  drive_type: string;
}

export interface TreeItem {
  name: string;
  path: string;
  is_directory: boolean; // drives use true
  drive_type?: string;
  size?: number;
}

// MyPC Panel types for navigation
export interface MyPCItem {
  id: string;
  label: string;
  path: string | null;                // null for groups/placeholders
  kind: 'group' | 'pinned' | 'drive' | 'special' | 'network';
  icon?: string;
  removable?: boolean;                // for pinned items
  expanded?: boolean;                 // for groups/tree nodes
  freeSpace?: number;                 // free space in bytes (for drives)
  children?: MyPCItem[];
  
  // Runtime metadata (added dynamically)
  _resolutionFailed?: boolean;        // known folder resolution failed
  _originalPath?: string;             // original path before resolution
  _lastValidated?: number;            // timestamp of last validation
  _accessible?: boolean;              // whether path is accessible
}

// Notification system types
export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastNotification {
  type: ToastType;
  message: string;
}

// Pinned folders types
export interface PinnedItem {
  id: string;
  name: string;
  path: string;
  icon: string;
  locked: boolean;
  checked: boolean;
  // Runtime validation flags (added dynamically)
  _missingPath?: boolean;
  _inaccessible?: boolean;
  _lastError?: string | null;
  _pendingRemoval?: boolean;
}

export interface PinnedListV1 {
  version: number;
  items: PinnedItem[];
}

