"""
File management API routes.

All endpoints are mounted under
``/api/v1/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}/files``
via the parent router.  They expose operations for listing, uploading,
downloading, inspecting, and deleting individual GridFS files.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

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
)
from app.services.gridfs_service import GridFSService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/connections/{conn_id}/databases/{db_name}/buckets/{bucket_name}/files",
    tags=["files"],
)

_UPLOAD_CHUNK_SIZE = 512 * 1024


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
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(length),
        },
    )


@router.get(
    "/{file_id}/preview",
    summary="Preview a file inline (supports Range requests)",
    response_class=StreamingResponse,
)
async def preview_file(
    request: Request,
    conn_id: str,
    db_name: str,
    bucket_name: str,
    file_id: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> Response:
    """Stream a GridFS file for inline browser preview.

    Sets ``Content-Disposition: inline`` so the browser renders the file
    directly (images, PDFs, video, audio, etc.).

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
    # Fetch file metadata & stream
    # ------------------------------------------------------------------
    try:
        if range_header and (range_start is not None or range_end is not None):
            # We need file length to resolve suffix-ranges and clamp end.
            # Fetch info first, then open a range stream.
            info = await svc.get_file_info(conn_id, db_name, bucket_name, file_id)
            total_length = info.length
            content_type = info.content_type or "application/octet-stream"
            filename = info.filename

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
                    "Content-Disposition": f'inline; filename="{filename}"',
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
                    "Content-Disposition": f'inline; filename="{file_info["filename"]}"',
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
