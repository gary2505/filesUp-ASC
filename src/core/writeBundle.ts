export async function writeLatestBundle(
  markdown: string
): Promise<{ ok: boolean; path?: string }> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("write_latest_bundle", { markdown });
    return { ok: true, path };
  } catch {
    // Web dev fallback: keep it visible (no filesystem)
    (globalThis as any).__LATEST_BUNDLE__ = markdown;
    console.warn("[bundle] Tauri invoke unavailable; bundle stored in __LATEST_BUNDLE__");
    return { ok: false };
  }
}
