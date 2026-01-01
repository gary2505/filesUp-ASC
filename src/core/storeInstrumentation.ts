/**
 * src/lib/core/storeInstrumentation.ts
 * Used by: panelStates.store.ts
 * Purpose: Wraps Svelte store operations with comprehensive debugging - prevents race conditions with mutex, blocks rapid repeated updates, logs all store changes with timestamps
 * Trigger: Called by store update functions when instrumentStoreUpdate() wrapper is applied
 * Event Flow: Store update → forbidRapidRepeat check → runExclusive mutex → execute update → log completion
 * Functions: instrumentStoreUpdate(storeName, operationName, fn), detectStoreDoubleWrite(storeName, field, newValue, oldValue?), logStoreSubscription(storeName, subscriberName, value)
 * Status: Active in panelStates for P1/P2/P3 state management; prevents concurrent updates
 */

import { createDebugLogger } from './index';
import { runExclusive } from './operations/raceOps';
import { forbidRapidRepeat } from './operations/actionGate';

const debug = createDebugLogger('StoreInstrumentation');

/**
 * Wraps a store update function with comprehensive debugging
 */
export function instrumentStoreUpdate<T extends (...args: any[]) => any>(
  storeName: string,
  operationName: string,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const operationKey = `${storeName}.${operationName}`;
    
    // Block rapid repeated operations
    if (!forbidRapidRepeat(operationKey)) {
      debug.warn('overhead', 'rapidStoreUpdate', 'Store update blocked - too rapid', { 
        storeName, 
        operationName,
        args: args.length 
      });
      return;
    }
    
    debug.debug('store', 'storeUpdateStart', 'Store update starting', { 
      storeName, 
      operationName,
      args: args.map((arg, i) => ({ index: i, type: typeof arg, value: arg })),
      timestamp: performance.now()
    });
    
    const result = runExclusive(operationKey, 'store', operationName, async () => {
      const updateResult = fn(...args);
      
      debug.debug('store', 'storeUpdateComplete', 'Store update completed', { 
        storeName, 
        operationName,
        hasResult: !!updateResult,
        timestamp: performance.now()
      });
      
      return updateResult;
    });
    
    return result;
  }) as T;
}

/**
 * Comprehensive store subscription logging
 */
export function logStoreSubscription(storeName: string, subscriberName: string, value: unknown) {
  debug.debug('store', 'storeSubscription', 'Store value received by subscriber', { 
    storeName, 
    subscriberName,
    valueType: typeof value,
    isNull: value === null,
    isUndefined: value === undefined,
    timestamp: performance.now()
  });
}

/**
 * Log async store operations
 */
export function logAsyncStoreOperation(storeName: string, operationName: string, promise: Promise<any>) {
  debug.debug('store', 'asyncStoreStart', 'Async store operation started', { 
    storeName, 
    operationName,
    timestamp: performance.now()
  });
  
  promise
    .then((result) => {
      debug.debug('store', 'asyncStoreSuccess', 'Async store operation completed', { 
        storeName, 
        operationName,
        hasResult: !!result,
        timestamp: performance.now()
      });
    })
    .catch((error) => {
      debug.warn('store', 'asyncStoreError', 'Async store operation failed', { 
        storeName, 
        operationName,
        error: error.message,
        stack: error.stack,
        timestamp: performance.now()
      });
    });
  
  return promise;
}