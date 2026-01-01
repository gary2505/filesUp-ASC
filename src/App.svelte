<script lang="ts">
  import { onMount } from 'svelte';
  import { runBootFlow } from './qaTaskFlow/flows/bootFlow';

  let message = $state('Initializing ASC...');
  let traceLog = $state<string[]>([]);
  
  // Panel widths (as percentages)
  let p0Width = $state(15);
  let p1Width = $state(20);
  let p2Width = $state(30);
  let p3Width = $state(20);
  let p4Width = $state(15);
  
  let isResizing = $state(false);
  let resizingPanel = $state<number | null>(null);
  let startX = $state(0);
  let startWidths = $state<number[]>([]);

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

  function startResize(panelIndex: number, e: MouseEvent) {
    isResizing = true;
    resizingPanel = panelIndex;
    startX = e.clientX;
    startWidths = [p0Width, p1Width, p2Width, p3Width, p4Width];
  }

  function stopResize() {
    isResizing = false;
    resizingPanel = null;
  }

  function handleResize(e: MouseEvent) {
    if (!isResizing || resizingPanel === null) return;
    
    const container = document.querySelector('.main-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const deltaX = e.clientX - startX;
    const deltaPercent = (deltaX / rect.width) * 100;
    
    // Resize logic: adjust current panel and next panel
    const minWidth = 10;
    const maxWidth = 50;
    
    if (resizingPanel === 0) {
      const newP0 = Math.max(minWidth, Math.min(maxWidth, startWidths[0] + deltaPercent));
      const newP1 = Math.max(minWidth, startWidths[1] - (newP0 - startWidths[0]));
      p0Width = newP0;
      p1Width = newP1;
    } else if (resizingPanel === 1) {
      const newP1 = Math.max(minWidth, Math.min(maxWidth, startWidths[1] + deltaPercent));
      const newP2 = Math.max(minWidth, startWidths[2] - (newP1 - startWidths[1]));
      p1Width = newP1;
      p2Width = newP2;
    } else if (resizingPanel === 2) {
      const newP2 = Math.max(minWidth, Math.min(maxWidth, startWidths[2] + deltaPercent));
      const newP3 = Math.max(minWidth, startWidths[3] - (newP2 - startWidths[2]));
      p2Width = newP2;
      p3Width = newP3;
    } else if (resizingPanel === 3) {
      const newP3 = Math.max(minWidth, Math.min(maxWidth, startWidths[3] + deltaPercent));
      const newP4 = Math.max(minWidth, startWidths[4] - (newP3 - startWidths[3]));
      p3Width = newP3;
      p4Width = newP4;
    }
  }
</script>

<svelte:window onmouseup={stopResize} onmousemove={handleResize} />

<div class="flex flex-col h-full bg-base-300">
  <!-- Tab Bar Container -->
  <div id="tabBarContainer" class="navbar bg-base-100 shadow-lg min-h-12">
    <div class="flex-1">
      <div class="tabs tabs-boxed">
        <a href="#home" class="tab tab-active">Home</a>
        <a href="#projects" class="tab">Projects</a>
        <a href="#settings" class="tab">Settings</a>
      </div>
    </div>
    <div class="flex-none">
      <button class="btn btn-ghost btn-sm" aria-label="Menu">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5 stroke-current">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>
    </div>
  </div>

  <!-- Bookmark Menu Container -->
  <div id="bookmarkMenuContainer" class="bg-base-200 px-4 py-2 shadow">
    <ul class="menu menu-horizontal bg-base-200 rounded-box">
      <li><a href="#file" class="btn btn-sm btn-ghost">File</a></li>
      <li><a href="#edit" class="btn btn-sm btn-ghost">Edit</a></li>
      <li><a href="#view" class="btn btn-sm btn-ghost">View</a></li>
      <li class="flex-1"></li>
      <li><a href="#bookmarks" class="btn btn-sm btn-ghost">⭐ Bookmarks</a></li>
    </ul>
  </div>

  <!-- Main Container with Panels -->
  <div id="mainContainer" class="flex-1 min-h-0 flex overflow-hidden main-container">
    <!-- P0 Container - Sidebar -->
    <div id="P0Container" class="bg-base-100 border-r border-base-300 overflow-auto" style="width: {p0Width}%">
      <div class="p-4">
        <h3 class="font-bold text-lg mb-4">P0</h3>
        <div class="text-sm">Cont</div>
      </div>
    </div>
    
    <!-- Resizer 0 -->
    <button 
      aria-label="Resize panel 0"
      class="w-1 bg-base-300 hover:bg-primary cursor-col-resize border-0 p-0"
      onmousedown={(e) => startResize(0, e)}
    ></button>

    <!-- P1 Container -->
    <div id="P1Container" class="bg-base-100 border-r border-base-300 overflow-auto" style="width: {p1Width}%">
      <div class="p-4">
        <h3 class="font-bold text-lg mb-4">Panel 1</h3>
        <div class="card bg-base-200 shadow-md">
          <div class="card-body">
            <h4 class="card-title text-sm">Status</h4>
            <p class="text-xs">{message}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Resizer 1 -->
    <button 
      aria-label="Resize panel 1"
      class="w-1 bg-base-300 hover:bg-primary cursor-col-resize border-0 p-0"
      onmousedown={(e) => startResize(1, e)}
    ></button>

    <!-- P2 Container - Main -->
    <div id="P2Container" class="bg-base-100 border-r border-base-300 overflow-auto" style="width: {p2Width}%">
      <div class="p-4">
        <h3 class="font-bold text-lg mb-4">P2</h3>
  
      </div>
    </div>

    <!-- Resizer 2 -->
    <button 
      aria-label="Resize panel 2"
      class="w-1 bg-base-300 hover:bg-primary cursor-col-resize border-0 p-0"
      onmousedown={(e) => startResize(2, e)}
    ></button>

    <!-- P3 Container -->
    <div id="P3Container" class="bg-base-100 border-r border-base-300 overflow-auto" style="width: {p3Width}%">
      <div class="p-4">
        <h3 class="font-bold text-lg mb-4">P3</h3>
        <div class="prose prose-sm">
          <p>Folders/Preview</p>
        </div>
      </div>
    </div>

    <!-- Resizer 3 -->
    <button 
      aria-label="Resize panel 3"
      class="w-1 bg-base-300 hover:bg-primary cursor-col-resize border-0 p-0"
      onmousedown={(e) => startResize(3, e)}
    ></button>

    <!-- P4 Container -->
    <div id="P4Container" class="bg-base-100 overflow-auto" style="width: {p4Width}%">
      <div class="p-4">
        <h3 class="font-bold text-lg mb-4">P4</h3>
        <div class="text-sm">Tool</div>
      </div>
    </div>
  </div>

  <!-- Status Bar Container -->
  <div id="statusBarContainer" class="h-8 min-h-8 shrink-0 bg-base-100 border-t-2 border-base-300 px-4 flex items-center justify-between text-xs leading-8">
    <div class="flex gap-4 items-center">
      <span class="badge badge-primary badge-sm">Ready</span>
      <span>v0.0.1</span>
    </div>
    <div class="flex gap-4 items-center">
      <span>Ln 1, Col 1</span>
      <span>UTF-8</span>
      <span class="badge badge-ghost badge-sm">Tauri</span>
    </div>
  </div>
</div>

<style>
  :global(html, body, #app) {
    height: 100%;
    margin: 0;
  }

  :global(body) {
    padding: 0;
    overflow: hidden;
  }
  
  .cursor-col-resize {
    cursor: col-resize;
  }
</style>
