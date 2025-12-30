# FilesUP-ASC Secure Updates (TUF-TheUpdateFramework) — Admin Guide

This document explains **how the update system works** and gives a **step-by-step workflow for admins** who prepare and publish new versions.

The system is built around:

- **TUF (The Update Framework)** for secure, signed metadata.
- **Versioned bundles** (`app-<version>.zip`) stored as TUF targets.
- **Side-by-side installs** in `versions/<version>/` on the client.
- **ASC flows** that call Tauri commands (`tuf_check_for_updates`, `tuf_download_update`, `tuf_apply_update`).

---

## 1. High-level Architecture

### 1.1 Components

**On the server (Update Infrastructure):**

- **TUF repository**:
  - Metadata: `root.json`, `timestamp.json`, `snapshot.json`, `targets.json`, etc.
  - Targets: signed update bundles, e.g.:
    - `filesup/desktop-windows-x86_64/app-0.2.3.zip`
    - `filesup/desktop-macos-aarch64/app-0.2.3.zip`
- Hosted via static HTTP:
  - `https://updates.filesup.app/metadata/`  → TUF metadata
  - `https://updates.filesup.app/targets/`   → bundles (ZIPs)

**On the client (FilesUP-ASC app):**

- **TUF client** (Rust + `tough`):
  - Downloads and verifies metadata (signatures, expiry, rollback protection).
  - Resolves the latest target bundle for a given platform.
  - Downloads and verifies the bundle (length + hashes).

- **Version filesystem layout**:
  - Config dir (per user) contains:
    - `versions/<version>/` — each version in its own folder.
    - `version_state.json`:

      ```json
      {
        "current": "0.2.3",
        "previous": "0.2.2"
      }
      ```

- **Tauri commands**:
  - `tuf_check_for_updates(current_version, platform_id)`
  - `tuf_download_update(platform_id)`
  - `tuf_apply_update(bundle_path, new_version)`

- **ASC flows** (frontend TaskFlow):
  - `checkUpdatesFlow` → calls Tauri commands, runs contracts, writes `.ai/bundles/latest.bundle.md` for debug.

---

## 2. How the client update flow works

From the app’s point of view, the sequence is:

1. **Check for updates**
   - ASC calls `checkUpdatesFlow(currentVersion, platformId)`.
   - Tauri calls `tuf_check_for_updates`.
   - TUF client:
     - Loads `root.json` from local config.
     - Fetches fresh `timestamp`, `snapshot`, `targets` from the server.
     - Verifies signatures, metadata expiry, rollback constraints.
     - Scans `targets` for the highest semantic version target matching `filesup/<platformId>/app-<version>.zip`.
   - Returns:

     ```json
     {
       "current_version": "0.2.2",
       "latest_version": "0.2.3",
       "update_available": true
     }
     ```

2. **Download update bundle**
   - ASC calls `downloadUpdateTask(platformId)` → `tuf_download_update`.
   - TUF client downloads the signed ZIP to `targets-cache/…`.
   - Length and hashes are verified against TUF metadata.
   - Returns:

     ```json
     {
       "version": "0.2.3",
       "bundle_path": "/.../tuf/targets-cache/filesup/desktop-windows-x86_64/app-0.2.3.zip"
     }
     ```

3. **Apply staged update**
   - ASC calls `applyUpdateTask(bundlePath, newVersion)` → `tuf_apply_update`.
   - Tauri:
     1. Extracts ZIP into a **temp dir**, e.g. `versions/.0.2.3_tmp/`.
     2. Moves temp dir → `versions/0.2.3/` (rename; best-effort atomic).
     3. Updates `version_state.json`:

        ```json
        {
          "current": "0.2.3",
          "previous": "0.2.2"
        }
        ```

4. **Switching / restart**
   - The app now knows a newer version is installed in `versions/0.2.3/`.
   - A launcher or the user can restart and run the new version.
   - Boot/health contracts decide if the new version is “good enough”. If it fails:
     - App can offer a rollback using `previous` from `version_state.json`.
     - Admin may choose to publish a new, fixed version.

All key steps are logged in the ASC **Debug Bundle**:

- `UPD_FLOW_START`
- `UPD_FLOW_RESULT`
- `UPD_FLOW_DONE`

This makes update bugs debuggable by the AI agent without manual log copy-paste.

---

## 3. Server-side layout & naming convention

### 3.1 TUF metadata

On your update server (production):

```text
/metadata/
  root.json
  timestamp.json
  snapshot.json
  targets.json
  (optionally: delegations metadata)

/targets/
  filesup/desktop-windows-x86_64/app-0.2.3.zip
  filesup/desktop-windows-x86_64/app-0.2.4.zip
  filesup/desktop-macos-aarch64/app-0.2.3.zip
  ...
