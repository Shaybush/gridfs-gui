"""
Connection management API routes.

All endpoints are mounted under ``/api/v1/connections`` via the parent
router.  They expose CRUD operations for stored MongoDB connections as
well as utilities for testing connectivity and listing databases.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.connection import ConnectionCreate, ConnectionResponse, ConnectionUpdate
from app.services.connection_pool import ConnectionPool
from app.services.connection_store import ConnectionStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/connections", tags=["connections"])


# ---------------------------------------------------------------------------
# Dependency injection helpers
# ---------------------------------------------------------------------------

def get_connection_store() -> ConnectionStore:
    """FastAPI dependency that returns a ConnectionStore instance."""
    return ConnectionStore()


def get_connection_pool() -> ConnectionPool:
    """FastAPI dependency that returns the singleton ConnectionPool."""
    return ConnectionPool.get_instance()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[ConnectionResponse],
    summary="List all connections",
)
async def list_connections(
    store: ConnectionStore = Depends(get_connection_store),
) -> list[ConnectionResponse]:
    """Return all stored connections with masked URIs."""
    return await store.list_all()


@router.post(
    "/",
    response_model=ConnectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new connection",
)
async def create_connection(
    data: ConnectionCreate,
    store: ConnectionStore = Depends(get_connection_store),
) -> ConnectionResponse:
    """Persist a new MongoDB connection entry."""
    return await store.create(data)


@router.put(
    "/{conn_id}",
    response_model=ConnectionResponse,
    summary="Update an existing connection",
)
async def update_connection(
    conn_id: str,
    data: ConnectionUpdate,
    store: ConnectionStore = Depends(get_connection_store),
    pool: ConnectionPool = Depends(get_connection_pool),
) -> ConnectionResponse:
    """Update fields on an existing connection.

    If the connection URI is changed and the connection is currently
    active in the pool, it will be disconnected so a fresh client is
    created on next use.
    """
    try:
        result = await store.update(conn_id, data)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{conn_id}' not found",
        )

    # If the URI was updated and the connection is active, disconnect
    # so that the pool picks up the new URI on next connect().
    if data.uri is not None and pool.is_connected(conn_id):
        try:
            await pool.disconnect(conn_id)
        except Exception:
            pass

    return result


@router.delete(
    "/{conn_id}",
    summary="Delete a connection",
)
async def delete_connection(
    conn_id: str,
    store: ConnectionStore = Depends(get_connection_store),
    pool: ConnectionPool = Depends(get_connection_pool),
) -> dict:
    """Remove a stored connection and disconnect from pool if active."""
    # Disconnect from pool first (if connected)
    if pool.is_connected(conn_id):
        try:
            await pool.disconnect(conn_id)
        except Exception as exc:
            logger.warning("Error disconnecting %s during delete: %s", conn_id, exc)

    try:
        await store.delete(conn_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{conn_id}' not found",
        )

    return {"detail": "Connection deleted"}


@router.post(
    "/test-all",
    summary="Test all connections",
)
async def test_all_connections(
    store: ConnectionStore = Depends(get_connection_store),
    pool: ConnectionPool = Depends(get_connection_pool),
) -> dict:
    """Test all stored connections in parallel.

    Returns ``{"results": {"<conn_id>": {"ok": bool, "latency_ms": float}, ...}}``
    """
    connections = await store.list_all()
    if not connections:
        return {"results": {}}

    async def _test(conn_id: str) -> tuple[str, dict]:
        result = await pool.test_connection(conn_id)
        return conn_id, result

    outcomes = await asyncio.gather(
        *(_test(c.id) for c in connections),
        return_exceptions=True,
    )

    results = {}
    for outcome in outcomes:
        if isinstance(outcome, Exception):
            continue
        conn_id, result = outcome
        results[conn_id] = result

    return {"results": results}


@router.post(
    "/{conn_id}/test",
    summary="Test a connection",
)
async def test_connection(
    conn_id: str,
    store: ConnectionStore = Depends(get_connection_store),
    pool: ConnectionPool = Depends(get_connection_pool),
) -> dict:
    """Ping the MongoDB server to verify connectivity.

    Returns ``{"ok": true, "latency_ms": <float>}`` on success or
    ``{"ok": false, "error": "<message>"}`` on failure.
    """
    try:
        await store.get(conn_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{conn_id}' not found",
        )

    return await pool.test_connection(conn_id)


@router.get(
    "/{conn_id}/databases",
    summary="List databases for a connection",
)
async def list_databases(
    conn_id: str,
    store: ConnectionStore = Depends(get_connection_store),
    pool: ConnectionPool = Depends(get_connection_pool),
) -> dict:
    """List all database names on the MongoDB server.

    Connects automatically if the connection is not already active in
    the pool.
    """
    # Verify the connection exists
    try:
        await store.get(conn_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{conn_id}' not found",
        )

    # Connect if not already connected
    if not pool.is_connected(conn_id):
        try:
            await pool.connect(conn_id)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to connect: {exc}",
            )

    try:
        databases = await pool.list_databases(conn_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list databases: {exc}",
        )

    return {"databases": databases}
