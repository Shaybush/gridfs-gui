# Backend Routes

Base: `/api/v1`

## Health
- `GET /health` - App health check

## Hello (placeholder)
- `GET /api/v1/hello` - Placeholder hello endpoint

## Connections (`/api/v1/connections`)
- `GET /` - List all connections -> `list[ConnectionResponse]`
- `POST /` - Create connection (body: `ConnectionCreate`) -> `ConnectionResponse` (201)
- `PUT /{conn_id}` - Update connection (body: `ConnectionUpdate`) -> `ConnectionResponse`; 404 if not found
- `DELETE /{conn_id}` - Delete connection + disconnect from pool -> `{"detail": "Connection deleted"}`; 404 if not found
- `POST /test-all` - Test all connections in parallel -> `{"results": {"<conn_id>": {"ok": bool, "latency_ms": float}, ...}}`
- `POST /{conn_id}/test` - Test MongoDB connectivity -> `{"ok": bool, "latency_ms": float}` or `{"ok": false, "error": str}`
- `GET /{conn_id}/databases` - List databases (auto-connects) -> `{"databases": [str]}`

### Models
- `ConnectionCreate`: name, uri, tls, tls_ca_file
- `ConnectionUpdate`: name?, uri?, tls?, tls_ca_file? (all optional)
- `ConnectionResponse`: id, name, uri_masked, tls, created_at, updated_at

## Buckets (`/api/v1/connections/{conn_id}/databases/{db_name}/buckets`)
Auto-connects if not already connected. All require valid conn_id + db_name.
- `GET /` - List all GridFS buckets (discovers via .files collections) -> `list[BucketInfo]`
- `POST /` - Create bucket (body: `BucketCreate` {name}) -> `BucketInfo` (201); 409 if exists
- `GET /{bucket_name}/stats` - Bucket stats -> `BucketStats`; 404 if not found
- `DELETE /{bucket_name}` - Delete bucket (drops .files + .chunks); requires `?confirm=true` -> 204; 400 if no confirm; 404 if not found
- `PUT /{bucket_name}` - Rename bucket (body: `BucketRename` {new_name}) -> `BucketInfo`; 409 if target exists; 404 if not found
- `POST /{bucket_name}/export` - Export all files as ZIP -> binary (application/zip, Content-Disposition: attachment); 404 if not found or empty

### Models
- `BucketInfo`: name, file_count, total_size
- `BucketStats`: name, file_count, total_size, avg_file_size
- `BucketCreate`: name (alphanumeric/underscore/hyphen, 1-128 chars)
- `BucketRename`: new_name (alphanumeric/underscore/hyphen, 1-128 chars)

## Files (`/api/v1/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}/files`)
Auto-connects if not already connected. All require valid conn_id + db_name + bucket_name.
- `GET /` - List files paginated + filtered -> `FileListResponse`
  - Query: page (default 1), limit (default 25, max 100), sort (default "uploadDate"), order ("asc"/"desc", default "desc")
  - Filters (all optional): search (regex on filename, case-insensitive), content_type (prefix match on contentType), uploaded_after (ISO datetime), uploaded_before (ISO datetime), min_size (bytes), max_size (bytes), metadata_key + metadata_value (custom metadata filter)
  - Invalid ISO dates return 400
- `POST /upload` - Multipart upload (field: `files`, optional `metadata` JSON string) -> `list[FileUploadResponse]` (201)
- `GET /{file_id}` - File metadata -> `FileInfo`; 404 if not found
- `GET /{file_id}/download` - Stream download (Content-Disposition: attachment) -> StreamingResponse; 404 if not found
- `GET /{file_id}/preview` - Inline preview with document conversion support -> Response; converts Office docs (DOCX, PPTX, XLSX, etc.) to PDF (cached via PreviewCache), CSV to paginated HTML, Markdown to HTML; native types (image, video, audio, text, PDF) stream directly with Range request support (206); query params: page (default 1, CSV only), rows_per_page (default 100, CSV only); CSV responses include X-Total-Pages header; 422 on conversion failure; 416 on bad range; 404 if not found
- `GET /{file_id}/preview/info` - Preview metadata -> `PreviewInfoResponse`; returns previewable (bool), preview_type ("pdf"/"html"/"image"/"video"/"audio"/"text"/null), original_type (MIME), requires_conversion (bool for Office/CSV/Markdown); 404 if not found
- `POST /{file_id}/copy` - Copy file to another bucket (body: `FileCopyMoveRequest`) -> `FileCopyMoveResponse` (201); streams chunk-by-chunk; 400 if same bucket or invalid ID; 404 if not found
- `POST /{file_id}/move` - Move file to another bucket (body: `FileCopyMoveRequest`) -> `FileCopyMoveResponse`; copy + delete original; 400 if same bucket or invalid ID; 404 if not found
- `PATCH /{file_id}` - Update file filename/metadata (body: `FileUpdateRequest`) -> `FileInfo`; 400 if neither field provided or invalid ID; 404 if not found
- `DELETE /{file_id}` - Delete file -> 204; 404 if not found
- `POST /bulk-delete` - Delete multiple files (body: `BulkDeleteRequest`) -> `BulkDeleteResponse`; partial success allowed, errors per file returned
- `POST /bulk-download` - Download multiple files as ZIP (body: `BulkDownloadRequest`) -> ZIP binary (application/zip, Content-Disposition: attachment); skips unreadable files, 404 if none readable

### Models
- `FileInfo`: id, filename, length, content_type?, upload_date, metadata?, chunk_size
- `FileListResponse`: files (list[FileInfo]), total, page, limit, total_pages
- `FileUploadResponse`: id, filename, length, content_type?, upload_date
- `FileCopyMoveRequest`: target_bucket (alphanumeric/underscore/hyphen, required)
- `FileCopyMoveResponse`: id, filename, target_bucket, length
- `BulkDeleteRequest`: file_ids (list[str], min 1)
- `BulkDeleteResponse`: deleted (int), errors (list[str])
- `FileUpdateRequest`: filename? (str, min 1 char), metadata? (dict, replaces existing)
- `BulkDownloadRequest`: file_ids (list[str], min 1)
- `PreviewInfoResponse`: previewable (bool), preview_type (str|null), original_type (str), requires_conversion (bool)
