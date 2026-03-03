# GridFS GUI - Folder-Style UI Redesign Plan

**Created**: 2026-03-03
**Goal**: Replace the bucket sidebar with a macOS Finder-style folder browsing experience. Databases and buckets are shown as folder cards in the main content area. Double-click navigates into folders. Right-click context menus for all actions. Breadcrumb + back button navigation.

---

## Architecture Overview

### Current Flow
```
BrowsePage
├── DB Dropdown (top)
├── BucketSidebar (left panel, 256px)
└── Main Content (FileTable / FileGrid)
```

### New Flow
```
BrowsePage
├── Breadcrumb + Back Button (top bar)
├── Main Content Area
│   ├── Level 0: Database Folders (grid of DB folder cards)
│   ├── Level 1: Bucket Folders (grid of bucket folder cards)
│   └── Level 2: Files (FileTable / FileGrid, existing)
└── Context Menus (right-click)
    ├── Empty area: New Bucket, Refresh, Sort by, Paste
    └── Folder: Open, Rename, Delete, Properties, Upload Here, Export All
```

### Navigation Hierarchy
```
Home (Databases) → double-click DB → Buckets → double-click Bucket → Files
```

---

## Phase 1: Backend - New Bucket Endpoints

**Assigned to**: senior-backend-engineer
**Date Started**: 2026-03-03
**Status**: [ ] Not Started | [ ] In Progress | [x] Completed

The current API is missing DELETE and RENAME bucket endpoints, and an "export all" endpoint.

- [x] Add `DELETE /api/v1/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}` - Drops both `{bucket_name}.files` and `{bucket_name}.chunks` collections. Returns 204 on success, 404 if bucket not found. Add confirmation safeguard (query param `?confirm=true` required).
- [x] Add `PUT /api/v1/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}` - Rename bucket. Body: `{ "new_name": "string" }`. Renames both `.files` and `.chunks` collections using MongoDB `renameCollection`. Returns updated `BucketInfo`. 409 if target name exists, 404 if source not found.
- [x] Add `POST /api/v1/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}/export` - Export all files from bucket as a ZIP. Streams a ZIP of all files in the bucket. Returns `application/zip` with `Content-Disposition: attachment`. 404 if bucket empty or not found.
- [x] Update `docs-claude/backend-routes.md` with the 3 new endpoints.
- [x] Add appropriate error handling and input validation for all new endpoints.

#### Phase 1 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | 3 new bucket endpoints: DELETE (with ?confirm=true safeguard), PUT rename (with renameCollection), POST export (ZIP archive). New BucketRename model. 3 new service methods with extracted helpers (_ensure_bucket_exists, _get_bucket_file_stats, _deduplicate_filename). |
| Were there any deviations from the plan? | No deviations. All endpoints implemented exactly as specified. |
| Issues/blockers encountered?             | None. |
| How were issues resolved?               | N/A |
| Any technical debt introduced?           | The export endpoint builds ZIP in-memory which may be problematic for very large buckets. Consider streaming ZIP in future if needed. |
| Recommendations for next phase?          | Phase 2 (Context Menu Component) and Phase 3 (Hooks) can proceed in parallel. useBuckets hook will need deleteBucket, renameBucket, exportBucket methods added in Phase 3. |

**Completed by**: senior-backend-engineer + code-simplifier
**Date Completed**: 2026-03-03

#### Notes for Future Phases

- **API changes**: 3 new endpoints (DELETE bucket, PUT rename bucket, POST export bucket)
- **Frontend hooks**: `useBuckets` hook will need `deleteBucket`, `renameBucket`, `exportBucket` methods added in Phase 3

---

## Phase 2: Frontend - Context Menu Component

**Assigned to**: frontend-engineer
**Date Started**: 2026-03-03
**Status**: [ ] Not Started | [ ] In Progress | [x] Completed

Build a reusable right-click context menu component before it's needed by the folder views.

- [x] Create `gui/src/components/ui/context-menu.tsx` - Wrapper around Radix UI `@radix-ui/react-context-menu` (install if not already present). Follow the existing shadcn/ui pattern used by `dropdown-menu.tsx`. Exports: `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent`, `ContextMenuLabel`.
- [x] Verify Radix UI context-menu dependency is installed (`pnpm add @radix-ui/react-context-menu` in gui/).
- [x] Test the component renders correctly in both light and dark modes.

#### Phase 2 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Full shadcn/ui-style ContextMenu component wrapping `@radix-ui/react-context-menu`. Exports 15 components: ContextMenu, ContextMenuPortal, ContextMenuTrigger, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent. |
| Were there any deviations from the plan? | Added extra exports beyond the plan (ContextMenuPortal, ContextMenuGroup, ContextMenuCheckboxItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuShortcut) for completeness and parity with dropdown-menu.tsx. |
| Issues/blockers encountered?             | None. |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | None. Component is a 1:1 pattern match with dropdown-menu.tsx. |
| Recommendations for next phase?          | Phase 3 (Hooks) and Phase 4 (Folder Cards) can proceed in parallel. The ContextMenu component is ready for use in Phase 5 (Context Menu Integration). |

**Completed by**: frontend-engineer + code-simplifier
**Date Completed**: 2026-03-03

#### Notes for Future Phases

- **New dependencies**: `@radix-ui/react-context-menu`
- **New component**: `gui/src/components/ui/context-menu.tsx` - used by Phase 4 and 5

---

## Phase 3: Frontend - Hooks & State Management Updates

**Assigned to**: frontend-engineer
**Date Started**: 2026-03-03
**Status**: [ ] Not Started | [ ] In Progress | [x] Completed

Update hooks and state to support the new navigation model and new backend endpoints.

- [x] Update `gui/src/hooks/useBuckets.ts` - Add `deleteBucket(bucketName)`, `renameBucket(bucketName, newName)`, `exportBucket(bucketName)` methods that call the new Phase 1 endpoints.
- [x] Create `gui/src/hooks/useBrowseNavigation.ts` - New hook to manage the 3-level navigation state:
  - `currentLevel`: `'databases' | 'buckets' | 'files'`
  - `selectedDatabase`: `string | null`
  - `selectedBucket`: `string | null`
  - `navigateTo(level, value?)`: Navigate to a specific level
  - `goBack()`: Go up one level
  - `breadcrumbs`: Computed array of `{ label, level, value }` for the breadcrumb component
  - Sync with URL query params so navigation is bookmarkable/shareable
- [x] Create `gui/src/hooks/useSortPreference.ts` - Hook for persisting folder sort preference (by name, size, date) in localStorage. Used by the context menu "Sort by" option.

#### Phase 3 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | 3 new methods in useBuckets (deleteBucket, renameBucket, exportBucket). New useBrowseNavigation hook with 3-level nav state synced to URL params (?db=&bucket=). New useSortPreference hook with localStorage persistence via useLocalStorage. |
| Were there any deviations from the plan? | No deviations. All endpoints and hook interfaces match the plan exactly. |
| Issues/blockers encountered?             | None. |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | None. Code-simplifier optimized callback dependencies in useSortPreference and fixed Biome lint (dot notation in useBrowseNavigation). |
| Recommendations for next phase?          | Phase 5 can use useBrowseNavigation for navigation and useSortPreference for the Sort By context menu. BucketGrid already accepts sortField/sortDirection props with proper typed unions. |

**Completed by**: frontend-engineer + code-simplifier
**Date Completed**: 2026-03-03

#### Notes for Future Phases

- **New hooks**: `useBrowseNavigation`, `useSortPreference`
- **Updated hooks**: `useBuckets` (3 new methods)
- **URL params**: Navigation state synced to URL for deep linking

---

## Phase 4: Frontend - Folder Card & Database/Bucket Grid Views

**Assigned to**: frontend-engineer
**Date Started**: 2026-03-03
**Status**: [ ] Not Started | [ ] In Progress | [x] Completed

Build the macOS Finder-style folder card component and the grid views for databases and buckets.

- [x] Create `gui/src/components/folders/FolderCard.tsx` - Reusable folder card component:
  - macOS Finder style: rounded corners, subtle shadow, hover elevation
  - Props: `name`, `subtitle` (e.g., "12 files"), `secondarySubtitle` (e.g., "2.3 MB"), `icon` (Lucide icon), `onDoubleClick`, `onContextMenu`, `selected` (boolean)
  - Double-click opens/navigates into the folder
  - Single-click selects (highlight border)
  - Smooth hover animation (CSS transition, no Framer Motion)
  - Responsive grid: 2 cols mobile, 3 cols sm, 4 cols md, 5 cols lg, 6 cols xl
  - Dark mode support using existing CSS variables
- [x] Create `gui/src/components/folders/DatabaseGrid.tsx` - Grid of database folder cards:
  - Uses `useDatabases(connId)` hook to fetch database list
  - Renders `FolderCard` for each database with `Database` icon from Lucide
  - Double-click sets `selectedDatabase` via `useBrowseNavigation`
  - Right-click on empty area: context menu with "Refresh"
  - Loading state: skeleton folder cards
  - Empty state: "No databases found" message
- [x] Create `gui/src/components/folders/BucketGrid.tsx` - Grid of bucket folder cards:
  - Uses `useBuckets(connId, dbName)` hook to fetch buckets
  - Renders `FolderCard` for each bucket with `Folder` icon, showing file count and total size
  - Double-click sets `selectedBucket` via `useBrowseNavigation`
  - Supports sorting via `useSortPreference` (name, file count, total size)
  - Loading/empty states
- [x] Create `gui/src/components/folders/FolderEmptyArea.tsx` - Wrapper component that handles right-click on empty space (not on a folder card). Prevents event propagation from card context menus.

#### Phase 4 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | 4 folder components: FolderCard (macOS Finder-style button with rounded-xl, shadow-sm, hover:shadow-md, ring-2 selection), DatabaseGrid (Database icons, 8-skeleton loading), BucketGrid (FolderOpen icons with file count/size, client-side sorting with useMemo), FolderEmptyArea (thin wrapper with onContextMenu passthrough). |
| Were there any deviations from the plan? | Used CSS transitions instead of Framer Motion (as planned). Code-simplifier extracted 2 shared components: SkeletonFolderCard and StatusMessage to deduplicate grid loading/error/empty states. |
| Issues/blockers encountered?             | None. |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | None. Code-simplifier cleaned up all duplication and tightened prop types from generic strings to union types (SortField, SortDirection). |
| Recommendations for next phase?          | Phase 5 context menus can wrap FolderCard and FolderEmptyArea. BucketGrid already accepts typed sortField/sortDirection props from useSortPreference. |

**Completed by**: frontend-engineer + code-simplifier
**Date Completed**: 2026-03-03

#### Notes for Future Phases

- **New components**: `FolderCard`, `DatabaseGrid`, `BucketGrid`, `FolderEmptyArea`, `SkeletonFolderCard`, `StatusMessage`
- **Component directory**: `gui/src/components/folders/`
- **Shared constants**: `GRID_CLASSES` extracted for responsive grid layout reuse

---

## Phase 5: Frontend - Context Menus Integration

**Assigned to**: frontend-engineer
**Date Started**: 2026-03-03
**Status**: [ ] Not Started | [ ] In Progress | [x] Completed

Wire up right-click context menus for empty areas and folder cards.

- [x] Create `gui/src/components/folders/BucketContextMenu.tsx` - Context menu shown on right-click of a bucket folder:
  - **Open** - Navigate into the bucket (same as double-click)
  - **Rename** - Opens inline rename input or a small dialog
  - **Upload Files Here** - Opens file picker / triggers upload zone for that bucket
  - **Export All** - Calls `exportBucket()` from `useBuckets`, downloads ZIP
  - **Properties** - Opens a small dialog/popover showing: bucket name, file count, total size, avg file size (uses `/stats` endpoint)
  - Separator
  - **Delete** - Confirmation dialog ("This will delete all files in the bucket"), calls `deleteBucket()`
- [x] Create `gui/src/components/folders/EmptyAreaContextMenu.tsx` - Context menu shown when right-clicking on empty space in the bucket grid:
  - **New Bucket** - Opens the existing `CreateBucketDialog`
  - **Refresh** - Re-fetches the bucket list
  - Separator
  - **Sort by** - Submenu with: Name, File Count, Total Size (checkmark on active)
  - **Paste** - Disabled for now (future: paste files from clipboard if supported)
- [x] Create `gui/src/components/folders/DatabaseContextMenu.tsx` - Minimal context menu for database folders:
  - **Open** - Navigate into database
  - **Refresh** - Re-fetch database list
- [x] Wire context menus into `BucketGrid` and `DatabaseGrid` components from Phase 4.

#### Phase 5 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | 3 context menu components: BucketContextMenu (Open, Rename dialog, Upload, Export ZIP, Properties stats dialog, Delete with confirmation), EmptyAreaContextMenu (New Bucket dialog, Refresh, Sort by radio submenu, Paste disabled), DatabaseContextMenu (Open, Refresh). All wired into BucketGrid and DatabaseGrid. EmptyAreaContextMenu wraps all render states (error, loading, empty, populated) so right-click always works. |
| Were there any deviations from the plan? | No deviations. All menu items implemented exactly as specified. |
| Issues/blockers encountered?             | None. |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | Paste menu item is disabled placeholder. EmptyAreaContextMenu props were duplicated across 4 render branches but code-simplifier extracted them into a shared `emptyAreaProps` object. |
| Recommendations for next phase?          | Phase 6 should wire `onUploadToBucket` prop through BrowsePage to trigger the existing upload zone for a specific bucket. The `onSortFieldChange` and `sortField` props should be connected to `useSortPreference` hook in BrowsePage. |

**Completed by**: frontend-engineer + code-simplifier
**Date Completed**: 2026-03-03

#### Notes for Future Phases

- **Paste feature**: Left as disabled placeholder for future implementation
- **Context menu components**: 3 new context menu wrappers in `gui/src/components/folders/`

---

## Phase 6: Frontend - Breadcrumb, Back Button & Browse Page Refactor

**Assigned to**: frontend-engineer
**Date Started**: 2026-03-03
**Status**: [ ] Not Started | [ ] In Progress | [x] Completed

Refactor the main BrowsePage to use the new folder navigation instead of the sidebar, and add breadcrumb + back button.

- [x] Create `gui/src/components/navigation/BrowseBreadcrumb.tsx` - Breadcrumb component:
  - Shows: `Home` > `{database}` > `{bucket}`
  - Each segment is clickable to navigate to that level
  - Current level is styled differently (not a link, bold/muted)
  - Uses `useBrowseNavigation` hook for data and navigation
  - Responsive: truncate middle segments on mobile if needed
- [x] Create `gui/src/components/navigation/BackButton.tsx` - Back button:
  - Arrow-left icon button
  - Calls `goBack()` from `useBrowseNavigation`
  - Hidden at root level (databases)
  - Keyboard shortcut: `Alt+Left` or `Backspace` (when no input focused)
- [x] Refactor `gui/src/pages/Browse/index.tsx`:
  - **Remove**: `BucketSidebar` import and rendering
  - **Remove**: Database dropdown from top bar
  - **Remove**: Inline bucket selection state management (replaced by `useBrowseNavigation`)
  - **Add**: `BackButton` + `BrowseBreadcrumb` in the top toolbar area
  - **Add**: Conditional rendering based on `currentLevel`:
    - `'databases'` → render `<DatabaseGrid />`
    - `'buckets'` → render `<BucketGrid />`
    - `'files'` → render existing `<FileTable />` or `<FileGrid />` (unchanged)
  - **Keep**: Search bar, filters, view toggle, upload zone - but only visible at `files` level
  - **Keep**: `FileDetail` sheet - unchanged
  - Main content area now takes full width (no sidebar offset)
- [x] Update `gui/src/components/layout/AppShell.tsx` if needed - No changes needed. The nav sidebar (Connections, Browse) is in AppShell. The bucket sidebar was rendered inside BrowsePage, so removing it from BrowsePage doesn't affect AppShell. Main content already uses flex-1 for full width.
- [x] Update `docs-claude/webui-templates-index.md` with the new component structure.

#### Phase 6 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | BrowseBreadcrumb (clickable Home > DB > Bucket with CrumbLabel helper), BackButton (with Alt+Left/Backspace keyboard shortcuts, hidden at root), full BrowsePage refactor removing BucketSidebar + DB dropdown and replacing with 3-level conditional rendering (DatabaseGrid/BucketGrid/FileTable\|FileGrid) driven by useBrowseNavigation. Created webui-templates-index.md. |
| Were there any deviations from the plan? | Dropped `currentLevel` prop from BrowseBreadcrumb since `isLast` check on breadcrumbs array was sufficient. AppShell.tsx required no changes since bucket sidebar was inside BrowsePage, not AppShell. |
| Issues/blockers encountered?             | Minor TS error for unused `currentLevel` destructure in BrowseBreadcrumb, caught and fixed before code-simplifier. |
| How were issues resolved?                | Removed unused prop from interface and destructure. |
| Any technical debt introduced?           | None. Code-simplifier fixed handleSort anti-pattern (side effect in state updater), removed unnecessary useMemo, and standardized class name handling with cn(). |
| Recommendations for next phase?          | Phase 7 can safely delete BucketSidebar.tsx and the buckets/ directory. Verify sidebar CSS variables are still used by the nav sidebar before removing them. |

**Completed by**: frontend-engineer + code-simplifier
**Date Completed**: 2026-03-03

#### Notes for Future Phases

- **Removed components**: `BucketSidebar` can be deleted after verification
- **Removed**: Database dropdown from Browse page top bar
- **Layout change**: Main content is now full-width within AppShell

---

## Phase 7: Cleanup & Polish

**Assigned to**: frontend-engineer
**Date Started**:
**Status**: [ ] Not Started | [ ] In Progress | [ ] Completed

Final cleanup, remove dead code, and polish the experience.

- [ ] Delete `gui/src/components/buckets/BucketSidebar.tsx` (no longer used).
- [ ] Remove any unused CSS variables related to the old bucket sidebar (`--sidebar-*` vars if no longer used anywhere).
- [ ] Verify dark mode works correctly across all new components (folder cards, context menus, breadcrumb).
- [ ] Verify mobile responsiveness: folder grid collapses properly, context menus are touch-friendly, breadcrumb truncates.
- [ ] Test full navigation flow: Connection → Browse → DB folder → Bucket folder → Files → Back/Breadcrumb navigation.
- [ ] Verify keyboard navigation: Tab through folder cards, Enter to open, Backspace to go back, Delete on selected folder shows delete confirmation.
- [ ] Run existing tests, fix any broken imports/references.
- [ ] Smoke test all bucket operations: create, rename, delete, export, open, properties.

#### Phase 7 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    |          |
| Were there any deviations from the plan? |          |
| Issues/blockers encountered?             |          |
| How were issues resolved?                |          |
| Any technical debt introduced?           |          |
| Recommendations for next phase?          |          |

**Completed by**:
**Date Completed**:

---

## Dependency Graph

```
Phase 1 (Backend) ──────────────────────────┐
                                            ├──→ Phase 3 (Hooks)
Phase 2 (Context Menu Component) ───────────┤
                                            ├──→ Phase 4 (Folder Cards & Grids)
                                            │         │
                                            │         ▼
                                            ├──→ Phase 5 (Context Menu Integration)
                                            │         │
                                            │         ▼
                                            └──→ Phase 6 (Browse Page Refactor)
                                                      │
                                                      ▼
                                                Phase 7 (Cleanup & Polish)
```

**Parallelizable**: Phase 1 + Phase 2 can run in parallel. Phase 3 + Phase 4 can run in parallel (Phase 4 only depends on Phase 2, Phase 3 depends on Phase 1).

---

## Files Affected Summary

### New Files
| File | Phase |
|------|-------|
| `gui/src/components/ui/context-menu.tsx` | 2 |
| `gui/src/hooks/useBrowseNavigation.ts` | 3 |
| `gui/src/hooks/useSortPreference.ts` | 3 |
| `gui/src/components/folders/FolderCard.tsx` | 4 |
| `gui/src/components/folders/DatabaseGrid.tsx` | 4 |
| `gui/src/components/folders/BucketGrid.tsx` | 4 |
| `gui/src/components/folders/FolderEmptyArea.tsx` | 4 |
| `gui/src/components/folders/BucketContextMenu.tsx` | 5 |
| `gui/src/components/folders/EmptyAreaContextMenu.tsx` | 5 |
| `gui/src/components/folders/DatabaseContextMenu.tsx` | 5 |
| `gui/src/components/navigation/BrowseBreadcrumb.tsx` | 6 |
| `gui/src/components/navigation/BackButton.tsx` | 6 |

### Modified Files
| File | Phase |
|------|-------|
| Backend bucket router (new endpoints) | 1 |
| `docs-claude/backend-routes.md` | 1 |
| `gui/src/hooks/useBuckets.ts` | 3 |
| `gui/src/pages/Browse/index.tsx` | 6 |
| `gui/src/components/layout/AppShell.tsx` | 6 |
| `docs-claude/webui-templates-index.md` | 6 |

### Deleted Files
| File | Phase |
|------|-------|
| `gui/src/components/buckets/BucketSidebar.tsx` | 7 |
