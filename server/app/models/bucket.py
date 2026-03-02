"""
Pydantic models for GridFS bucket management.

BucketInfo     — summary representation of a bucket (name, file count, total size).
BucketStats    — detailed statistics including average file size.
BucketCreate   — input model for creating a new (logical) bucket.
"""

from pydantic import BaseModel, Field


class BucketInfo(BaseModel):
    """Summary representation of a GridFS bucket."""

    name: str = Field(..., description="Bucket name (prefix for .files/.chunks collections)")
    file_count: int = Field(..., ge=0, description="Number of files in the bucket")
    total_size: int = Field(..., ge=0, description="Total size of all files in bytes")


class BucketStats(BaseModel):
    """Detailed statistics for a single GridFS bucket."""

    name: str
    file_count: int = Field(..., ge=0)
    total_size: int = Field(..., ge=0, description="Total size of all files in bytes")
    avg_file_size: float = Field(..., ge=0, description="Average file size in bytes")


class BucketCreate(BaseModel):
    """Input model for creating a new GridFS bucket."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=128,
        pattern=r"^[a-zA-Z0-9_\-]+$",
        description="Bucket name (alphanumeric, underscores, hyphens only)",
    )
