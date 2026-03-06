# Web UI Templates Index

## Pages
- `gui/src/pages/Connections/index.tsx` - Connection management (list, add, edit, delete, test)
- `gui/src/pages/Browse/index.tsx` - File browser with 3-level folder navigation (databases > buckets > files)

## Layout
- `gui/src/components/layout/AppShell.tsx` - Root layout: nav sidebar + header + main content
- `gui/src/components/layout/Sidebar.tsx` - App nav sidebar (Connections, Browse links)
- `gui/src/components/layout/Header.tsx` - Top header bar with dark mode toggle

## Navigation (Browse page)
- `gui/src/components/navigation/BrowseBreadcrumb.tsx` - Breadcrumb: Home > DB > Bucket (clickable segments)
- `gui/src/components/navigation/BackButton.tsx` - Back arrow button with Alt+Left / Backspace shortcut

## Folder Views (Browse page - databases & buckets levels)
- `gui/src/components/folders/FolderCard.tsx` - macOS Finder-style folder card (double-click to open, single-click to select)
- `gui/src/components/folders/DatabaseGrid.tsx` - Grid of database folder cards
- `gui/src/components/folders/BucketGrid.tsx` - Grid of bucket folder cards with sort support
- `gui/src/components/folders/FolderEmptyArea.tsx` - Wrapper for right-click on empty space
- `gui/src/components/folders/SkeletonFolderCard.tsx` - Loading skeleton for folder cards
- `gui/src/components/folders/StatusMessage.tsx` - Empty/error state display

## Context Menus (Browse page)
- `gui/src/components/folders/BucketContextMenu.tsx` - Right-click bucket: Open, Rename, Upload, Export, Properties, Delete
- `gui/src/components/folders/EmptyAreaContextMenu.tsx` - Right-click empty area: New Bucket, Refresh, Sort by, Paste
- `gui/src/components/folders/DatabaseContextMenu.tsx` - Right-click database: Open, Refresh

## File Views (Browse page - files level)
- `gui/src/components/files/FileTable.tsx` - Table view with sort, multi-select, bulk actions, inline rename
- `gui/src/components/files/FileGrid.tsx` - Grid view with image thumbnails
- `gui/src/components/files/FileDetail.tsx` - Right-side sheet with preview, metadata, actions
- `gui/src/components/files/FilterPanel.tsx` - Advanced filters (size, date, content type, metadata)
- `gui/src/components/files/SearchBar.tsx` - Filename search input
- `gui/src/components/files/UploadZone.tsx` - Drag-and-drop file upload area
- `gui/src/components/files/CopyMoveDialog.tsx` - Target bucket selector for copy/move

## Connections
- `gui/src/pages/Connections/ConnectionList.tsx` - Card grid of saved connections
- `gui/src/pages/Connections/ConnectionCard.tsx` - Individual connection card with status
- `gui/src/pages/Connections/ConnectionForm.tsx` - Add/edit connection dialog

## Hooks
- `gui/src/hooks/useBrowseNavigation.ts` - 3-level nav state (databases/buckets/files) synced to URL params
- `gui/src/hooks/useSortPreference.ts` - Folder sort preference persisted to localStorage
- `gui/src/hooks/useBuckets.ts` - Bucket CRUD (list, create, delete, rename, export, stats)
- `gui/src/hooks/useFiles.ts` - File operations (list, upload, delete, download, rename, copy, move, bulk)
- `gui/src/hooks/useDatabases.ts` - Fetch database list for a connection
- `gui/src/hooks/useConnections.ts` - Connection CRUD

## File Preview Components
- `gui/src/components/files/previews/DocumentPreview.tsx` - Office doc preview: fetches backend-converted PDF, renders in iframe; shows spinner during conversion, error fallback with download button
- `gui/src/components/files/previews/HTMLPreview.tsx` - HTML preview for CSV (paginated, reads X-Total-Pages header, prev/next controls) and Markdown (static); renders via sandboxed iframe using blob URL

## Content-Type Utilities (updated)
- `gui/src/common/utils/content-type.ts` - Added Office MIME types to map; added `isOfficeDocument(contentType)` and `isDocumentPreviewable(contentType, filename)` helpers
