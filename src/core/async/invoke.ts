import { invoke } from '$lib/tauri/ipc';
import { newRequestId } from './requestId';

export type InvokeArgs = Record<string, unknown>;

export function invokeWithId<T>(cmd: string, args: InvokeArgs = {}, request_id = newRequestId()) {
  return { 
    promise: invoke<T>(cmd, { ...args, request_id }), 
    request_id 
  };
}
