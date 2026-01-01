<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { logStore, log, type LogEntry, type LogLevel } from './logService';
  import { createDebugLogger } from './unified-logger';
  import SelectField from '$lib/ui/SelectField.svelte';
  
  const logger = createDebugLogger('LogViewer');
  logger.debug('ui', 'lifecycle', 'Component loading...');
  
  export let open: boolean;
  const dispatch = createEventDispatcher();
  let allLogs: LogEntry[] = [];
  let search = '';
  let modalRef: HTMLDivElement;

  let filterLevel: LogLevel | 'all' = 'all';
  let filterScope: string = '';
  
  // Count logs by level
  $: logLevelCounts = allLogs.reduce((counts, log) => {
    counts[log.level] = (counts[log.level] || 0) + 1;
    return counts;
  }, {} as Record<LogLevel, number>);
  
  // Reactive filtered logs - recalculates when dependencies change
  $: filteredLogs = allLogs.filter(log => {
    // Level filter
    if (filterLevel !== 'all' && log.level !== filterLevel) {
      return false;
    }
    
    // Scope filter
    if (filterScope && !log.scope.toLowerCase().includes(filterScope.toLowerCase())) return false;
    
    // Search filter (in message or details)
    if (search) {
      const searchLower = search.toLowerCase();
      const matchMessage = log.message.toLowerCase().includes(searchLower);
      const matchScope = log.scope.toLowerCase().includes(searchLower);
      const matchDetails = log.details ? JSON.stringify(log.details).toLowerCase().includes(searchLower) : false;
      return matchMessage || matchScope || matchDetails;
    }
    
    return true;
  });
  
  // Draggable modal state
  let windowX = 0, windowY = 0;
  let isDragging = false, startX = 0, startY = 0;

  // Subscribe to unified logger store
  const unsubscribe = logStore.subscribe(logs => {
    allLogs = logs;
  });

  function onPointerDown(e: PointerEvent) {
    isDragging = true;
    startX = e.clientX - windowX;
    startY = e.clientY - windowY;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    windowX = e.clientX - startX;
    windowY = e.clientY - startY;
  }
  function onPointerUp() {
    isDragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }
  // Reset position on open
  $: if (open) { 
    windowX = 0; 
    windowY = 0; 
    logger.debug('ui', 'modal', 'Modal opened');
  } else {
    logger.debug('ui', 'modal', 'Modal closed');
  }

  function formatTime(ts: number): string {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
  }

  function formatDetails(details: unknown): string {
    if (!details) return '';
    if (typeof details === 'object') return JSON.stringify(details, null, 2);
    return String(details);
  }

  function handleClear() {
    log.clear();
    logger.info('ui', 'action', 'Cleared unified log store');
  }

  async function copyLogs() {
    const logText = filteredLogs.map(l => 
      `${formatTime(l.ts)} [${l.level.toUpperCase()}] [${l.scope}] ${l.message}${l.details ? '\n' + formatDetails(l.details) : ''}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(logText);
      logger.info('ui', 'action', 'Copied logs to clipboard', { count: filteredLogs.length });
    } catch (err) {
      logger.error('ui', 'action', 'Failed to copy logs', { err });
    }
  }

  // Click outside to close functionality
  function handleClickOutside(event: MouseEvent) {
    if (modalRef && !modalRef.contains(event.target as Node)) {
      logger.debug('ui', 'modal', 'Click outside detected, closing modal');
      close();
    }
  }

  // Add/remove click outside listener based on open state
  $: if (open) {
    logger.debug('ui', 'lifecycle', 'Adding click outside listener');
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  } else {
    logger.debug('ui', 'lifecycle', 'Removing click outside listener');
    document.removeEventListener('click', handleClickOutside);
  }

  function close() {
    logger.debug('ui', 'modal', 'Modal closing via close()');
    open = false;
    dispatch('close');
  }

  // Handle Escape key for modal close
  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        logger.debug('ui', 'keyboard', 'Escape key pressed, closing modal');
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Cleanup on component destroy
  onDestroy(() => {
    logger.debug('ui', 'lifecycle', 'Component destroying, cleaning up listeners');
    document.removeEventListener('click', handleClickOutside);
    unsubscribe();
  });
</script>

{#if open}
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black bg-opacity-40 z-50" role="dialog" aria-modal="true" style="pointer-events:auto;">
    <!-- Draggable Modal Window -->
    <div
      bind:this={modalRef}
      class="fixed bg-base-100 p-4 rounded shadow-lg w-[36rem] max-w-full"
      style:top={`calc(50% + ${windowY}px)`}
      style:left={`calc(50% + ${windowX}px)`}
      style:transform="translate(-50%, -50%)"
      role="dialog"
      aria-modal="true"
      tabindex="0"
    >
      <div
        class="cursor-move flex items-center mb-2 gap-2 select-none"
        style="user-select: none;"
        on:pointerdown={onPointerDown}
      >
        <h2 class="font-bold text-lg flex-1">Log Center</h2>
        <button 
          class="btn btn-xs btn-ghost" 
          on:click={copyLogs} 
          disabled={filteredLogs.length === 0} 
          title="Copy logs to clipboard"
          aria-label="Copy logs"
        >📋</button>
        <button class="btn btn-xs btn-ghost" aria-label="Close" on:click={close}>✕</button>
      </div>
      <div id="log-filters" class="mb-2 flex gap-2 items-center flex-wrap">
        <SelectField
          items={[
            { value: 'all', label: `All ${allLogs.length}` },
            { value: 'trace', label: `Trace ${logLevelCounts['trace'] || 0}` },
            { value: 'debug', label: `Debug ${logLevelCounts['debug'] || 0}` },
            { value: 'info', label: `Info ${logLevelCounts['info'] || 0}` },
            { value: 'warn', label: `Warn ${logLevelCounts['warn'] || 0}` },
            { value: 'error', label: `Error ${logLevelCounts['error'] || 0}` },
            { value: 'critical', label: `Critical ${logLevelCounts['critical'] || 0}` },
            { value: 'fatal', label: `Fatal ${logLevelCounts['fatal'] || 0}` }
          ]}
          value={filterLevel}
          placeholder="All Levels"
          className="min-w-[8rem]"
          ariaLabel="Filter by log level"
          on:change={(e) => {
            filterLevel = e.detail as LogLevel | 'all';
          }}
        />
        <input
          type="text"
          placeholder="Filter scope..."
          bind:value={filterScope}
          class="input input-bordered input-sm w-24"
        />
        <input
          type="text"
          placeholder="Search..."
          bind:value={search}
          class="input input-bordered input-sm flex-1"
        />
        <button class="btn btn-sm btn-error" on:click={handleClear} disabled={allLogs.length === 0}>Clear</button>
        <span class="text-xs opacity-60">{filteredLogs.length}/{allLogs.length}</span>
      </div>
      <div class="w-full h-96 overflow-auto bg-base-200 rounded border">
        {#if filteredLogs.length === 0}
          <div class="text-xs opacity-50 text-center pt-8">No logs to display.</div>
        {:else}
          <div class="font-mono text-xs">
            {#each filteredLogs as log (log.id)}
              <div class="flex gap-2 p-2 border-b border-base-300 hover:bg-base-300 transition-colors">
                <span class="text-xs opacity-60 whitespace-nowrap">{formatTime(log.ts)}</span>
                <span 
                  class="font-bold uppercase text-xs whitespace-nowrap"
                  class:text-purple-500={log.level === 'trace'}
                  class:text-blue-500={log.level === 'debug'}
                  class:text-green-500={log.level === 'info'}
                  class:text-yellow-500={log.level === 'warn'}
                  class:text-red-500={log.level === 'error'}
                  class:text-red-700={log.level === 'critical'}
                  class:text-red-900={log.level === 'fatal'}
                >
                  {log.level}
                </span>
                <span class="text-cyan-600 text-xs whitespace-nowrap">[{log.scope}]</span>
                <span class="flex-1 break-words">{log.message}</span>
                {#if log.details}
                  <button 
                    class="btn btn-xs btn-ghost opacity-50 hover:opacity-100"
                    title={formatDetails(log.details)}
                  >
                    📋
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
