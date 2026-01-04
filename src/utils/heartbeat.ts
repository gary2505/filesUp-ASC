/**
 * This is src/lib/utils/heartbeat.ts
 * Used by: src/lib/P1/TreeNodeView.svelte, src/lib/layout/tabs/Tab1Layout.svelte
 * Purpose: Tracks application activity with heartbeat system for debugging stalls
 * Trigger: Called periodically or on user interactions
 * Event Flow: Records timestamps, checks for inactivity
 * List of functions: beat, getLastBeat, getBeatHistory, getTimeSinceLastBeat, checkHeartbeat
 */

// src/lib/utils/heartbeat.ts
let lastBeat = Date.now();
let beatHistory: Array<{ tag: string; timestamp: number }> = [];
const MAX_HISTORY = 20; // Keep last 20 beats

export function beat(tag: string): void {
  lastBeat = Date.now();
  
  // Add to history
  beatHistory.push({ tag, timestamp: lastBeat });
  
  // Keep only recent beats
  if (beatHistory.length > MAX_HISTORY) {
    beatHistory.shift();
  }
  
  console.debug(`[beat] ${tag} @ ${lastBeat}`);
}

export function getLastBeat(): number {
  return lastBeat;
}

export function getBeatHistory(): Array<{ tag: string; timestamp: number }> {
  return [...beatHistory];
}

export function getTimeSinceLastBeat(): number {
  return Date.now() - lastBeat;
}

// Development helper to check for stalled execution
export function checkHeartbeat(warnAfterMs = 30000): void { // Increased from 5s to 30s
  const timeSince = getTimeSinceLastBeat();
  if (timeSince > warnAfterMs) {
    console.warn(`[heartbeat] No activity for ${timeSince}ms. Last beat:`, beatHistory[beatHistory.length - 1]);
  }
}

// Auto-check heartbeat in development - much less frequent
if (import.meta.env.DEV) {
  setInterval(() => checkHeartbeat(60000), 30000); // Check every 30s, warn after 60s
}