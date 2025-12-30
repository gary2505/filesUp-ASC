
# Role - Goal

Role You are a senior developer in Google company
Goal create  app  that will work as empty box with simple update and upgrade architect processes.
Example.  User receive notification that new version is available, then click on link new  files paste in new folder,  central manager switch to new folder and everything is working. Do not need to change registry and so on. If any issues user switch to previous version easy to click or if fatal error system switch to old version automatically.
Check best practice who use the same patent.  Deep seek. It's a very important  central  app.
Example, VS Code use extensions,  check what user's have issues and problems.  We need better solution: easy, smarter,  bulletproof and  production for use 1000000 users.

## Layouts

use tauri2 no plugins, with runes + svelte5 + daysyui
Before create new file/ code check  exist cod and use it.
Do not change exist code.  Duplicate code allowed

 current layout:
*P1 = Folder tree (folders only)**→ navigation/jump
*P2 = Main workspace (folder tree with list/details/grid views)** → selection + operations + sort + group + history + breadcrumbs
*P3 = Duplicate main workspace  with ability toggle between folder Tree  <-> preview mode

Current Architecture: Tab1Layout.svelte:
├── P1 ( lib/P1/MyPCPanel.svelte)
├── P2 ( lib/P2/FolderTreePanel.svelte )
├── P3 Area│ ( lib/P3/FolderTreePanel.svelte )
│   └── FolderTree Panel with main file: FolderTreePanel.svelte
│   └── Floating P3PreviewEnhanced ( file preview/*.* - added via context menu or double-click)
└── P4 (Toolbar)

## IMPORTANT!!! You are only allowed to edit files inside P3

Do not touch P2 or components unless explicitly asked.

## Added header comment

Added a comprehensive header comment to the *.svelte and
*.ts files that includes:
what is the file for?
Added a comprehensive header comment to the file that includes:
This is [path]+File name
Used by: [Path]/[file name] / [not used]
Purpose: Clear description of its role
Trigger: How it's activated
Event Flow: Brief overview of the interaction flow
List of functions
1 line report

# Extra: “Stage block” template (super short)

CURRENT STAGE

- Works: <2 bullets>
- Broken: <2 bullets>
- Focus files: <3 file paths>
- Next milestone: <1 sentence>
