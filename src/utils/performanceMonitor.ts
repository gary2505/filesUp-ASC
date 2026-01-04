/**
 * This is src/lib/utils/performanceMonitor.ts
 * Used by: src/lib/utils/startupOrchestrator.ts, src/lib/App.svelte, src/lib/boot/bootOrchestrator_notUsed.ts
 * Purpose: Track app initialization timing and performance
 * Trigger: Called during app startup phases
 * Event Flow: Start/end timing, log durations
 * List of functions: perfMonitor.start, perfMonitor.end, perfMonitor.mark, perfMonitor.getSummary
 */

/**
 * Performance Monitor - Track app initialization timing
 * Helps identify bottlenecks and optimize loading time
 */

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private entries: Map<string, PerformanceEntry> = new Map();
  private appStartTime: number = performance.now();
  private markers: Array<{ name: string; time: number; relativeMs: number }> = [];

  constructor() {
    // Mark initial load
    this.mark('app-init');
  }

  /**
   * Start timing a phase
   */
  start(name: string, metadata?: Record<string, any>): void {
    const entry: PerformanceEntry = {
      name,
      startTime: performance.now(),
      metadata,
    };
    this.entries.set(name, entry);
    console.log(`⏱️ [Perf] START: ${name}`);
  }

  /**
   * End timing a phase
   */
  end(name: string, metadata?: Record<string, any>): number | null {
    const entry = this.entries.get(name);
    if (!entry) {
      console.warn(`⚠️ [Perf] No start entry found for: ${name}`);
      return null;
    }

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;
    if (metadata) {
      entry.metadata = { ...entry.metadata, ...metadata };
    }

    const relativeMs = entry.endTime - this.appStartTime;
    console.log(
      `✅ [Perf] END: ${name} → ${entry.duration.toFixed(2)}ms (at +${relativeMs.toFixed(0)}ms)`
    );

    return entry.duration;
  }

  /**
   * Mark a specific point in time
   */
  mark(name: string): void {
    const time = performance.now();
    const relativeMs = time - this.appStartTime;
    this.markers.push({ name, time, relativeMs });
    console.log(`📍 [Perf] MARK: ${name} (at +${relativeMs.toFixed(0)}ms)`);
  }

  /**
   * Get duration of a completed phase
   */
  getDuration(name: string): number | null {
    const entry = this.entries.get(name);
    return entry?.duration ?? null;
  }

  /**
   * Get summary report
   */
  getSummary(): {
    totalTime: number;
    phases: Array<{ name: string; duration: number; metadata?: any }>;
    markers: Array<{ name: string; relativeMs: number }>;
  } {
    const phases: Array<{ name: string; duration: number; metadata?: any }> = [];

    for (const [name, entry] of this.entries) {
      if (entry.duration !== undefined) {
        phases.push({
          name,
          duration: entry.duration,
          metadata: entry.metadata,
        });
      }
    }

    // Sort by start time
    phases.sort((a, b) => {
      const entryA = this.entries.get(a.name)!;
      const entryB = this.entries.get(b.name)!;
      return entryA.startTime - entryB.startTime;
    });

    return {
      totalTime: performance.now() - this.appStartTime,
      phases,
      markers: this.markers,
    };
  }

  /**
   * Print formatted summary to console
   */
  printSummary(): void {
    const summary = this.getSummary();

    // Route through unified logger for level control and telemetry
    import('$lib/core/logging/unified-logger').then(({ logger }) => {
      const phasesData = summary.phases.map(p => ({
        name: p.name,
        ms: parseFloat(p.duration.toFixed(2)),
        pct: parseFloat(((p.duration / summary.totalTime) * 100).toFixed(1)),
        metadata: p.metadata
      }));

      const markersData = summary.markers.map(m => ({
        name: m.name,
        relativeMs: Math.round(m.relativeMs)
      }));

      logger.info(
        { scope: 'perf', component: 'PerfSummary', action: 'startup' },
        'Startup performance summary',
        {
          totalMs: parseFloat(summary.totalTime.toFixed(2)),
          phases: phasesData,
          markers: markersData
        }
      );
    });

    // Only print ASCII table in dev mode at trace/debug levels
    if (import.meta.env.DEV) {
      // Check if we should show detailed ASCII (systemDebugLevel <= 2)
      // For now, default to showing detailed output in dev mode
      const debugLevel = 2; // Default to debug level in dev mode
      
      // Only show ASCII table at trace(1) or debug(2) levels
      if (debugLevel <= 2) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 PERFORMANCE SUMMARY');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`⏱️  Total Time: ${summary.totalTime.toFixed(2)}ms`);
            console.log('\n📈 PHASES:');

            let accumulatedTime = 0;
            for (const phase of summary.phases) {
              const percentage = ((phase.duration / summary.totalTime) * 100).toFixed(1);
              console.log(
                `  ${phase.name.padEnd(30)} ${phase.duration.toFixed(2).padStart(8)}ms  (${percentage}%)`
              );
              if (phase.metadata) {
                console.log(`    ${JSON.stringify(phase.metadata)}`);
              }
              accumulatedTime += phase.duration;
            }

            // Show gap time (overhead between phases)
            const gapTime = summary.totalTime - accumulatedTime;
            if (gapTime > 10) {
              const gapPercentage = ((gapTime / summary.totalTime) * 100).toFixed(1);
              console.log(
                `  ${'[Overhead/Gaps]'.padEnd(30)} ${gapTime.toFixed(2).padStart(8)}ms  (${gapPercentage}%)`
              );
            }

            if (summary.markers.length > 0) {
              console.log('\n📍 MARKERS:');
              for (const marker of summary.markers) {
                console.log(`  ${marker.name.padEnd(30)} +${marker.relativeMs.toFixed(0)}ms`);
              }
            }

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            // Performance recommendations
            this.printRecommendations(summary);
          }
    }
  }

  /**
   * Print performance recommendations
   */
  private printRecommendations(summary: ReturnType<typeof this.getSummary>): void {
    console.log('💡 RECOMMENDATIONS:');

    // Find slowest phase
    const slowest = summary.phases.reduce(
      (max, phase) => (phase.duration > max.duration ? phase : max),
      summary.phases[0]
    );

    if (slowest && slowest.duration > 1000) {
      console.log(`  ⚠️  ${slowest.name} is taking ${slowest.duration.toFixed(0)}ms (slow!)`);
      console.log(`     Consider optimizing or lazy-loading this phase.`);
    }

    // Check total time
    if (summary.totalTime > 3000) {
      console.log(`  ⚠️  Total startup time is ${(summary.totalTime / 1000).toFixed(1)}s`);
      console.log(`     Target: <1s for good UX, <2s acceptable`);
    } else if (summary.totalTime < 1000) {
      console.log(`  ✅ Excellent startup time: ${summary.totalTime.toFixed(0)}ms`);
    } else if (summary.totalTime < 2000) {
      console.log(`  ✅ Good startup time: ${(summary.totalTime / 1000).toFixed(1)}s`);
    }

    console.log();
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.entries.clear();
    this.markers = [];
    this.appStartTime = performance.now();
    this.mark('app-reset');
    console.log('🔄 [Perf] Monitor reset');
  }

  /**
   * Export data for analysis
   */
  exportData(): string {
    const summary = this.getSummary();
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ...summary,
      },
      null,
      2
    );
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).perfMonitor = perfMonitor;
  (window as any).showPerf = () => perfMonitor.printSummary();
  (window as any).exportPerf = () => {
    const data = perfMonitor.exportData();
    console.log(data);
    return data;
  };
}

