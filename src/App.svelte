c<script lang="ts">
  import { onMount } from 'svelte';
  import { runBootFlow } from './taskFlow/flows/bootFlow';
  import DebugBundleViewer from './components/DebugBundleViewer.svelte';
  import FolderBrowser from './components/FolderBrowser.svelte';

  let message = $state('Initializing ASC...');
  let traceLog = $state<string[]>([]);

  onMount(() => {
    runBootFlow('0.0.1')
      .then(() => {
        message = 'filesUP-ASC Ready ✨';
        traceLog.push('[APP] Boot flow completed successfully');
      })
      .catch((err) => {
        message = `Error: ${err.message}`;
        traceLog.push(`[APP:ERROR] ${err}`);
      });
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-primary to-secondary p-8">
  <div class="max-w-6xl mx-auto">
    <div class="grid grid-cols-4 gap-4">
      <!-- Main Status Card -->
      <div class="col-span-2">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h1 class="card-title text-3xl">filesUP-ASC</h1>
            <p class="text-lg font-mono">{message}</p>
            
            <div class="divider"></div>
            
            <h2 class="text-lg font-bold">Trace Log</h2>
            <div class="mockup-code bg-base-200 p-4 text-sm overflow-auto max-h-48">
              {#each traceLog as log}
                <pre>{log}</pre>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- Folder Browser -->
      <div class="col-span-1">
        <FolderBrowser />
      </div>

      <!-- Debug Viewer Sidebar -->
      <div class="col-span-1">
        <DebugBundleViewer />
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    @apply m-0 p-0;
  }
</style>
