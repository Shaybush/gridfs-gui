"""Shared FastAPI dependency injection helpers for bucket and file routes."""

from fastapi import Depends, HTTPException, status

from app.services.connection_pool import ConnectionPool
from app.services.connection_store import ConnectionStore
from app.services.gridfs_service import GridFSService


def get_connection_store() -> ConnectionStore:
    return ConnectionStore()


def get_connection_pool() -> ConnectionPool:
    return ConnectionPool.get_instance()


def get_gridfs_service() -> GridFSService:
    return GridFSService()


async def ensure_connected(
    conn_id: str,
    store: ConnectionStore = Depends(get_connection_store),
    pool: ConnectionPool = Depends(get_connection_pool),
) -> None:
    """Verify the connection exists and is active, auto-connecting if needed."""
    try:
        await store.get(conn_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{conn_id}' not found",
        )

    if not pool.is_connected(conn_id):
        try:
            await pool.connect(conn_id)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to connect: {exc}",
            )
