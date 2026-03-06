# Document Preview Support - Implementation Plan

**Goal:** Add high-fidelity, paginated preview support for DOCX, PPTX, XLSX, CSV, Markdown, and improved PDF rendering.
**Approach:** Server-side conversion (documents -> HTML/images via Python libraries + LibreOffice for high fidelity)
**Date Created:** 2026-03-06

---

## Architecture Overview

```
Browser Request -> /api/v1/.../files/{file_id}/preview
                        |
                  detect content_type
                        |
        +---------------+----------------+
        |               |                |
   Office docs     CSV/Markdown      PDF/Image/etc
   (docx,pptx,     (lightweight      (existing flow,
    xlsx)            conversion)       unchanged)
        |               |
  LibreOffice       Python libs
  convert to PDF    (csv, markdown)
        |               |
   Serve as PDF     Serve as HTML
   (paginated)      (paginated for CSV)
```

**Key Decision:** Office documents (DOCX, PPTX, XLSX) will be converted to PDF via LibreOffice for maximum fidelity. Converted files will be cached to avoid repeated conversions. CSV/Markdown use lightweight Python rendering.

---

## Phase 1: Backend - Document Conversion Service

**Assigned to**: senior-backend-engineer + devops-engineer
**Date Started**: 2026-03-06
**Status**: [x] Completed

- [x] Install LibreOffice headless in Docker image (`libreoffice-core`, `libreoffice-writer`, `libreoffice-calc`, `libreoffice-impress`)
- [x] Add Python dependencies: `markdown`, `Pygments` (for markdown/code rendering)
- [x] Create `server/app/services/document_converter.py` with:
  - [x] `DocumentConverter` class with async conversion methods
  - [x] `convert_office_to_pdf(file_bytes, source_extension) -> bytes` - uses LibreOffice CLI (`soffice --headless --convert-to pdf`)
  - [x] `convert_csv_to_html(file_bytes, page, rows_per_page) -> tuple[str, int]` - renders CSV as styled HTML table with pagination
  - [x] `convert_markdown_to_html(file_bytes) -> str` - renders Markdown to styled HTML with Pygments
  - [x] `get_preview_type(content_type, filename) -> str | None` - maps MIME types to preview categories
  - [x] Temp file management (write to temp, convert, cleanup via shutil.rmtree)
- [x] Create `server/app/services/preview_cache.py` with:
  - [x] In-memory LRU cache for converted documents (keyed by `file_id:upload_date`)
  - [x] Cache size limit configuration via env var `PREVIEW_CACHE_MAX_MB` (default 200MB)
  - [x] Cache TTL configuration via env var `PREVIEW_CACHE_TTL_SECONDS` (default 3600)
  - [x] `get(file_id, upload_date) -> bytes | None`
  - [x] `set(file_id, upload_date, data) -> None`

#### Phase 1 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | DocumentConverter service (office->PDF via LibreOffice, CSV->HTML, Markdown->HTML), PreviewCache singleton with LRU+TTL, config settings, Dockerfile with LibreOffice headless |
| Were there any deviations from the plan? | Method signatures slightly adjusted: file_bytes instead of file_stream, get_preview_type() added as bonus utility |
| Issues/blockers encountered?             | Variable name shadowing `html` module in converter (caught by code-simplifier) |
| How were issues resolved?                | Renamed local vars to `document`, replaced custom `_esc()` with `html.escape()`, used `shutil.rmtree()` for cleanup |
| Any technical debt introduced?           | None |
| Recommendations for next phase?          | Wire DocumentConverter + PreviewCache into the existing preview_file endpoint in files.py |

**Completed by**: senior-backend-engineer (services), devops-engineer (Dockerfile), code-simplifier (review)
**Date Completed**: 2026-03-06

#### Notes for Future Phases

- **New dependencies**: `markdown`, `Pygments` (pyproject.toml)
- **Docker changes**: LibreOffice headless packages added to Dockerfile
- **Config changes**: `PREVIEW_CACHE_MAX_MB`, `PREVIEW_CACHE_TTL_SECONDS` env vars
- **Services created**: `document_converter.py`, `preview_cache.py`

---

## Phase 2: Backend - Preview API Endpoint Enhancement

**Assigned to**: senior-backend-engineer
**Date Started**: 2026-03-06
**Status**: [x] Completed

- [x] Modify `server/app/api/files.py` - enhance the existing `preview_file` endpoint:
  - [x] Add content-type detection for Office formats (`application/vnd.openxmlformats-officedocument.*`, `text/csv`, `text/markdown`)
  - [x] For Office docs: check cache -> convert via LibreOffice -> cache result -> stream PDF back with `Content-Type: application/pdf`
  - [x] For CSV: convert to HTML table -> return with `Content-Type: text/html`
  - [x] For Markdown: convert to styled HTML -> return with `Content-Type: text/html`
  - [x] Existing preview types (image, video, audio, text, PDF) remain unchanged
- [x] Add new endpoint `GET /{file_id}/preview/info` returning preview metadata:
  - [x] `{ "previewable": true, "preview_type": "pdf"|"html"|"image"|"video"|"audio"|"text", "original_type": "...", "requires_conversion": bool }`
- [x] Add query parameter `?page=N` to preview endpoint for paginated CSV (rows per page)
- [x] Add error handling for conversion failures (timeout, unsupported format, corrupt file) -> HTTP 422
- [x] Set conversion timeout (env var `PREVIEW_CONVERSION_TIMEOUT_SECONDS`, default 30)
- [x] Update `docs-claude/backend-routes.md` with new endpoint info

#### Phase 2 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | Enhanced preview endpoint with Office->PDF conversion (cached), CSV->HTML (paginated), Markdown->HTML. New preview/info endpoint. Shared `_read_stream()` helper for O(n) byte collection. |
| Were there any deviations from the plan? | Response model uses `requires_conversion` instead of `pageCount` - simpler and sufficient for frontend needs |
| Issues/blockers encountered?             | O(n^2) byte concatenation pattern caught by code-simplifier |
| How were issues resolved?                | Extracted `_read_stream()` helper using `b"".join(chunks)` |
| Any technical debt introduced?           | None |
| Recommendations for next phase?          | Test with real Office documents in Docker container with LibreOffice |

**Completed by**: senior-backend-engineer + code-simplifier
**Date Completed**: 2026-03-06

#### Notes for Future Phases

- **API changes**: New `GET /{file_id}/preview/info` endpoint; preview endpoint now converts Office docs to PDF
- **Config changes**: `PREVIEW_CONVERSION_TIMEOUT_SECONDS` env var
- **Frontend needs**: Preview component must handle converted content types (Office -> PDF)

---

## Phase 3: Frontend - Enhanced Preview Components

**Assigned to**: frontend-engineer
**Date Started**: 2026-03-06
**Status**: [x] Completed

- [x] Create `gui/src/components/files/previews/DocumentPreview.tsx`:
  - [x] Wrapper for Office documents — fetches preview URL, shows "Converting document..." spinner
  - [x] Renders converted PDF in iframe via blob URL
  - [x] Falls back to download if conversion fails
  - [x] Proper blob URL cleanup on unmount
- [x] Create `gui/src/components/files/previews/HTMLPreview.tsx`:
  - [x] Sandboxed iframe for server-rendered HTML (CSV tables, Markdown)
  - [x] Pagination controls for CSV (prev/next page, reads X-Total-Pages header)
  - [x] Blob URL memory management with useMemo + cleanup
- [x] Create `gui/src/components/files/previews/TextPreview.tsx`:
  - [x] Extracted shared TextPreview component (was duplicated in FilePreview + FullscreenPreview)
  - [x] Supports `fullscreen` prop for different height constraints
- [x] Update `gui/src/components/files/FilePreview.tsx`:
  - [x] Add cases for Office docs, CSV, Markdown content types (before generic text/* check)
  - [x] Route to DocumentPreview / HTMLPreview sub-components
  - [x] Removed inline TextPreview, uses shared component
- [x] Update `gui/src/components/files/FullscreenPreview.tsx`:
  - [x] Same Office/CSV/Markdown handling with fullscreen={true}
  - [x] Removed FullscreenTextPreview, uses shared TextPreview component
- [x] Update `gui/src/common/utils/content-type.ts`:
  - [x] Added 9 Office MIME types to EXTENSION_CONTENT_TYPE_MAP
  - [x] Added `isOfficeDocument()` and `isDocumentPreviewable()` helpers
- [x] Update `docs-claude/webui-templates-index.md` with new components

#### Phase 3 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | DocumentPreview (Office->PDF iframe), HTMLPreview (CSV/Markdown with pagination), shared TextPreview, content-type helpers. Updated FilePreview + FullscreenPreview routing. |
| Were there any deviations from the plan? | Skipped react-pdf — iframe approach is simpler and sufficient for converted PDFs. Extracted shared TextPreview (code-simplifier caught duplication). |
| Issues/blockers encountered?             | Memory leak in HTMLPreview (blob URLs), broken cancellation pattern |
| How were issues resolved?                | Code-simplifier fixed: useMemo for blob URLs with cleanup, useRef for cancellation |
| Any technical debt introduced?           | None |
| Recommendations for next phase?          | Consider adding react-pdf later if users need page-by-page navigation for large PDFs |

**Completed by**: frontend-engineer + code-simplifier
**Date Completed**: 2026-03-06

#### Notes for Future Phases

- **New dependencies**: `react-pdf` or `pdfjs-dist` (package.json)
- **New components**: `PDFPreview.tsx`, `HTMLPreview.tsx`, `DocumentPreview.tsx`

---

## Phase 4: Docker & Deployment

**Assigned to**: devops-engineer + code-simplifier
**Date Started**: 2026-03-06
**Status**: [x] Completed

- [x] Update `server/Dockerfile` (used by Render):
  - [x] Add LibreOffice headless packages (`libreoffice-core`, `libreoffice-writer`, `libreoffice-calc`, `libreoffice-impress`, `libreoffice-common`)
  - [x] Add fonts packages for proper document rendering (`fonts-liberation`, `fonts-dejavu-core`)
  - [x] Optimized with `--no-install-recommends`, `apt-get clean`, `rm -rf /var/lib/apt/lists/*`
  - [x] Added HEALTHCHECK directive (consistency with root Dockerfile)
- [x] Root `Dockerfile` already had LibreOffice from Phase 1:
  - [x] Code-simplifier moved LibreOffice layer above `COPY --from` for better Docker layer caching
- [x] Update `render.yaml`:
  - [x] Added `PREVIEW_CACHE_MAX_MB=200`, `PREVIEW_CACHE_TTL_SECONDS=3600`, `PREVIEW_CONVERSION_TIMEOUT_SECONDS=30`
- [ ] Test Docker build succeeds with LibreOffice (deferred to Phase 5)
- [ ] Verify LibreOffice conversion works inside container (deferred to Phase 5)
- [ ] Performance test: conversion time for sample files (deferred to Phase 5)

#### Phase 4 Completion Report

| Question                                 | Response |
| ---------------------------------------- | -------- |
| What was implemented?                    | LibreOffice headless + fonts added to server/Dockerfile, healthcheck added, render.yaml updated with 3 preview env vars |
| Were there any deviations from the plan? | Root Dockerfile already had LibreOffice from Phase 1. Code-simplifier improved layer ordering for caching. Docker build/test deferred to Phase 5. |
| Issues/blockers encountered?             | None |
| How were issues resolved?                | N/A |
| Any technical debt introduced?           | None |
| Recommendations for next phase?          | Test Docker build with LibreOffice and verify conversion works inside container. Ensure Render instance has enough RAM (min 512MB). |

**Completed by**: devops-engineer + code-simplifier
**Date Completed**: 2026-03-06

#### Notes for Future Phases

- **Docker image size**: LibreOffice adds ~200-400MB. Both Dockerfiles use `--no-install-recommends` to minimize.
- **Render deployment**: Ensure Render instance has enough RAM for LibreOffice conversions (min 512MB recommended)
- **Layer caching**: LibreOffice install is now before COPY steps for optimal caching in both Dockerfiles

---

## Phase 5: Testing & Polish

**Assigned to**: senior-backend-engineer + frontend-engineer
**Date Started**:
**Status**: [ ] Not Started | [ ] In Progress | [ ] Completed

- [ ] Backend tests:
  - [ ] Test conversion of sample DOCX (with images, tables, formatting)
  - [ ] Test conversion of sample PPTX (multiple slides, embedded media)
  - [ ] Test conversion of sample XLSX (multiple sheets, charts)
  - [ ] Test CSV rendering (large files, special characters, different delimiters)
  - [ ] Test Markdown rendering (headers, code blocks, tables, links)
  - [ ] Test cache hit/miss behavior
  - [ ] Test conversion timeout handling
  - [ ] Test corrupt/invalid file handling
- [ ] Frontend tests:
  - [ ] Test PDF page navigation (first, last, specific page)
  - [ ] Test zoom controls
  - [ ] Test fullscreen mode for all new formats
  - [ ] Test loading/error states
  - [ ] Test keyboard navigation (Page Up/Down for pages)
- [ ] Edge cases:
  - [ ] Password-protected Office documents (show "cannot preview" message)
  - [ ] Very large documents (>50MB) - show size warning or skip conversion
  - [ ] Empty documents
  - [ ] Documents with non-Latin characters (CJK, Arabic, Hebrew)

#### Phase 5 Completion Report

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

## Supported Formats Summary

| Format | Extension | MIME Type | Conversion Method | Preview As |
|--------|-----------|-----------|-------------------|------------|
| Word | .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | LibreOffice -> PDF | PDF (paginated) |
| PowerPoint | .pptx | application/vnd.openxmlformats-officedocument.presentationml.presentation | LibreOffice -> PDF | PDF (slide-per-page) |
| Excel | .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | LibreOffice -> PDF | PDF (paginated) |
| CSV | .csv | text/csv | Python csv -> HTML table | HTML (paginated rows) |
| Markdown | .md | text/markdown | Python markdown -> HTML | HTML (scrollable) |
| PDF | .pdf | application/pdf | None (native) | PDF (paginated, improved viewer) |
| Legacy Word | .doc | application/msword | LibreOffice -> PDF | PDF (paginated) |
| Legacy Excel | .xls | application/vnd.ms-excel | LibreOffice -> PDF | PDF (paginated) |
| Legacy PPT | .ppt | application/vnd.ms-powerpoint | LibreOffice -> PDF | PDF (paginated) |

## Execution Order

1. **Phase 4 (Docker)** - Install LibreOffice first since Phase 1 & 2 depend on it for testing
2. **Phase 1 (Conversion Service)** - Backend service layer
3. **Phase 2 (API Enhancement)** - Wire conversion into endpoints
4. **Phase 3 (Frontend)** - Build UI components (can start in parallel with Phase 2)
5. **Phase 5 (Testing)** - End-to-end validation
