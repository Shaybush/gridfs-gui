"""
Bucket management API routes.

All endpoints are mounted under
``/api/v1/connections/{conn_id}/databases/{db_name}/buckets`` via the
parent router.  They expose operations for discovering, creating,
inspecting, renaming, deleting, and exporting GridFS buckets within a
given database.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.api.deps import ensure_connected, get_gridfs_service
from app.models.bucket import BucketCreate, BucketInfo, BucketRename, BucketStats
from app.services.gridfs_service import GridFSService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/connections/{conn_id}/databases/{db_name}/buckets",
    tags=["buckets"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[BucketInfo],
    summary="List all GridFS buckets",
)
async def list_buckets(
    conn_id: str,
    db_name: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> list[BucketInfo]:
    """Discover all GridFS buckets in the database by scanning for
    collections ending in ``.files``."""
    try:
        return await svc.list_buckets(conn_id, db_name)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection is not active",
        )
    except Exception as exc:
        logger.exception("Error listing buckets: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list buckets: {exc}",
        )


@router.post(
    "/",
    response_model=BucketInfo,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new GridFS bucket",
)
async def create_bucket(
    conn_id: str,
    db_name: str,
    data: BucketCreate,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> BucketInfo:
    """Create a new GridFS bucket by initialising its ``.files`` and
    ``.chunks`` collections with the required indexes."""
    try:
        return await svc.create_bucket(conn_id, db_name, data.name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Error creating bucket: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create bucket: {exc}",
        )


@router.get(
    "/{bucket_name}/stats",
    response_model=BucketStats,
    summary="Get bucket statistics",
)
async def get_bucket_stats(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> BucketStats:
    """Return detailed statistics for a single GridFS bucket."""
    try:
        return await svc.get_bucket_stats(conn_id, db_name, bucket_name)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bucket '{bucket_name}' not found",
        )
    except Exception as exc:
        logger.exception("Error getting bucket stats: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bucket stats: {exc}",
        )


@router.delete(
    "/{bucket_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a GridFS bucket",
)
async def delete_bucket(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    confirm: bool = Query(
        default=False,
        description="Safety flag — must be true to proceed with deletion",
    ),
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> None:
    """Delete a GridFS bucket (requires ``?confirm=true`` as a safeguard)."""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required query parameter: ?confirm=true",
        )

    try:
        await svc.delete_bucket(conn_id, db_name, bucket_name)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bucket '{bucket_name}' not found",
        )
    except Exception as exc:
        logger.exception("Error deleting bucket: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete bucket: {exc}",
        )


@router.put(
    "/{bucket_name}",
    response_model=BucketInfo,
    summary="Rename a GridFS bucket",
)
async def rename_bucket(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    data: BucketRename,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> BucketInfo:
    """Rename a GridFS bucket by renaming both its ``.files`` and ``.chunks``
    collections via the MongoDB ``renameCollection`` command."""
    try:
        return await svc.rename_bucket(conn_id, db_name, bucket_name, data.new_name)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bucket '{bucket_name}' not found",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Error renaming bucket: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rename bucket: {exc}",
        )


@router.post(
    "/{bucket_name}/export",
    summary="Export all files in a bucket as a ZIP archive",
    response_class=Response,
)
async def export_bucket(
    conn_id: str,
    db_name: str,
    bucket_name: str,
    _: None = Depends(ensure_connected),
    svc: GridFSService = Depends(get_gridfs_service),
) -> Response:
    """Export every file in the specified GridFS bucket as a single ZIP archive."""
    try:
        zip_bytes = await svc.export_bucket_zip(conn_id, db_name, bucket_name)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bucket '{bucket_name}' not found",
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Error exporting bucket: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export bucket: {exc}",
        )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{bucket_name}.zip"',
            "Content-Length": str(len(zip_bytes)),
        },
    )
