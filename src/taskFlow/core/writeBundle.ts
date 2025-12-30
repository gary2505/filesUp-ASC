import { getTraceEvents } from "../trace";

export async function writeLatestBundle(customContent?: string): Promise<void> {
  const events = getTraceEvents();
  const lines: string[] = [];

  lines.push("# DEBUG BUNDLE (latest)\n");
  lines.push("## TRACE_SUMMARY");
  lines.push("Boot flow startup bundle\n");
  lines.push("## EVENTS");

  for (const evt of events) {
    lines.push(`- ${evt.t} [${evt.k}] ${evt.msg}`);
  }

  lines.push("\n## CONTRACTS");
  lines.push("_(managed by frontend runtime)_\n");
  lines.push("## LOG TAIL");
  lines.push("_(development mode)_");

  const bundleContent = customContent || lines.join("\n");

  try {
    const response = await fetch("http://127.0.0.1:5173/__write-bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: bundleContent }),
    });

    if (!response.ok) {
      console.warn("Failed to write bundle (dev mode)");
    }
  } catch {
    // In dev mode, ignore network errors - bundle is just diagnostic
    console.log("Bundle write (dev mode, offline is ok)");
  }
}
