<script lang="ts">
  import { openFolderFlow } from '../taskFlow/flows/openFolderFlow';
  import type { FileEntry, OpenFolderOutput } from '../taskFlow/tasks/openFolderTask';

  let folderPath = $state('C:\\');
  let output: OpenFolderOutput | null = $state(null);
  let loading = $state(false);
  let error = $state('');

  async function handleOpenFolder() {
    loading = true;
    error = '';
    output = null;

    try {
      output = await openFolderFlow(folderPath);
    } catch (err: any) {
      error = err?.message || String(err);
    } finally {
      loading = false;
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(timestamp: string): string {
    try {
      const ms = parseInt(timestamp) * 1000;
      return new Date(ms).toLocaleString();
    } catch {
      return timestamp;
    }
  }
</script>

<div class="card bg-base-100 shadow-md p-4">
  <div class="card-title text-sm mb-3">📁 Open Folder</div>

  <div class="space-y-3">
    <!-- Folder Input -->
    <div class="form-control">
      <input
        type="text"
        placeholder="Enter folder path..."
        bind:value={folderPath}
        class="input input-bordered input-sm w-full"
        disabled={loading}
      />
    </div>

    <!-- Open Button -->
    <button
      onclick={handleOpenFolder}
      disabled={loading || !folderPath}
      class="btn btn-primary btn-sm w-full"
    >
      {#if loading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        📂 Open Folder
      {/if}
    </button>

    <!-- Error Display -->
    {#if error}
      <div class="alert alert-error text-sm">
        <span>{error}</span>
      </div>
    {/if}

    <!-- Results Table -->
    {#if output}
      <div>
        <div class="text-xs font-bold text-secondary mb-2">
          {output.count} items in {output.path}
        </div>
        <div class="overflow-x-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {#each output.entries as entry (entry.name)}
                <tr class="hover">
                  <td class="font-mono text-xs">
                    {entry.is_dir ? '📁' : '📄'}
                    {entry.name}
                  </td>
                  <td class="text-xs">{entry.is_dir ? 'Folder' : 'File'}</td>
                  <td class="text-xs">{entry.is_dir ? '-' : formatSize(entry.size)}</td>
                  <td class="text-xs">{formatDate(entry.modified)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</div>
