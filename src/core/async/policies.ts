export type OpPolicy = {
  timeoutMs: number;
  retries: number;
  jitter?: boolean;
  // optional: custom retry predicate per op
  shouldRetryName?: string; // references a named predicate in `retryPredicates`
};

export const retryPredicates: Record<string, (e: unknown) => boolean> = {
  timeoutOnly: (e) => e?.constructor?.name === 'TimeoutError',
  timeoutAnd5xx: (e: any) => e?.name === 'TimeoutError' || (e?.isHttp && e.status >= 500),
};

export const defaultPolicy: OpPolicy = { 
  timeoutMs: 4000, 
  retries: 1, 
  jitter: true 
};

export const opPolicies: Record<string, Partial<OpPolicy>> = {
  // per-operation overrides (name them freely and reuse everywhere)
  'fs.loadFolderContents': { timeoutMs: 4000, retries: 2, shouldRetryName: 'timeoutOnly' },
  'fs.delete':            { timeoutMs: 6000, retries: 0 },
  'net.search':           { timeoutMs: 7000, retries: 1, shouldRetryName: 'timeoutAnd5xx' },
  'components.import':    { timeoutMs: 3000, retries: 1, shouldRetryName: 'timeoutOnly' },
  
  // ✅ NEW: MyPC Panel pinned folders operations
  'mypc.loadPinnedFolders': { timeoutMs: 10000, retries: 1, shouldRetryName: 'timeoutOnly' },
  'mypc.validatePinnedPath': { timeoutMs: 8000, retries: 1, shouldRetryName: 'timeoutOnly' },
  'mypc.loadDrives': { timeoutMs: 5000, retries: 2, shouldRetryName: 'timeoutOnly' },
  
  // ✅ Production upgrade policies (GPS integration)
  'fs.loadFolder': { timeoutMs: 30000, retries: 2, shouldRetryName: 'timeoutOnly' },
  'fs.listDir': { timeoutMs: 30000, retries: 2, shouldRetryName: 'timeoutOnly' },
  'thumb.batch': { timeoutMs: 20000, retries: 1 },
  'thumb.single': { timeoutMs: 10000, retries: 1 },
  'ops.copy': { timeoutMs: 120000, retries: 0 }, // 2 min, no retry
  'ops.move': { timeoutMs: 120000, retries: 0 },
  'ops.delete': { timeoutMs: 60000, retries: 0 }, // 1 min, no retry
  'ops.rename': { timeoutMs: 10000, retries: 0 },
  'watcher.start': { timeoutMs: 5000, retries: 1 },
  'watcher.stop': { timeoutMs: 2000, retries: 0 },
};
