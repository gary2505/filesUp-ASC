// Tauri-only logger implementation
import { safeInvoke, CancelToken } from '$lib/services/safeInvoke';

export async function logEx(message: string, type: 'exception' | 'log' = 'exception'): Promise<void> {
  try {
    await safeInvoke<void>(
      'append_to_ex_log',
      { message, type_: type, type },
      () => {},
      new CancelToken()
    );
  } catch (error) {
    console.error('[logger-tauri] Failed to write log:', error);
  }
}

export async function readExLog(type: 'exception' | 'log' = 'exception'): Promise<string> {
  try {
    const result = await safeInvoke<string>(
      "read_ex_log",
      { type_: type },
      () => '',
      new CancelToken()
    );
    return result;
  } catch (error) {
    console.error('[logger-tauri] Failed to read log:', error);
    return '';
  }
}

export async function clearExLog(type: 'exception' | 'log' = 'exception'): Promise<void> {
  try {
    await safeInvoke<void>(
      "clear_ex_log",
      { type_: type },
      () => {},
      new CancelToken()
    );
  } catch (error) {
    console.error('[logger-tauri] Failed to clear log:', error);
  }
}

export async function getLogDirectoryPath(): Promise<string> {
  try {
    console.log('[logger-tauri] about to call invoke get_log_directory_path');
    const result = await safeInvoke<string>(
      "get_log_directory_path",
      {},
      () => '',
      new CancelToken()
    );
    return result;
  } catch (error) {
    console.error('[logger-tauri] Failed to get log directory path:', error);
    return '';
  }
}
