<script lang="ts">
  import { onMount } from 'svelte';

  interface TraceEvent {
    t: string;
    k: string;
    msg: string;
    data?: any;
  }

  interface DebugBundle {
    TRACE_SUMMARY: string;
    events: TraceEvent[];
    contracts: any[];
    logTail: string[];
  }

  let bundle: DebugBundle | null = $state(null);
  let loading = $state(false);
  let error = $state('');

  async function loadBundle() {
    loading = true;
    error = '';
    try {
      const response = await fetch('/.ai/bundles/latest.bundle.md');
      if (!response.ok) {
        throw new Error('Bundle not found');
      }
      const text = await response.text();
      
      // Simple parser: extract JSON-like sections
      const summaryMatch = text.match(/## TRACE_SUMMARY\n(.+?)\n\n/);
      const eventsMatch = text.match(/## EVENTS\n([\s\S]*?)\n\n/);
      
      const events: TraceEvent[] = [];
      if (eventsMatch) {
        const lines = eventsMatch[1].split('\n').filter((l) => l.startsWith('- '));
        for (const line of lines) {
          const match = line.match(/- (.+?) \[(.+?)\] (.+?)$/);
          if (match) {
            events.push({
              t: match[1],
              k: match[2],
              msg: match[3]
            });
          }
        }
      }

      bundle = {
        TRACE_SUMMARY: summaryMatch?.[1] ?? 'No summary',
        events,
        contracts: [],
        logTail: []
      };
    } catch (err) {
      error = `Failed to load bundle: ${err}`;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadBundle();
  });
</script>

<div class="card bg-base-200 shadow-md p-4">
  <div class="card-title text-sm mb-3">📊 Debug Trace</div>

  {#if loading}
    <div class="loading loading-spinner loading-sm"></div>
  {:else if error}
    <div class="alert alert-error text-sm">{error}</div>
  {:else if bundle}
    <div class="space-y-3">
      <!-- Trace Summary -->
      <div>
        <div class="text-xs font-bold text-secondary">TRACE_SUMMARY</div>
        <div class="text-sm font-mono bg-base-100 p-2 rounded border border-base-300">
          {bundle.TRACE_SUMMARY}
        </div>
      </div>

      <!-- Events Timeline -->
      {#if bundle.events.length > 0}
        <div>
          <div class="text-xs font-bold text-secondary mb-2">EVENTS ({bundle.events.length})</div>
          <div class="space-y-1">
            {#each bundle.events as evt}
              <div class="text-xs bg-base-100 p-2 rounded border-l-4 border-info">
                <span class="font-bold text-info">[{evt.k}]</span>
                <span class="text-gray-600">{evt.msg}</span>
                <div class="text-xs text-gray-400 mt-1">{evt.t}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Refresh Button -->
    <div class="mt-3 flex gap-2">
      <button
        onclick={loadBundle}
        class="btn btn-xs btn-outline"
        disabled={loading}
      >
        🔄 Refresh
      </button>
    </div>
  {:else}
    <div class="text-xs text-gray-500">No trace data</div>
  {/if}
</div>

<style>
  :global(.card) {
    font-size: 0.875rem;
  }
</style>
