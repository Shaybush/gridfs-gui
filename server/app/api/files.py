"""
File management API routes.

All endpoints are mounted under
``/api/v1/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}/files``
via the parent router.  They expose operations for listing, uploading,
downloading, inspecting, and deleting individual GridFS files.
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse

from app.api.deps import ensure_connected, get_gridfs_service
from app.models.file import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    BulkDownloadRequest,
    FileCopyMoveRequest,
    FileCopyMoveResponse,
    FileInfo,
    FileListResponse,
    FileUpdateRequest,
    FileUploadResponse,
    PreviewInfoResponse,
)
from app.services.document_converter import (
    CSV_MIME_TYPES,
    MARKDOWN_MIME_TYPES,
    OFFICE_EXTENSIONS,
    OFFICE_MIME_TYPES,
    DocumentConverter,
    _has_libreoffice,
)
from app.services.gridfs_service import GridFSService
from app.services.preview_cache import PreviewCache

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}/files",
    tags=["files"],
)

_UPLOAD_CHUNK_SIZE = 512 * 1024


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _content_disposition(disposition: str, filename: str) -> str:
    """Build a Content-Disposition header value safe for non-ASCII filenames.

    Uses RFC 5987 ``filename*=UTF-8''...`` for Unicode names while keeping
    an ASCII-safe fallback in the plain ``filename`` parameter.
    """
    # ASCII-safe fallback: replace non-ASCII chars with underscore
    ascii_name = filename.encode("ascii", "replace").decode("ascii").replace("?", "_")
    # RFC 5987 UTF-8 encoded version
    utf8_name = quote(filename, safe="")
    return f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}"


async def _read_stream(svc: GridFSService, conn_id: str, db_name: str,
                       bucket_name: str, file_id: str) -> bytes:
    """Download a GridFS file and return the full contents as bytes."""
    stream, _ = await svc.download_file(conn_id, db_name, bucket_name, file_id)
    chunks: list[bytes] = []
    async for chunk in stream:
        chunks.append(chunk)
    return b"".join(chunks)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _parse_iso_datetime(value: str, param_name: str) -> datetime:
    """Parse an ISO 8601 datetime string, raising HTTP 400 on failure."""
    try:
        dt = datetime.fromisoformat(value)
        # Attach UTC if the string has no timezone info
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ISO datetime for '{param_name}': {exc}",
        )


@router.get(
    "/",
    response_model=FileListResponse,
    summary="List files in a bucket",
)
async def list_files(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    limit: int = Query(default=25, ge=1, le=100, description="Files per page"),
    sort: str = Query(default="uploadDate", description="Sort field"),
    order: str = Query(default="desc", pattern="^(asc|desc)$", description="Sort order"),
    search: Optional[str] = Query(default=None, description="Regex match on filename (case-insensitive)"),
    content_type: Optional[str] = Query(default=None, description="Prefix match on contentType (e.g. 'image/')"),
    uploaded_after: Optional[str] = Query(default=None, description="ISO datetime — files uploaded after this date"),
    uploaded_before: Optional[str] = Query(default=None, description="ISO datetime — files uploaded before this date"),
    min_size: Optional[int] = Query(default=None, ge=0, description="Minimum file size in bytes"),
    max_size: Optional[int] = Query(default=None, ge=0, description="Maximum file size in bytes"),
    metadata_key: Optional[str] = Query(default=None, description="Custom metadata field name to filter on"),
    metadata_value: Optional[str] = Query(default=None, description="Value for the custom metadata field"),
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> FileListResponse:
    """Return a paginated, sorted, and optionally filtered list of files."""
    # Parse date strings into datetime objects
    parsed_after: Optional[datetime] = None
    parsed_before: Optional[datetime] = None
    if uploaded_after is not None:
        parsed_after = _parse_iso_datetime(uploaded_after, "uploaded_after")
    if uploaded_before is not None:
        parsed_before = _parse_iso_datetime(uploaded_before, "uploaded_before")

    try:
        return await svc.list_files(
            conn_id=conn_id,
            db_name=db_name,
            bucket_name=bucket_name,
            page=page,
            limit=limit,
            sort_field=sort,
            sort_order=order,
            search=search,
            content_type=content_type,
            uploaded_after=parsed_after,
            uploaded_before=parsed_before,
            min_size=min_size,
            max_size=max_size,
            metadata_key=metadata_key,
            metadata_value=metadata_value,
        )
    except Exception as exc:
        logger.exception("Error listing files: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list files: {exc}",
        )


@router.post(
    "/upload",
    response_model=list[FileUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload files to a bucket",
)
async def upload_files(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    files: list[UploadFile] = File(..., description="One or more files to upload"),
    metadata: Optional[str] = Form(default=None, description="JSON string of metadata to attach"),
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> list[FileUploadResponse]:
    """Upload one or more files to the specified GridFS bucket.

    Files are streamed directly into GridFS without writing temporary
    files to disk.  An optional ``metadata`` form field accepts a JSON
    string that will be attached to every uploaded file.
    """
    # Parse optional metadata
    parsed_metadata: Optional[dict] = None
    if metadata:
        try:
            parsed_metadata = json.loads(metadata)
            if not isinstance(parsed_metadata, dict):
                raise ValueError("metadata must be a JSON object")
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid metadata JSON: {exc}",
            )

    results: list[FileUploadResponse] = []

    for upload_file in files:
        filename = upload_file.filename or "untitled"
        content_type = upload_file.content_type or "application/octet-stream"

        async def _file_stream(uf: UploadFile = upload_file):
            """Async generator that yields chunks from the UploadFile."""
            while True:
                chunk = await uf.read(_UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk

        try:
            result = await svc.upload_file(
                conn_id=conn_id,
                db_name=db_name,
                bucket_name=bucket_name,
                filename=filename,
                file_stream=_file_stream(),
                content_type=content_type,
                metadata=parsed_metadata,
            )
            results.append(result)
        except Exception as exc:
            logger.exception("Error uploading file '%s': %s", filename, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file '{filename}': {exc}",
            )

    return results


# ---------------------------------------------------------------------------
# Bulk operations
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    response_model=BulkDeleteResponse,
    summary="Bulk delete files",
)
async def bulk_delete_files(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    body: BulkDeleteRequest,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> BulkDeleteResponse:
    """Delete multiple files from the GridFS bucket in a single request.

    Processes each file ID individually so that a single invalid or missing
    ID does not prevent the remaining files from being deleted.  The
    response includes both the count of successfully deleted files and any
    per-file error messages.
    """
    try:
        deleted, errors = await svc.bulk_delete(
            conn_id, db_name, bucket_name, body.file_ids,
        )
        return BulkDeleteResponse(deleted=deleted, errors=errors)
    except Exception as exc:
        logger.exception("Error during bulk delete: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform bulk delete: {exc}",
        )


@router.post(
    "/bulk-download",
    summary="Bulk download files as ZIP",
    response_class=Response,
)
async def bulk_download_files(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    body: BulkDownloadRequest,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> Response:
    """Download multiple GridFS files as a single ZIP archive.

    Builds an in-memory ZIP containing all requested files, then streams
    the result back to the client.  Files that cannot be read (invalid ID,
    not found) are silently skipped; if **none** of the files can be read
    the endpoint returns 404.
    """
    try:
        zip_bytes = await svc.bulk_download_zip(
            conn_id, db_name, bucket_name, body.file_ids,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Error during bulk download: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ZIP archive: {exc}",
        )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="gridfs-download.zip"',
            "Content-Length": str(len(zip_bytes)),
        },
    )


@router.get(
    "/{file_id}",
    response_model=FileInfo,
    summary="Get file metadata",
)
async def get_file_info(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> FileInfo:
    """Return full metadata for a single GridFS file."""
    try:
        return await svc.get_file_info(conn_id, db_name, bucket_name, file_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except Exception as exc:
        logger.exception("Error getting file info: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file info: {exc}",
        )


@router.get(
    "/{file_id}/download",
    summary="Download a file",
    response_class=StreamingResponse,
)
async def download_file(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> StreamingResponse:
    """Stream-download a GridFS file.

    Sets ``Content-Disposition: attachment`` and the correct
    ``Content-Type`` so that browsers trigger a file-save dialog.
    """
    try:
        stream, file_info = await svc.download_file(conn_id, db_name, bucket_name, file_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except Exception as exc:
        logger.exception("Error downloading file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file: {exc}",
        )

    filename = file_info["filename"]
    content_type = file_info["content_type"]
    length = file_info["length"]

    return StreamingResponse(
        content=stream,
        media_type=content_type,
        headers={
            "Content-Disposition": _content_disposition("attachment", filename),
            "Content-Length": str(length),
        },
    )


@router.get(
    "/{file_id}/preview",
    summary="Preview a file inline (supports Range requests and document conversion)",
    response_class=StreamingResponse,
)
async def preview_file(
    request: Request,
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    page: int = Query(default=1, ge=1, description="Page number for CSV preview"),
    rows_per_page: int = Query(default=100, ge=1, le=10000, description="Rows per page for CSV preview"),
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> Response:
    """Stream a GridFS file for inline browser preview.

    Sets ``Content-Disposition: inline`` so the browser renders the file
    directly (images, PDFs, video, audio, etc.).

    **Document conversion** is supported for Office documents (DOCX, PPTX,
    XLSX, etc.) which are converted to PDF, and for CSV / Markdown files
    which are converted to HTML.

    For video and audio content, HTTP Range Requests (RFC 7233) are
    supported.  When the ``Range`` header is present, the endpoint returns
    ``206 Partial Content`` with the requested byte range; otherwise it
    returns the full file with ``Accept-Ranges: bytes`` to advertise
    range support.
    """
    # ------------------------------------------------------------------
    # Parse Range header (if any) before hitting the service layer so we
    # can fail fast on malformed values.
    # ------------------------------------------------------------------
    range_header = request.headers.get("range")
    range_start: Optional[int] = None
    range_end: Optional[int] = None

    if range_header:
        match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Malformed Range header",
            )
        raw_start, raw_end = match.group(1), match.group(2)
        if raw_start:
            range_start = int(raw_start)
        if raw_end:
            range_end = int(raw_end)

    # ------------------------------------------------------------------
    # Fetch file metadata & determine preview type
    # ------------------------------------------------------------------
    try:
        info = await svc.get_file_info(conn_id, db_name, bucket_name, file_id)
        content_type = info.content_type or "application/octet-stream"
        filename = info.filename
        extension = os.path.splitext(filename)[1].lower()

        # Check if the file requires document conversion
        is_office = content_type in OFFICE_MIME_TYPES or extension in OFFICE_EXTENSIONS
        is_csv = content_type in CSV_MIME_TYPES or extension == ".csv"
        is_markdown = content_type in MARKDOWN_MIME_TYPES or extension in (".md", ".markdown")

        # --------------------------------------------------------------
        # Office document conversion (with caching)
        # LibreOffice -> PDF if available, otherwise Python libs -> HTML
        # --------------------------------------------------------------
        if is_office:
            if not DocumentConverter.can_convert_office(extension):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Preview for '{extension}' files requires LibreOffice which is not installed. "
                           f"Supported formats without LibreOffice: .docx, .pptx, .xlsx",
                )

            cache = PreviewCache.get_instance()
            upload_date_str = info.upload_date.isoformat() if isinstance(info.upload_date, datetime) else str(info.upload_date)

            # Check cache first
            cached = await cache.get(file_id, upload_date_str)
            if cached is not None:
                # Determine cached content type from cache metadata
                is_pdf_cache = cached[:5] == b"%PDF-"
                if is_pdf_cache:
                    return Response(
                        content=cached,
                        media_type="application/pdf",
                        headers={
                            "Content-Disposition": _content_disposition("inline", f"{filename}.pdf"),
                            "Content-Length": str(len(cached)),
                        },
                    )
                else:
                    return Response(
                        content=cached,
                        media_type="text/html",
                        headers={
                            "Content-Disposition": _content_disposition("inline", f"{filename}.html"),
                        },
                    )

            file_bytes = await _read_stream(svc, conn_id, db_name, bucket_name, file_id)

            try:
                if _has_libreoffice():
                    pdf_bytes = await DocumentConverter.convert_office_to_pdf(file_bytes, extension)
                    await cache.set(file_id, upload_date_str, pdf_bytes)
                    return Response(
                        content=pdf_bytes,
                        media_type="application/pdf",
                        headers={
                            "Content-Disposition": _content_disposition("inline", f"{filename}.pdf"),
                            "Content-Length": str(len(pdf_bytes)),
                        },
                    )
                else:
                    html_content = DocumentConverter.convert_office_to_html(file_bytes, extension)
                    html_bytes = html_content.encode("utf-8")
                    await cache.set(file_id, upload_date_str, html_bytes)
                    return Response(
                        content=html_bytes,
                        media_type="text/html",
                        headers={
                            "Content-Disposition": _content_disposition("inline", f"{filename}.html"),
                        },
                    )
            except (RuntimeError, FileNotFoundError) as exc:
                logger.error("Office conversion failed for %s: %s", file_id, exc)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Document conversion failed: {exc}",
                )

        # --------------------------------------------------------------
        # CSV -> HTML conversion (paginated)
        # --------------------------------------------------------------
        if is_csv:
            file_bytes = await _read_stream(svc, conn_id, db_name, bucket_name, file_id)

            try:
                html_content, total_pages = DocumentConverter.convert_csv_to_html(
                    file_bytes, page, rows_per_page,
                )
            except Exception as exc:
                logger.error("CSV conversion failed for %s: %s", file_id, exc)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"CSV conversion failed: {exc}",
                )

            return Response(
                content=html_content,
                media_type="text/html",
                headers={
                    "Content-Disposition": _content_disposition("inline", f"{filename}.html"),
                    "X-Total-Pages": str(total_pages),
                },
            )

        # --------------------------------------------------------------
        # Markdown -> HTML conversion
        # --------------------------------------------------------------
        if is_markdown:
            file_bytes = await _read_stream(svc, conn_id, db_name, bucket_name, file_id)

            try:
                html_content = DocumentConverter.convert_markdown_to_html(file_bytes)
            except Exception as exc:
                logger.error("Markdown conversion failed for %s: %s", file_id, exc)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Markdown conversion failed: {exc}",
                )

            return Response(
                content=html_content,
                media_type="text/html",
                headers={
                    "Content-Disposition": _content_disposition("inline", f"{filename}.html"),
                },
            )

        # --------------------------------------------------------------
        # Native types (image, video, audio, text, PDF) - existing behavior
        # Range request support for streamable types
        # --------------------------------------------------------------
        if range_header and (range_start is not None or range_end is not None):
            total_length = info.length

            # Resolve suffix-range: "bytes=-500" means last 500 bytes
            if range_start is None:
                # suffix-length: range_end holds the suffix length
                range_start = max(total_length - range_end, 0)
                range_end = total_length - 1
            else:
                # Clamp end to file boundary
                if range_end is None or range_end >= total_length:
                    range_end = total_length - 1

            if range_start > range_end or range_start >= total_length:
                raise HTTPException(
                    status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                    detail="Range not satisfiable",
                    headers={"Content-Range": f"bytes */{total_length}"},
                )

            stream, _ = await svc.download_file_range(
                conn_id, db_name, bucket_name, file_id, range_start, range_end,
            )

            partial_length = range_end - range_start + 1

            return StreamingResponse(
                content=stream,
                status_code=status.HTTP_206_PARTIAL_CONTENT,
                media_type=content_type,
                headers={
                    "Content-Disposition": _content_disposition("inline", filename),
                    "Content-Length": str(partial_length),
                    "Content-Range": f"bytes {range_start}-{range_end}/{total_length}",
                    "Accept-Ranges": "bytes",
                },
            )
        else:
            # Full file — no range requested
            stream, file_info = await svc.download_file(
                conn_id, db_name, bucket_name, file_id,
            )

            return StreamingResponse(
                content=stream,
                media_type=file_info["content_type"],
                headers={
                    "Content-Disposition": _content_disposition("inline", file_info["filename"]),
                    "Content-Length": str(file_info["length"]),
                    "Accept-Ranges": "bytes",
                },
            )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error previewing file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview file: {exc}",
        )


@router.get(
    "/{file_id}/preview/info",
    response_model=PreviewInfoResponse,
    summary="Get preview info for a file",
)
async def get_preview_info(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> PreviewInfoResponse:
    """Return preview metadata for a file.

    Indicates whether the file can be previewed, the preview type,
    the original MIME type, and whether server-side conversion is needed.
    """
    try:
        info = await svc.get_file_info(conn_id, db_name, bucket_name, file_id)
        content_type = info.content_type or "application/octet-stream"
        filename = info.filename
        extension = os.path.splitext(filename)[1].lower()

        preview_type = DocumentConverter.get_preview_type(content_type, filename)

        is_convertible = (
            content_type in OFFICE_MIME_TYPES
            or extension in OFFICE_EXTENSIONS
            or content_type in CSV_MIME_TYPES
            or extension == ".csv"
            or content_type in MARKDOWN_MIME_TYPES
            or extension in (".md", ".markdown")
        )

        return PreviewInfoResponse(
            previewable=preview_type is not None,
            preview_type=preview_type,
            original_type=content_type,
            requires_conversion=preview_type is not None and is_convertible,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except Exception as exc:
        logger.exception("Error getting preview info: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get preview info: {exc}",
        )


@router.post(
    "/{file_id}/copy",
    response_model=FileCopyMoveResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Copy a file to another bucket",
)
async def copy_file(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    body: FileCopyMoveRequest,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> FileCopyMoveResponse:
    """Copy a file from the current bucket to a different bucket.

    The file is streamed chunk-by-chunk so the entire contents are never
    loaded into memory at once.  All metadata (filename, contentType,
    custom metadata) is preserved in the copy.
    """
    try:
        return await svc.copy_file(
            conn_id, db_name, bucket_name, file_id, body.target_bucket,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except Exception as exc:
        logger.exception("Error copying file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to copy file: {exc}",
        )


@router.post(
    "/{file_id}/move",
    response_model=FileCopyMoveResponse,
    summary="Move a file to another bucket",
)
async def move_file(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    body: FileCopyMoveRequest,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> FileCopyMoveResponse:
    """Move a file from the current bucket to a different bucket.

    This performs a streaming copy followed by deletion of the original.
    All metadata (filename, contentType, custom metadata) is preserved.
    """
    try:
        return await svc.move_file(
            conn_id, db_name, bucket_name, file_id, body.target_bucket,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except Exception as exc:
        logger.exception("Error moving file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move file: {exc}",
        )


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a file",
)
async def delete_file(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> None:
    """Delete a file from the GridFS bucket."""
    try:
        await svc.delete_file(conn_id, db_name, bucket_name, file_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except Exception as exc:
        logger.exception("Error deleting file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {exc}",
        )


@router.patch(
    "/{file_id}",
    response_model=FileInfo,
    summary="Update file filename and/or metadata",
)
async def update_file(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    body: FileUpdateRequest,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> FileInfo:
    """Update a file's filename and/or metadata.

    At least one of ``filename`` or ``metadata`` must be provided.
    When ``metadata`` is supplied it fully replaces the existing metadata
    object on the GridFS ``.files`` document.
    """
    if body.filename is None and body.metadata is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of 'filename' or 'metadata' must be provided",
        )

    try:
        return await svc.update_file(
            conn_id=conn_id,
            db_name=db_name,
            bucket_name=bucket_name,
            file_id=file_id,
            filename=body.filename,
            metadata=body.metadata,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in bucket '{bucket_name}'",
        )
    except Exception as exc:
        logger.exception("Error updating file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update file: {exc}",
        )
