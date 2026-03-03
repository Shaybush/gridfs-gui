# GridFS GUI — Implementation Plan

> Full MVP (v1.0) phased plan based on `product-docs/GRIDFS_GUI_PROJECT_PLAN.md`

**Created**: 2026-03-02
**Updated**: 2026-03-02 (Phase 6 added — unified single-image Docker distribution)

## Actual Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite | In `gui/`, pnpm, port 3004 |
| **UI/Styling** | Tailwind CSS v4 + shadcn/ui (to add) | Dark mode provider already exists |
| **State** | Custom `useAsyncFetch` hook + `HttpClient` | Already built; consider React Query later |
| **Backend** | FastAPI (Python) | In `server/`, uv package manager, port 8000 |
| **DB Driver** | `motor` (async MongoDB driver for Python) | To add — async GridFS support |
| **Connection Storage** | Encrypted JSON file (AES-256) | `cryptography` Python lib |
| **Containerization** | Docker (backend Dockerfile exists) | Need combined docker-compose |
| **Deployment** | Docker Hub (self-hosted) | |

## What Already Exists

### Frontend (`gui/`)
- Vite + React 19 + TS fully configured
- Tailwind CSS v4 with custom theme (breakpoints, animations, scrollbar utilities)
- React Router v7 with lazy routes, home page placeholder
- Custom `HttpClient` (fetch wrapper with abort control, error handling, request IDs)
- Hooks: `useAsyncFetch`, `useClickAway`, `useEventListener`, `useLocalStorage`, `useQueryParams`
- `DarkThemeProvider` (system preference detection, localStorage persistence, `class="dark"` on body)
- Constants: `API_GATEWAY_URL = 'http://localhost:8000'`
- ESLint, Biome, Jest configured

### Backend (`server/`)
- FastAPI app with CORS middleware, lifespan logging
- Config via pydantic-settings (`PORT=8000`, `HOST`, `DEBUG`, `APP_NAME`, `CORS_ORIGINS`)
- Health check: `GET /health`
- API router: `GET /api/v1/hello` placeholder
- Multi-stage Dockerfile (python:3.12-slim + uv)
- Makefile with dev/test/coverage/clean commands

---

## Phase 1: Connection Manager (Backend + Frontend)

**Assigned to**: `senior-backend-engineer` (backend), `frontend-engineer` (frontend)
**Date Started**: 2026-03-02
**Status**: [x] Completed

### 1.1 Backend — Dependencies & Config

- [x] Add dependencies to `pyproject.toml`: `motor` (async MongoDB), `cryptography` (AES-256), `python-multipart`
- [x] Add `ENCRYPTION_KEY` and `DATA_DIR` to `Settings` in `app/config.py`
- [x] Create `data/` directory for persistent storage (gitignored)

### 1.2 Backend — Encryption Service

- [x] `app/services/encryption.py` — AES-256-GCM encrypt/decrypt using `ENCRYPTION_KEY` env var
- [x] Functions: `encrypt(plaintext: str) -> str`, `decrypt(ciphertext: str) -> str`
- [x] Store as base64-encoded string (nonce + ciphertext + tag)

### 1.3 Backend — Connection Store

- [x] `app/services/connection_store.py` — CRUD for connections in `DATA_DIR/connections.json`
- [x] Connection URIs encrypted at rest, decrypted only when connecting
- [x] Pydantic models in `app/models/connection.py`:
  - `ConnectionCreate`: `name`, `uri`, `tls` (bool), `tls_ca_file` (optional)
  - `ConnectionResponse`: `id`, `name`, `uri_masked`, `tls`, `created_at`, `updated_at`
  - `ConnectionUpdate`: all fields optional

### 1.4 Backend — Connection Pool

- [x] `app/services/connection_pool.py` — manages `AsyncIOMotorClient` instances per connection ID
- [x] Methods: `connect(conn_id)`, `disconnect(conn_id)`, `get_client(conn_id)`, `get_database(conn_id, db_name)`
- [x] Auto-close all connections on app shutdown (lifespan hook)
- [x] Connection health check via `client.admin.command('ping')`

### 1.5 Backend — Connection Routes

- [x] `app/api/connections.py` — FastAPI router with prefix `/api/v1/connections`:
  - `GET /` — list all saved connections (URI masked)
  - `POST /` — add new connection (validate URI format)
  - `PUT /{conn_id}` — update connection
  - `DELETE /{conn_id}` — remove connection + close pool entry
  - `POST /{conn_id}/test` — test connectivity (ping), return latency
  - `GET /{conn_id}/databases` — list databases on connected server
- [x] Register router in `app/api/routes.py`
- [x] Input validation with Pydantic (URI format regex, required fields)

### 1.6 Frontend — shadcn/ui Setup

- [x] Initialize shadcn/ui in `gui/` (components.json, cn utility)
- [x] Add base shadcn components: Button, Input, Dialog, Card, Badge, Separator, Tooltip, Sonner, Switch, Label

### 1.7 Frontend — App Shell Layout

- [x] `src/components/layout/AppShell.tsx` — sidebar + header + main content area (collapsible, mobile responsive)
- [x] `src/components/layout/Sidebar.tsx` — connection selector + bucket list placeholder slot
- [x] `src/components/layout/Header.tsx` — page title, dark mode toggle, mobile hamburger
- [x] Update routes: `/` (connections page), `/browse/:connId?` (file browser)

### 1.8 Frontend — Connection Manager UI

- [x] `src/pages/Connections/` — full connections management page
- [x] `src/components/connections/ConnectionList.tsx` — responsive card grid with loading/empty states
- [x] `src/components/connections/ConnectionForm.tsx` — add/edit connection dialog (name, URI, TLS toggle)
- [x] `src/components/connections/ConnectionCard.tsx` — card with animated status dot, test/edit/delete/connect actions
- [x] Test connection button with loading spinner + success/error toast
- [x] Delete connection with confirmation dialog
- [x] `src/hooks/useConnections.ts` — CRUD operations using `HttpClient` against `/api/v1/connections`
- [x] `src/contexts/ActiveConnectionContext.ts` + `ActiveConnectionProvider.tsx` — active connection state persisted to localStorage

#### Phase 1 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Full connection manager: backend CRUD + test + databases endpoints, encrypted connection storage (AES-256-GCM), async MongoDB connection pooling, React app shell with collapsible sidebar, shadcn/ui component library, connection cards with test/edit/delete/connect actions, active connection context with localStorage persistence |
| Were there any deviations from the plan? | shadcn/ui was set up manually (not via `shadcn init`) due to Tailwind v4 + `@src/` alias incompatibility with the CLI. Added `ActiveConnectionContext` (not in original plan) for sidebar active connection display. Added Sonner toaster globally. |
| Issues/blockers encountered?             | shadcn CLI doesn't fully support Tailwind v4 + custom path aliases — required manual component setup with CSS variable theme in `@layer base` and `@theme` mappings |
| How were issues resolved?                | Manual shadcn setup: wrote `components.json`, created `cn()` utility, manually added each component file with correct `@src/` imports, added oklch CSS variables to index.css |
| Any technical debt introduced?           | The `/hello` placeholder endpoint in `routes.py` is still there (harmless). Connection URI validation uses simple startswith check rather than full URI parsing. |
| Recommendations for next phase?          | Phase 2 can proceed immediately. The GridFS service should use the existing `ConnectionPool.get_client()` to get Motor clients. The sidebar has `id="sidebar-bucket-list-slot"` ready for bucket list insertion. |

**Completed by**: `senior-backend-engineer` (Tasks 1-5), `frontend-engineer` (Tasks 6-8), `code-simplifier` (cleanup pass)
**Date Completed**: 2026-03-02

#### Notes for Future Phases

- **Config changes**: `ENCRYPTION_KEY` (required), `DATA_DIR` (default `./data`)
- **New dependencies (backend)**: `motor`, `cryptography`, `python-multipart`
- **New dependencies (frontend)**: shadcn/ui components
- **API changes**: `/api/v1/connections` CRUD + `/test` + `/databases`
- **Key decisions**: `AsyncIOMotorClient` pool singleton; encrypted JSON at `DATA_DIR/connections.json`

---

## Phase 2: Core File Browsing — Buckets, File Listing, Upload, Download

**Assigned to**: `senior-backend-engineer` (backend), `frontend-engineer` (frontend), `code-simplifier` (review)
**Date Started**: 2026-03-02
**Status**: [x] Completed

### 2.1 Backend — GridFS Service

- [x] `app/services/gridfs_service.py` — wraps `motor.motor_asyncio.AsyncIOMotorGridFSBucket`
- [x] Stateless service with methods: `list_buckets`, `get_bucket_stats`, `create_bucket`, `list_files`, `upload_file`, `download_file`, `get_file_info`, `delete_file`
- [x] Bucket discovery by scanning collections ending in `.files`/`.chunks`
- [x] Streaming upload (512KB chunks) and download (256KB chunks)

### 2.2 Backend — Bucket Routes

- [x] `app/api/buckets.py` — FastAPI router at `/api/v1/connections/{conn_id}/databases/{db_name}/buckets`:
  - `GET /` — list all GridFS buckets with stats (file count, total size)
  - `POST /` — create bucket (creates `.files` + `.chunks` collections with indexes)
  - `GET /{bucket_name}/stats` — file count, total size, avg file size
- [x] Pydantic models in `app/models/bucket.py`: `BucketInfo`, `BucketStats`, `BucketCreate`
- [x] Registered in `app/api/routes.py`

### 2.3 Backend — File Listing & Pagination

- [x] `app/api/files.py` — FastAPI router at `.../buckets/{bucket_name}/files`:
  - `GET /` — paginated file list (page, limit, sort, order query params)
  - Returns `FileListResponse`: files + total + page + limit + total_pages
- [x] Pydantic models in `app/models/file.py`: `FileInfo`, `FileListResponse`, `FileUploadResponse`

### 2.4 Backend — Upload & Download

- [x] `POST .../files/upload` — multipart upload via `UploadFile`, streams directly to GridFS
- [x] Support `metadata` JSON field in form data, multi-file upload
- [x] `GET .../files/{file_id}/download` — `StreamingResponse` with Content-Disposition + Content-Type
- [x] `GET .../files/{file_id}` — file metadata detail
- [x] `DELETE .../files/{file_id}` — delete file (204)

### 2.5 Backend — Shared Dependencies

- [x] `app/api/deps.py` — extracted shared DI helpers (`ensure_connected`, pool/store/service getters) used by both bucket and file routers

### 2.6 Frontend — Database Selector + Bucket Sidebar

- [x] `src/hooks/useDatabases.ts` — fetches database list for a connection
- [x] Database selector dropdown in Browse page top bar
- [x] `src/components/buckets/BucketSidebar.tsx` — lists buckets with file count + size, create dialog, loading/empty states
- [x] `src/hooks/useBuckets.ts` — fetch/create buckets, auto-fetches on connId/dbName change

### 2.7 Frontend — File Table

- [x] `src/components/files/FileTable.tsx` — sortable columns, multi-select checkboxes, pagination (25/50/100), delete with confirmation dialog, download action
- [x] `src/hooks/useFiles.ts` — paginated fetch, XHR upload with progress, delete, download URL generation
- [x] Loading skeleton rows, empty state with upload CTA
- [x] New shadcn components: `table.tsx`, `checkbox.tsx`, `select.tsx`, `alert-dialog.tsx`

### 2.8 Frontend — File Upload

- [x] `src/components/files/UploadZone.tsx` — drag-and-drop + click-to-browse, visual drag-over feedback
- [x] Multi-file list with remove buttons, optional metadata JSON textarea with validation
- [x] Progress bar via XHR upload tracking, cancel/upload buttons
- [x] New shadcn component: `progress.tsx`

### 2.9 Frontend — File Download + Browse Page Assembly

- [x] Download via temporary `<a>` element with download URL
- [x] `src/pages/Browse/index.tsx` — full state machine: no connection → select DB → select bucket → browse files
- [x] Breadcrumb navigation, collapsible upload panel, database selector + bucket sidebar + file table layout
- [x] `src/common/utils/format-file-size.ts` — human-readable file size utility

### 2.10 Code Simplification (post-phase)

- [x] Extracted `app/api/deps.py` to eliminate ~40 lines of duplicated DI code between bucket and file routers
- [x] Extracted `_doc_to_file_info` in gridfs_service.py to eliminate duplicated MongoDB→FileInfo mapping
- [x] Fixed `content_type` and `metadata` types to accept `null` (matching backend `Optional` fields)
- [x] Memoized `basePath` in `useFiles.ts` for stable reference identity
- [x] Replaced nested ternary in FileTable `SortableHeader` with dedicated `SortIcon` component

#### Phase 2 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Full bucket + file browsing: GridFS service, bucket CRUD routes, file listing/upload/download/delete routes, bucket sidebar UI, file table with sort/pagination/multi-select, drag-and-drop upload with progress, streaming download, database selector, Browse page assembly |
| Were there any deviations from the plan? | Added `databases/{db_name}` to route paths (a connection can have multiple DBs). Added database selector UI (not in original plan). Created `app/api/deps.py` for shared DI. Upload/download components combined into single files rather than separate DropZone/UploadProgress. |
| Issues/blockers encountered?             | None — Phase 1 foundation was solid |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | File types allow `null` for `content_type` and `metadata` which adds null checks in UI. The upload uses XHR instead of fetch for progress tracking (standard pattern but two HTTP abstractions). |
| Recommendations for next phase?          | Phase 3 search/filter can extend the existing `GET .../files` endpoint with additional query params. File detail panel should reuse `FileInfo` type. Preview endpoint needs to be added to backend. |
**Completed by**: `senior-backend-engineer` (backend), `frontend-engineer` (frontend), `code-simplifier` (review)
**Date Completed**: 2026-03-02

#### Notes for Future Phases

- **Route pattern**: `/api/v1/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}/files`
- **Shared deps**: `app/api/deps.py` has `ensure_connected` dependency — reuse in all new routers
- **New backend files**: `gridfs_service.py`, `buckets.py`, `files.py`, `deps.py`, `models/bucket.py`, `models/file.py`
- **New frontend files**: `BucketSidebar.tsx`, `FileTable.tsx`, `UploadZone.tsx`, hooks (`useBuckets`, `useFiles`, `useDatabases`), 5 new shadcn components
- **Key patterns**: Streaming upload/download (no temp files), XHR for upload progress, `formatFileSize` utility
- **For Phase 3**: Extend `GET .../files` endpoint with search/filter query params; add `GET .../files/{id}/preview` endpoint

---

## Phase 3: Search, Filter, Preview & File Detail

**Assigned to**: `senior-backend-engineer` (backend), `frontend-engineer` (frontend), `code-simplifier` (review)
**Date Started**: 2026-03-02
**Status**: [x] Completed

### 3.1 Backend — Search & Filter

- [x] Extend `GET .../files` with filter query params:
  - `search` — regex on `filename` (case-insensitive)
  - `content_type` — prefix match on contentType (regex-escaped for safety)
  - `uploaded_after`, `uploaded_before` — ISO date strings (validated, 400 on invalid)
  - `min_size`, `max_size` — bytes (ge=0)
  - `metadata_key`, `metadata_value` — dot-notation metadata query
- [x] `_build_file_query()` static method builds MongoDB query dynamically with `$regex`, `$gte`, `$lte` operators
- [x] Added standalone indexes on `filename`, `contentType`, `uploadDate`, `length` in `create_bucket()`

### 3.2 Backend — File Detail & Preview

- [x] `GET .../files/{file_id}` — already existed from Phase 2 (full FileInfo with metadata, chunk_size)
- [x] `GET .../files/{file_id}/preview` — `StreamingResponse` with `Content-Disposition: inline`
  - Images/PDF: correct MIME binary
  - Text/JSON/Markdown: raw text
  - Video/Audio: HTTP Range request support (RFC 7233, 206 Partial Content)
  - `Accept-Ranges: bytes` header on all responses
  - 416 Range Not Satisfiable on bad ranges
- [x] `download_file_range()` method in GridFSService for efficient byte-range streaming via `grid_out.seek()`

### 3.3 Frontend — Search & Filter

- [x] `src/components/files/SearchBar.tsx` — debounced text input (300ms), search icon, clear button
- [x] `src/components/files/FilterPanel.tsx` (collapsible):
  - Content type input with `<datalist>` of common MIME prefixes
  - Date range with native HTML date inputs (from/to)
  - File size range (min/max with KB/MB/GB unit selector, converts to bytes)
  - Metadata key-value filter inputs
- [x] Filter state managed by parent Browse page, passed as props
- [x] Clear all filters button, active filter count badge on filter toggle button

### 3.4 Frontend — File Detail Panel

- [x] `src/components/files/FileDetail.tsx` — slide-out sheet (shadcn Sheet)
  - Full file info: filename, size, content type (badge), upload date, chunk size, chunk count
  - FilePreview embedded at top
  - Metadata display (formatted JSON in `<pre>`)
  - Action buttons: download (as `<a>`), delete (with AlertDialog confirm + toast)

### 3.5 Frontend — File Preview

- [x] `src/components/files/FilePreview.tsx` — type-specific renderers:
  - Images (image/*): `<img>` tag with max-height
  - PDF (application/pdf): `<iframe>` full width
  - Text/Code/JSON/MD: `TextPreview` sub-component fetches content via `fetch()`, renders in `<pre><code>`
  - Video (video/*): `<video>` player with controls
  - Audio (audio/*): `<audio>` player with controls
  - Fallback: "No preview available" + download link
- [x] Accessible from FileDetail panel; clicking filename in table opens detail

### 3.6 Frontend — Grid/Thumbnail View

- [x] `src/components/files/FileGrid.tsx` — responsive card grid (2/3/4/5 cols), image thumbnails with hover scale, file type icons for non-images
- [x] View toggle buttons (LayoutList / LayoutGrid icons) in toolbar
- [x] Same pagination/sort/filter applies; skeleton loading cards, empty state with upload CTA

### 3.7 Frontend — Integration

- [x] Updated `useFiles` hook: `FileFilters` interface, `fetchFiles` accepts filters, added `getPreviewUrl()` and `getFileInfo()`
- [x] Updated `FileTable`: `onFileClick` prop makes filename clickable
- [x] Updated Browse page: filters state, viewMode toggle, selectedFile for detail sheet, toolbar with SearchBar + filter toggle + view toggle, filtersRef for stable callback references

#### Phase 3 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Full search/filter/preview: backend filter query builder with 8 params, preview endpoint with Range request support, SearchBar with debounce, FilterPanel with content type/date/size/metadata filters, FileDetail slide-out with preview + metadata + actions, FilePreview with type-specific renderers (image/PDF/text/video/audio), FileGrid card view with thumbnails, view toggle (table/grid), Browse page integration |
| Were there any deviations from the plan? | Filter state is managed in Browse page state rather than synced to URL query params (simpler for MVP). Used native HTML date inputs instead of a date picker component. No syntax highlighting library added (plain `<pre><code>` for text preview). No "raw GridFS document view" toggle in FileDetail (deferred to Phase 4). |
| Issues/blockers encountered?             | None — Phases 1-2 foundation was solid, existing patterns extended cleanly |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | TextPreview sub-component uses raw `fetch()` instead of HttpClient (to get text content directly). Filter state not synced to URL (not bookmarkable). No thumbnail caching for grid view. |
| Recommendations for next phase?          | Phase 4 bulk operations can reuse the multi-select state from FileTable. Rename/metadata edit should reuse the FileDetail sheet. Consider adding URL query param sync for filters if users request shareable filter URLs. |

**Completed by**: `senior-backend-engineer` (backend tasks 3.1-3.2), `frontend-engineer` (frontend tasks 3.3-3.7), `code-simplifier` (cleanup pass)
**Date Completed**: 2026-03-02

#### Notes for Future Phases

- **New backend methods**: `_build_file_query()`, `download_file_range()` in GridFSService
- **New backend indexes**: standalone `filename`, `contentType`, `uploadDate`, `length` on `.files` collection
- **New frontend components**: SearchBar, FilterPanel, FileDetail, FilePreview, FileGrid (all in `src/components/files/`)
- **New shadcn component**: Sheet
- **API changes**: Extended `GET .../files` with 8 filter query params; added `GET .../files/{id}/preview` with Range support
- **For Phase 4**: FileTable has multi-select ready for bulk ops; FileDetail sheet can host rename/metadata edit; grid view may need thumbnail caching optimization

---

## Phase 3.5 (Patch): Content Type Detection Fallback for Preview

**Assigned to**: `senior-backend-engineer` (backend), `frontend-engineer` (frontend)
**Date Started**:
**Status**: [x] Completed

**Problem**: Files in GridFS may not have `contentType` stored (it's optional). When missing, the backend returns `None` or `application/octet-stream`, causing preview to always show "Preview not available" even for common file types like `.jpg`, `.pdf`, `.md`.

**Solution**: Add a `detect_content_type(filename)` utility that infers MIME type from file extension. Use Python's `mimetypes` stdlib + a comprehensive custom mapping for types `mimetypes` may miss. Apply this as fallback everywhere `content_type` is resolved.

### 3.5.1 Backend — Content Type Detection Service

- [x] Create `app/services/content_type.py`:
  - `detect_content_type(filename: str) -> str` — uses `mimetypes.guess_type()` first, then falls back to custom `EXTENSION_MAP` for unmapped types
  - `EXTENSION_MAP`: comprehensive dict mapping extensions → MIME types covering:
    - Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`, `.tiff`, `.avif`, `.heic`
    - Documents: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.odt`, `.ods`, `.odp`
    - Text/Code: `.md`, `.markdown`, `.txt`, `.csv`, `.tsv`, `.json`, `.xml`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.conf`, `.env`, `.log`, `.sql`, `.sh`, `.bash`, `.zsh`, `.ps1`, `.bat`, `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.html`, `.htm`, `.css`, `.scss`, `.less`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, `.r`, `.lua`, `.pl`, `.dart`, `.vue`, `.svelte`
    - Video: `.mp4`, `.webm`, `.ogv`, `.mov`, `.avi`, `.mkv`, `.flv`, `.wmv`, `.m4v`
    - Audio: `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma`, `.opus`, `.mid`, `.midi`
    - Archives: `.zip`, `.tar`, `.gz`, `.bz2`, `.7z`, `.rar`, `.xz`
    - Fonts: `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`
    - Data: `.parquet`, `.arrow`, `.ndjson`, `.geojson`, `.gpx`, `.kml`
    - Other: `.wasm`, `.graphql`, `.proto`, `.dockerfile`

### 3.5.2 Backend — Apply Fallback to All Content Type Resolution Points

- [x] `_doc_to_file_info()` in `gridfs_service.py`: when `content_type` is `None`, call `detect_content_type(filename)`
- [x] `download_file()`: replace `"application/octet-stream"` fallback with `detect_content_type(filename)`
- [x] `download_file_range()`: same replacement
- [ ] ~~Upload flow: when `content_type` on upload is `"application/octet-stream"`, also try `detect_content_type(filename)`~~ (not needed — browser upload always sends correct MIME; detection at read-time is sufficient)

### 3.5.3 Frontend — Fallback Content Type Detection

- [x] Add `getContentTypeFromFilename(filename)` utility in `FilePreview.tsx`
  - Extension→MIME map for previewable types only (images, PDF, text, video, audio)
  - Used only when `fileInfo.content_type` is null/empty/`application/octet-stream`
- [x] Update `FilePreview` component to use this fallback before rendering

#### Phase 3.5 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Backend `content_type.py` with `detect_content_type()` using stdlib `mimetypes` + 130+ extension fallback map. Applied to `_doc_to_file_info`, `download_file`, `download_file_range`. Frontend `EXTENSION_CONTENT_TYPE_MAP` + `getContentTypeFromFilename()` for previewable types, with fallback chain in `FilePreview`. |
| Were there any deviations from the plan? | Skipped upload-time detection — browser already sends correct MIME; read-time detection covers all cases including files uploaded via CLI/scripts without MIME. |
| Issues/blockers encountered?             | None |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | Two extension maps (backend comprehensive, frontend previewable-only). Acceptable — they serve different purposes. |
| Recommendations for next phase?          | Phase 4/5 can proceed. No further changes needed for content type handling. |

**Completed by**: `senior-backend-engineer` (backend), `frontend-engineer` (frontend)
**Date Completed**: 2026-03-02

#### Notes for Future Phases

- **New backend file**: `app/services/content_type.py`
- **No new dependencies**: uses Python stdlib `mimetypes`
- **Behavior change**: files without `contentType` now get a detected type instead of `None`/`application/octet-stream`

---

## Phase 4: Bulk Operations, Rename, Metadata Edit, Copy/Move & Polish

**Assigned to**: `senior-backend-engineer` (backend), `frontend-engineer` (frontend)
**Date Started**: 2026-03-02
**Status**: [x] Completed

### 4.1 Backend — Bulk Operations

- [x] `POST .../files/bulk-delete` — `{ file_ids: list[str] }`, returns deletion results
- [x] `POST .../files/bulk-download` — `{ file_ids: list[str] }`, `StreamingResponse` with ZIP
  - Used Python stdlib `zipfile` + `io.BytesIO` (no extra deps)

### 4.2 Backend — Rename & Metadata Edit

- [x] `PATCH .../files/{file_id}` — `{ filename?, metadata? }`
  - Rename: update `filename` in `<bucket>.files` collection
  - Metadata: replace `metadata` field

### 4.3 Backend — Copy/Move Between Buckets

- [x] `POST .../files/{file_id}/copy` — `{ target_bucket: str }`
  - Stream-pipe between buckets (256KB chunks, no temp files)
  - Preserves metadata + filename + contentType
- [x] `POST .../files/{file_id}/move` — copy then delete original

### 4.4 Frontend — Bulk Delete

- [x] Bulk delete button in toolbar (shown when files selected)
- [x] Confirmation dialog with file count
- [x] Auto-refresh after completion, clear selection

### 4.5 Frontend — Bulk Download

- [x] Bulk download as ZIP button (shown when files selected)
- [x] Loading state during download

### 4.6 Frontend — Rename & Metadata Edit

- [x] Inline rename: double-click filename in table + pencil icon on hover
- [x] Inline rename in FileDetail sheet header
- [x] JSON editor for metadata in file detail panel with validation
- [x] Save/cancel with toast notifications

### 4.7 Frontend — Copy/Move

- [x] Copy/Move in file row dropdown menu (MoreHorizontal → DropdownMenu)
- [x] Copy/Move buttons in FileDetail panel
- [x] Target bucket selector dialog (CopyMoveDialog component)

### 4.8 Polish & UX

- [x] Consistent loading states (skeletons, spinners on all operations)
- [x] Empty states with CTAs
- [x] Toast notifications (sonner) for all success/error states
- [x] Keyboard shortcuts: `Delete` for selected files, `Ctrl/Cmd+A` to select all
- [x] Dark mode compatible (Tailwind class-based)
- [x] Code-simplifier pass: O(n²) fix in bulk ZIP, removed unused imports, deduplicated copy/move helper

#### Phase 4 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Bulk delete, bulk ZIP download, file rename (inline), metadata JSON editor, copy/move between buckets, keyboard shortcuts, dropdown action menu per file row |
| Were there any deviations from the plan? | Used stdlib zipfile instead of zipstream (simpler, no extra dep). Actions column now uses DropdownMenu instead of individual buttons. Added rename to FileDetail header too. |
| Issues/blockers encountered?             | 3 frontend agents editing same files in parallel required careful merge verification |
| How were issues resolved?                | All agents made surgical edits to non-overlapping sections; TypeScript + Vite build verified clean after each merge |
| Any technical debt introduced?           | bulk_download_zip loads full ZIP into memory (BytesIO) — fine for reasonable file counts but could be improved with streaming ZIP for very large batches |
| Recommendations for next phase?          | Docker compose should expose both ports (3004 frontend, 8000 backend) or use nginx reverse proxy. Consider adding `error-boundary` React component wrapping main content area. |

**Completed by**: `senior-backend-engineer` (3 backend tasks), `frontend-engineer` (3 frontend tasks), `code-simplifier` (final pass)
**Date Completed**: 2026-03-02

#### Notes for Future Phases

- **New dependencies (backend)**: None — used only stdlib `zipfile` + `io`
- **New dependencies (frontend)**: `@radix-ui/react-dropdown-menu` (installed via shadcn)
- **API changes**: Added bulk-delete, bulk-download, copy, move, PATCH for rename/metadata
- **New component**: `gui/src/components/files/CopyMoveDialog.tsx`
- **New shadcn component**: `gui/src/components/ui/dropdown-menu.tsx`

---

## Phase 5: Docker, CI/CD & Release

**Assigned to**: `devops-engineer`
**Date Started**: 2026-03-02
**Status**: [x] Completed

### 5.1 Docker

- [x] Root `docker-compose.yml` for full stack:
  - `gui` service: multi-stage build (pnpm install → vite build → nginx:alpine to serve static)
  - `server` service: existing Dockerfile (python:3.12-slim + uv), port 8000 (internal only, proxied via nginx)
  - `mongo` service: mongo:7, port 27017, volume for data
  - Shared `gridfs-net` bridge network, environment variables via `${VAR}` substitution
- [x] Update server Dockerfile: non-root user (`appuser:1001`), `VOLUME ["/app/data"]`
- [x] Create `gui/Dockerfile`: multi-stage (node:20-alpine + corepack/pnpm → build → nginx:alpine → serve dist)
- [x] Create `gui/nginx.conf`: static files, `/api/` reverse proxy to `http://server:8000`, gzip, SPA fallback, cache headers
- [x] `.dockerignore` for both `gui/` and `server/`

### 5.2 GitHub Actions — CI

- [x] `.github/workflows/ci.yml` on push/PR to `main`:
  - Frontend: pnpm install → lint → test → build (Node 20, pnpm 10, cached store)
  - Backend: uv sync → pytest (Python 3.12, uv cached, graceful skip if no tests)
  - Concurrency: `ci-${{ github.ref }}` with `cancel-in-progress: true`

### 5.3 GitHub Actions — Release

- [x] `.github/workflows/release.yml` on tag `v*`:
  - Two parallel jobs: `build-gui` and `build-server`
  - Multi-platform (linux/amd64, linux/arm64) via docker/buildx-action
  - Push to Docker Hub: `shaybushary/gridfs-gui` + `shaybushary/gridfs-gui-server`
  - Tags: `latest` + semver (stripped `v` prefix)
  - GHA layer cache per image scope

### 5.4 Documentation & Release Prep

- [x] Root `README.md`: description, features, quick start (docker-compose), dev setup, env vars, tech stack, project structure
- [x] `CONTRIBUTING.md` — code style, PR process, local setup
- [x] Root `.env.example` (includes `VITE_API_URL` for frontend)
- [x] Root `.gitignore` — Python, Node, IDE, OS, data dir
- [x] `.github/ISSUE_TEMPLATE/bug_report.md`
- [x] `.github/ISSUE_TEMPLATE/feature_request.md`
- [x] Root `render.yaml` — static frontend + Docker backend using projects/environments structure
- [x] Tag `v1.0.0`, create GitHub Release

### 5.5 Git & GitHub Setup

- [x] GitHub repository created: `shay-bushary/gridfs-gui` (public)
- [x] Remote added, all code pushed
- [x] Issues + Discussions enabled
- [x] Issue templates (bug, feature request) created
- [x] Tagged `v1.0.0`, GitHub Release published

### 5.6 Additional Changes

- [x] `gui/src/common/constants.ts`: Changed `API_GATEWAY_URL` from hardcoded `http://localhost:8000` to `import.meta.env.VITE_API_URL || ''` — enables relative URLs behind nginx proxy in Docker, configurable for local dev
- [x] `gui/vite.config.ts`: Fixed `envDir` from `../../` (wrong parent) to `../` (project root) so Vite picks up root `.env` files

#### Phase 5 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Full Docker setup (compose + Dockerfiles + nginx reverse proxy), CI workflow (lint/test/build for both frontend and backend), Release workflow (multi-platform Docker Hub push), comprehensive documentation (README, CONTRIBUTING, .env.example, .gitignore, issue templates, render.yaml), GitHub repo creation with release v1.0.0 |
| Were there any deviations from the plan? | Used separate Docker images instead of combined Dockerfile for release. Server port 8000 is internal-only in Docker (proxied through nginx on port 3000). Added `VITE_API_URL` env var for configurable API base URL. Fixed vite envDir path. Healthcheck in compose uses Python urllib instead of curl (removed curl from server image). |
| Issues/blockers encountered?             | Frontend hardcoded `API_GATEWAY_URL = 'http://localhost:8000'` which wouldn't work behind nginx proxy in Docker. Vite `envDir` pointed to wrong parent directory. |
| How were issues resolved?                | Changed `API_GATEWAY_URL` to use `import.meta.env.VITE_API_URL || ''` — empty string means relative URLs (works with nginx proxy). Fixed `envDir` to `../` (project root). |
| Any technical debt introduced?           | Docker Hub secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`) need to be added to GitHub repo settings before release workflow works. Render.yaml requires `gridfs_gui_env` environment group to be created on Render dashboard. Backend test step gracefully skips (no pytest in deps yet). |
| Recommendations for next phase?          | Add pytest to backend dev dependencies and write API tests. Consider adding Docker build test to CI. Set up Docker Hub secrets. Add Dependabot config for automated dependency updates. |

**Completed by**: `devops-engineer` (4 parallel agents for Docker/CI/Release/Docs + 1 for GitHub setup), `code-simplifier` (cleanup pass)
**Date Completed**: 2026-03-02

---

## Phase 6: Unified Single-Image Docker Distribution

**Assigned to**: `devops-engineer` (Dockerfile + build script), `senior-backend-engineer` (FastAPI static serving), `code-simplifier` (review)
**Date Started**: 2026-03-02
**Status**: [x] Completed

**Goal**: Ship GridFS GUI as a **single Docker image** on Docker Hub. Users run one container — no docker-compose, no nginx sidecar, no separate frontend container. FastAPI serves both the API and the built React frontend from a `public/` directory.

```
docker run -d -p 8000:8000 -e ENCRYPTION_KEY=$(openssl rand -hex 32) shaybushary/gridfs-gui
```

### 6.1 Backend — FastAPI Static File Serving

- [x] `StaticFiles` mount in `app/main.py` at `/` (after all `/api` and `/health` routes)
- [x] SPA fallback middleware: non-API 404s return `public/index.html` for React Router
- [x] Guard: only mounts if `public/` directory exists (dev mode compatible)
- [x] No new dependencies — uses built-in `fastapi.staticfiles.StaticFiles`

### 6.2 Build Script — `build.sh`

- [x] Create `build.sh` at project root (executable, `set -euo pipefail`)
- [x] Make executable: `chmod +x build.sh`
- [x] Add `server/public/` to `.gitignore` (build artifact, not source)

### 6.3 Unified Dockerfile

- [x] Create `Dockerfile` at project root (3-stage multi-stage build):
  - Stage 1 `frontend-build`: `node:20-alpine` + corepack/pnpm@10, builds to `/app/gui/dist/`, `VITE_API_URL=` (empty = relative URLs)
  - Stage 2 `backend-build`: `python:3.12-slim` + uv from ghcr.io, deps then source
  - Stage 3 `runtime`: `python:3.12-slim`, `appuser:1001`, frontend copied to `/app/public/`, HEALTHCHECK, port 8000
- [x] Create root `.dockerignore` (node_modules, .venv, .git, data/, *.md, .env, gui/dist/, server/public/, docs-claude/)

### 6.4 Update Release Workflow

- [x] Replaced `build-gui` + `build-server` jobs with single `build-and-push` job
- [x] Context: `.`, file: `./Dockerfile`
- [x] Image: `shaybushary/gridfs-gui:latest` + `shaybushary/gridfs-gui:<version>`
- [x] Multi-platform (amd64, arm64) + GHA layer cache preserved

### 6.5 Update Documentation

- [x] README primary Quick Start: `docker run` one-liner with `openssl rand -hex 32` ENCRYPTION_KEY, data volume
- [x] README secondary: `docker-compose -f docker-compose.prod.yml up -d`
- [x] Clarified: port 8000 serves both UI and API
- [x] Updated features line, tech stack table, project structure (root Dockerfile, build.sh, docker-compose.prod.yml)

### 6.6 docker-compose.prod.yml

- [x] Created `docker-compose.prod.yml`: app (unified image) + mongo:7, volumes app-data + mongo-data, healthcheck, restart: unless-stopped

#### Phase 6 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | FastAPI `StaticFiles` mount + SPA fallback middleware in `main.py`, `build.sh` (local build helper), root `Dockerfile` (3-stage unified image: node frontend build + uv backend build + python:3.12-slim runtime), root `.dockerignore`, updated `release.yml` (single job, single image), updated `README.md` (docker run one-liner primary, prod compose secondary), `docker-compose.prod.yml` (unified image + mongo) |
| Were there any deviations from the plan? | None — all tasks (6.1-6.6) implemented as specified |
| Issues/blockers encountered?             | None |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | `gui/Dockerfile` and `server/Dockerfile` kept as-is for legacy dev use. Dev `docker-compose.yml` unchanged (still builds from source separately). |
| Recommendations for next phase?          | Consider adding a `docker build` smoke-test step to CI. Add pytest to backend dev dependencies and write API tests. |

**Completed by**: `senior-backend-engineer` (task 6.1), `devops-engineer` (tasks 6.2-6.6), `code-simplifier` (cleanup pass)
**Date Completed**: 2026-03-02

#### Notes

- **Key architectural change**: FastAPI serves React build via `StaticFiles` — no nginx in production image
- **Port simplification**: single port 8000 for everything (API + UI)
- **Dev workflow unchanged**: `docker-compose up` still works with separate containers for hot-reload
- **Phase 5 Docker artifacts preserved**: `gui/Dockerfile`, `gui/nginx.conf`, `docker-compose.yml` remain for dev use
- **Image size target**: ~150-200MB (python:3.12-slim base + deps + static assets, no nginx/node in runtime)

---

## Cross-Phase Reference

### Environment Variables

| Variable | Service | Required | Default | Description |
|---|---|---|---|---|
| `PORT` | server | No | `8000` | FastAPI listen port |
| `HOST` | server | No | `0.0.0.0` | FastAPI bind host |
| `DEBUG` | server | No | `false` | Enable debug/reload mode |
| `APP_NAME` | server | No | `gridfs-gui` | Application name |
| `CORS_ORIGINS` | server | No | `*` | Comma-separated allowed origins |
| `ENCRYPTION_KEY` | server | **Yes** | — | AES-256 key for connection string encryption |
| `DATA_DIR` | server | No | `./data` | Persistent storage directory |

### API Route Summary

| Group | Base Path | Phase |
|---|---|---|
| Health | `GET /health` | Exists |
| Connections | `/api/v1/connections` | 1 |
| Buckets | `/api/v1/connections/{conn_id}/buckets` | 2 |
| Files | `/api/v1/connections/{conn_id}/buckets/{bucket}/files` | 2-4 |

### Agent Responsibilities

| Agent | Responsibilities |
|---|---|
| `devops-engineer` | Docker, CI/CD, GitHub repo, port allocation, venv/uv setup |
| `senior-backend-engineer` | FastAPI routes, MongoDB/GridFS integration (motor), services, models |
| `frontend-engineer` | React UI, shadcn components, hooks, pages, file preview/upload |
