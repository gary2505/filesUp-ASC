<script lang="ts">
  import LogViewer from '$lib/core/logging/LogViewer.svelte';
  import { logViewerOpen } from '$lib/core/logging/logViewer.store';
</script>

<LogViewer bind:open={$logViewerOpen} />
