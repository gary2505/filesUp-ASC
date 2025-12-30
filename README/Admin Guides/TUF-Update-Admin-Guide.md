# FilesUP-ASC Secure Update System (TUF) — Admin Guide

**Version:** 1.0  
**Date:** 2025‑12‑28  
**Audience:** Release / DevOps / Security Admins  
**Scope:** How to prepare, sign, publish, and operate application updates for FilesUP / EmptyBox using **The Update Framework (TUF)**, with strict naming rules and safe workflows.

---

## 1. Concepts & Goals

### 1.1 What is TUF?

TUF (**The Update Framework**) is a security standard and reference design for software update systems.  
It defines:

- **How to sign and validate update metadata and files**  
- **How to protect against**:
  - Malicious or compromised update servers
  - Downgrade (rollback) attacks to old vulnerable versions
  - “Freeze” attacks with stale metadata
- **How to rotate keys safely** (root, targets, snapshot, timestamp)

In this project, TUF is implemented via a production-grade client library on the **desktop app side**, and by a TUF-compatible repository on the **update server side**.

### 1.2 Why we use TUF

We use TUF because we want:

1. **Safe updates for 1,000,000+ users** (no silent malicious upgrades).
2. **Forward-only, signed versions**, with clear provenance.
3. **Roll-back protection** – the server cannot silently push an older vulnerable version.
4. **Simple client logic** – the “EmptyBox” host only needs to:
   - Ask “Is there an update?”
   - Download a verified ZIP bundle
   - Extract it into `versions/<version>/`
   - Switch current version according to internal rules

All cryptographic complexity, metadata freshness checks, and rollback protection come from TUF.

---

## 2. High-Level Architecture

### 2.1 Server side

The update infrastructure hosts a **TUF repository** with two main HTTP paths:

- **Metadata endpoint**
  - `https://updates.filesup.app/metadata/`
  - Contains: `root.json`, `timestamp.json`, `snapshot.json`, `targets.json`, and any delegation metadata.
- **Targets endpoint**
  - `https://updates.filesup.app/targets/`
  - Contains signed update bundles (ZIP files) as TUF “targets”.

**NOTE:** The repository itself is maintained using external TUF tools (e.g., `tuftool` or compatible tooling). This admin guide assumes those tools are available.

### 2.2 Client side (FilesUP / EmptyBox)

On each user machine, the app keeps:

- A **local TUF cache** in the app config directory:
  - `tuf/root.json` — trusted root keys (can be updated through TUF root rotation).
  - `tuf/metadata-cache/` — cached metadata (timestamp, snapshot, targets).
  - `tuf/targets-cache/` — downloaded bundles, e.g.  
    `filesup/desktop-windows-x86_64/app-0.2.3.zip`

- A **version filesystem layout**:
  - `versions/<version>/` — each version has its own directory.
  - `versions/version_state.json`:

    ```json
    {
      "current": "0.2.3",
      "previous": "0.2.2"
    }
    ```

- **Tauri commands** (Rust backend):
  - `tuf_check_for_updates(current_version, platform_id)`
  - `tuf_download_update(platform_id)`
  - `tuf_apply_update(bundle_path, new_version)`

- **ASC Flows (TaskFlow)** in the frontend:
  - `checkUpdatesFlow` calls the commands above, validates responses via contracts, and writes a **Debug Bundle** file:
    - `.ai/bundles/latest.bundle.md`  
    This file records a compact trace (events, contracts, summary) and is used by the AI agent for debugging.

---

## 3. Naming Rules

### 3.1 Version naming (SemVer)

All application versions **must** follow [Semantic Versioning](https://semver.org/) format:

```text
MAJOR.MINOR.PATCH
e.g. 0.2.3, 1.0.0, 1.1.4
```

**Rules:**

- **Monotonic per channel:** You never reuse a version number with different binaries.
- Once `0.2.3` is released, you never rebuild “a new 0.2.3”. If you need a fix:
  - Create `0.2.4`.
- For the same platform and channel, newer builds must have **strictly greater** versions.

### 3.2 Platform identifier naming

Platform identifiers are used in TUF target paths and must be **stable strings**:

Common examples:

- `desktop-windows-x86_64`
- `desktop-windows-arm64`
- `desktop-macos-x86_64`
- `desktop-macos-aarch64`
- `desktop-linux-x86_64`

**Rules:**

- Stick to the same platform IDs in:
  - TUF repository target paths.
  - Client code (`platformId` passed into Tauri commands).
- Never rename platforms in a breaking way without migrating both sides (server & client).

### 3.3 Target (bundle) file naming

Each platform-specific bundle must follow this naming convention inside the TUF **targets** tree:

```text
filesup/<platform_id>/app-<version>.zip
```

Examples:

```text
filesup/desktop-windows-x86_64/app-0.2.3.zip
filesup/desktop-macos-aarch64/app-0.2.3.zip
filesup/desktop-linux-x86_64/app-0.2.3.zip
```

**Rules:**

1. The file name always includes the full semantic version:
   - `app-0.2.3.zip`
2. The `<version>` portion must be **exactly the same** as the version encoded inside the app (e.g., the version value compiled into the binary).
3. The **content of a given target is immutable**:
   - Never overwrite `app-0.2.3.zip` with different bits.
   - If you need a change, publish `app-0.2.4.zip`.

### 3.4 Targets directory structure on server

On the server, the `targets` directory may look like this:

```text
/targets/
  filesup/desktop-windows-x86_64/app-0.2.2.zip
  filesup/desktop-windows-x86_64/app-0.2.3.zip
  filesup/desktop-macos-aarch64/app-0.2.2.zip
  filesup/desktop-macos-aarch64/app-0.2.3.zip
  ...
```

`targets.json` will reference these targets by their logical names, including hashes and lengths.

---

## 4. TUF Metadata Roles (Admin View)

TUF uses several metadata roles, each with its own purpose and keys:

1. **root.json**
   - The root of trust: defines which keys are allowed to sign each role.
   - Rotated rarely and carefully (root key rotation).
   - Stored locally by the client (trusted root).

2. **targets.json**
   - Lists all **targets** (bundles) and their metadata:
     - paths (e.g. `filesup/desktop-windows-x86_64/app-0.2.3.zip`)
     - hashes and lengths
   - Optionally delegated into sub-roles for subsets of targets.

3. **snapshot.json**
   - Contains versioned metadata of all other roles (e.g., `targets.json` version).
   - Protects against rollback of individual metadata files.

4. **timestamp.json**
   - Small JSON file with:
     - pointer to `snapshot.json`
     - expiry time
   - Allows clients to detect if metadata is out of date (“freeze” attack protection).

**Admin responsibility:** Use TUF tooling to **regenerate and sign** these files correctly whenever new targets (bundles) are added.

---

## 5. Server-Side Release Workflow (Admin Checklist)

This is the **standard procedure** when publishing a new version `X.Y.Z`.

### Step 1 — Choose a version

- Decide on `X.Y.Z` (must be higher than all current production versions for each platform).
- Check:
  - No existing release uses `X.Y.Z`.
  - Release notes and changelog are finalized.

### Step 2 — Build platform bundles

For each platform you support:

1. Build the FilesUP / EmptyBox application using your standard build pipeline.
2. Create a bundle directory, for example:

   ```text
   app-0.2.4/
     filesup.exe                 (Windows)
     resources/...
     config/...
   ```

3. Zip this directory into a file named:

   ```text
   app-0.2.4.zip
   ```

4. Place / upload it into the TUF `targets` tree under:

   ```text
   filesup/<platform_id>/app-0.2.4.zip
   ```

**Key points:**

- The ZIP must contain **all necessary runtime files** for that version.
- No secrets in the ZIP.
- Version inside the app must match the `<version>` in the filename.

### Step 3 — Register target in TUF

Using your TUF tooling (e.g., `tuftool`):

1. Add the new target(s) for each platform:
   - Example command (pseudo):

     ```bash
     tuftool add-target        --repo <path-to-tuf-repo>        --target-path filesup/desktop-windows-x86_64/app-0.2.4.zip        /local/path/to/app-0.2.4.zip
     ```

2. Regenerate `targets.json` to include the new targets.
3. Regenerate `snapshot.json` to include updated metadata versions.
4. Regenerate `timestamp.json` with a fresh expiration time.

### Step 4 — Sign metadata

- Use the appropriate TUF keys for:
  - `targets` role
  - `snapshot` role
  - `timestamp` role
- Confirm:
  - Signatures are valid.
  - Expiry times are appropriate (e.g., `timestamp.json` expires in 1–7 days).
- **Root keys** should remain offline and untouched unless performing an explicit root rotation.

### Step 5 — Upload to production server

Upload files in this order:

1. **Targets first**:
   - Upload `app-0.2.4.zip` files to `/targets/...`:
     - Ensure they are fully available before metadata references them.

2. **Metadata second**:
   - Upload new `targets.json`, `snapshot.json`, `timestamp.json` to `/metadata/`.

This prevents clients from seeing metadata pointing to non-existent targets.

### Step 6 — Staging / smoke test

Before rolling out broadly:

1. Use a staging build of the app that points to staging endpoints:
   - `https://staging-updates.filesup.app/metadata/`
   - `https://staging-updates.filesup.app/targets/`
2. Run the app and execute `checkUpdatesFlow`:
   - Confirm:
     - `updateAvailable === true`
     - `latestVersion === "X.Y.Z"`
3. Run `downloadUpdateFlow` and `applyUpdateFlow` (or their UI equivalents).
4. Restart staging app:
   - Verify:
     - App runs version `X.Y.Z`.
     - Boot contracts pass.
     - No critical errors.

After a successful staging test, repeat the process against production endpoints to confirm behavior.

---

## 6. Client-Side Workflow (Summary)

From the client perspective, using the Tauri commands + ASC flows:

1. **Check for updates**
   - Frontend calls `checkUpdatesFlow(currentVersion, platformId)`.
   - Backend runs `tuf_check_for_updates`, uses TUF to:
     - Load local `root.json`.
     - Fetch fresh `timestamp`, `snapshot`, `targets`.
     - Verify signatures, expiry, rollback constraints.
     - Determine the highest version `X.Y.Z` for `filesup/<platform_id>/app-X.Y.Z.zip`.

2. **Download update**
   - If `updateAvailable === true`, frontend calls `downloadUpdateFlow`.
   - Backend runs `tuf_download_update`, uses TUF to:
     - Download the target bundle into `tuf/targets-cache/...`.
     - Verify length and hashes.
     - Return `bundle_path` and `version`.

3. **Apply update**
   - Frontend calls `applyUpdateFlow(bundlePath, version)`.
   - Backend runs `tuf_apply_update`:
     - Extracts ZIP into `versions/X.Y.Z/` via a temporary dir.
     - Updates `version_state.json` (`current` / `previous`).
   - App or launcher can now restart using the new version.

4. **Health & rollback strategy**
   - Boot flows and contracts decide if the new version is healthy.
   - If a release is broken:
     - Admin publishes a new fixed version (e.g. `X.Y.Z+1`).
     - Clients naturally move forward; no manual server-side rollback is required.
   - Clients can also expose a “rollback to previous” option using `previous` from `version_state.json`.

---

## 7. Security Rules & Best Practices

### 7.1 Do

- ✅ Use **semver** and treat each version as immutable.
- ✅ Keep **root keys offline** (never on servers, never in app code).
- ✅ Regularly rotate and refresh `timestamp.json` to avoid stale metadata.
- ✅ Use **staging** for every release before production.
- ✅ Monitor logs and **ASC Debug Bundles** for update-related issues.

### 7.2 Don’t

- ❌ Don’t overwrite existing bundles (e.g., `app-0.2.3.zip`).
- ❌ Don’t manually edit TUF metadata JSON; always use tooling.
- ❌ Don’t push older metadata versions to production (rollback attacks).
- ❌ Don’t change platform IDs without updating both client and server.

---

## 8. Quick Reference Checklist

**Per release (version X.Y.Z):**

1. [ ] Choose new semantic version `X.Y.Z` (greater than all existing).
2. [ ] Build per-platform bundles and zip:
   - `filesup/<platform_id>/app-X.Y.Z.zip`
3. [ ] Add targets to TUF repo and regenerate metadata:
   - `targets.json`
   - `snapshot.json`
   - `timestamp.json`
4. [ ] Sign all required roles with correct keys.
5. [ ] Upload:
   - [ ] New bundles to `/targets/`
   - [ ] New metadata to `/metadata/`
6. [ ] Staging smoke test:
   - [ ] `updateAvailable === true`
   - [ ] `latestVersion === X.Y.Z`
   - [ ] Download + apply + restart OK
7. [ ] Production smoke test:
   - [ ] Repeat checks against production endpoints
8. [ ] Monitor logs & debug bundles after release.

---

This document is the **single source of truth** for admins handling FilesUP / EmptyBox updates with TUF.  
If you automate these steps in CI, keep this logic intact and ensure CI never exposes root keys or modifies existing versions in-place.
