"""
Pydantic models for GridFS file management.

FileInfo           — full metadata for a single file.
FileListResponse   — paginated list of files.
FileUploadResponse — confirmation returned after a successful upload.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    """Full metadata representation of a GridFS file."""

    id: str = Field(..., description="GridFS file ObjectId as hex string")
    filename: str
    length: int = Field(..., ge=0, description="File size in bytes")
    content_type: Optional[str] = Field(default=None, description="MIME type")
    upload_date: datetime
    metadata: Optional[dict[str, Any]] = None
    chunk_size: int = Field(..., ge=0, description="GridFS chunk size in bytes")


class FileListResponse(BaseModel):
    """Paginated file listing response."""

    files: list[FileInfo]
    total: int = Field(..., ge=0, description="Total number of files matching the query")
    page: int = Field(..., ge=1)
    limit: int = Field(..., ge=1)
    total_pages: int = Field(..., ge=0)


class FileUploadResponse(BaseModel):
    """Confirmation returned after uploading a file to GridFS."""

    id: str = Field(..., description="GridFS file ObjectId as hex string")
    filename: str
    length: int = Field(..., ge=0, description="File size in bytes")
    content_type: Optional[str] = None
    upload_date: datetime


class FileUpdateRequest(BaseModel):
    """Request body for updating a file's filename and/or metadata."""

    filename: Optional[str] = Field(default=None, min_length=1, description="New filename")
    metadata: Optional[dict[str, Any]] = Field(default=None, description="New metadata (replaces existing)")


class BulkDeleteRequest(BaseModel):
    """Request body for bulk file deletion."""

    file_ids: list[str] = Field(..., min_length=1, description="List of file IDs to delete")


class BulkDeleteResponse(BaseModel):
    """Response returned after a bulk delete operation."""

    deleted: int = Field(..., ge=0, description="Number of files successfully deleted")
    errors: list[str] = Field(default_factory=list, description="Error messages for files that failed to delete")


class BulkDownloadRequest(BaseModel):
    """Request body for bulk file download as ZIP."""

    file_ids: list[str] = Field(..., min_length=1, description="List of file IDs to download")


class FileCopyMoveRequest(BaseModel):
    """Request body for copying or moving a file to another bucket."""

    target_bucket: str = Field(
        ...,
        min_length=1,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="Target bucket name",
    )


class FileCopyMoveResponse(BaseModel):
    """Response returned after a successful file copy or move."""

    id: str = Field(..., description="New file ID in target bucket")
    filename: str
    target_bucket: str
    length: int = Field(..., ge=0, description="File size in bytes")
