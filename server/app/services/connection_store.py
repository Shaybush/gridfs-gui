"""
Persistent connection store backed by an encrypted JSON file.

Connections are stored at ``{DATA_DIR}/connections.json``.  The ``uri``
field of each connection is encrypted at rest using the AES-256-GCM
encryption service.  All public methods return :class:`ConnectionResponse`
objects whose URIs are masked so that passwords are never leaked to the
frontend.
"""

import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.config import get_settings
from app.models.connection import ConnectionCreate, ConnectionResponse, ConnectionUpdate
from app.services.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)


def mask_uri(uri: str) -> str:
    """Mask the password portion of a MongoDB connection URI.

    Examples
    --------
    >>> mask_uri("mongodb+srv://admin:s3cret@cluster0.example.net/mydb")
    'mongodb+srv://admin:****@cluster0.example.net/mydb'

    >>> mask_uri("mongodb://localhost:27017")
    'mongodb://localhost:27017'
    """
    # Pattern: scheme://user:password@host...
    return re.sub(
        r"(mongodb(?:\+srv)?://)([^:]+):([^@]+)@",
        r"\1\2:****@",
        uri,
    )


class ConnectionStore:
    """Manages CRUD operations for stored MongoDB connections.

    Thread-safety is guaranteed via an :class:`asyncio.Lock` that
    serializes all file read/write operations.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._data_dir = Path(settings.DATA_DIR)
        self._file_path = self._data_dir / "connections.json"
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_file(self) -> None:
        """Create the data directory and connections file if they do not exist."""
        self._data_dir.mkdir(parents=True, exist_ok=True)
        if not self._file_path.exists():
            self._file_path.write_text("[]", encoding="utf-8")

    def _read_all_raw(self) -> list[dict]:
        """Read and parse the JSON file.  URIs remain encrypted."""
        self._ensure_file()
        text = self._file_path.read_text(encoding="utf-8")
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Corrupted connections file — resetting to empty list")
            data = []
            self._write_all_raw(data)
        return data

    def _write_all_raw(self, connections: list[dict]) -> None:
        """Atomically write the connections list to disk."""
        tmp_path = self._file_path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(connections, indent=2), encoding="utf-8")
        os.replace(str(tmp_path), str(self._file_path))

    @staticmethod
    def _to_response(record: dict) -> ConnectionResponse:
        """Convert an internal record (with encrypted URI) to a safe response."""
        decrypted_uri = decrypt(record["uri"])
        return ConnectionResponse(
            id=record["id"],
            name=record["name"],
            uri_masked=mask_uri(decrypted_uri),
            tls=record.get("tls", False),
            created_at=record["created_at"],
            updated_at=record["updated_at"],
        )

    def _find_index(self, connections: list[dict], conn_id: str) -> int:
        """Return the list index for the given connection ID, or raise."""
        try:
            return next(i for i, c in enumerate(connections) if c["id"] == conn_id)
        except StopIteration:
            raise KeyError(f"Connection '{conn_id}' not found")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def list_all(self) -> list[ConnectionResponse]:
        """Return all stored connections with masked URIs."""
        async with self._lock:
            records = self._read_all_raw()
        return [self._to_response(r) for r in records]

    async def get(self, conn_id: str) -> dict:
        """Return the full connection record with the URI **decrypted**.

        This is intended for internal use only (e.g., by the connection
        pool) and must never be exposed directly to the frontend.

        Returns
        -------
        dict
            Keys: id, name, uri (plaintext), tls, tls_ca_file,
            created_at, updated_at.

        Raises
        ------
        KeyError
            If the connection ID does not exist.
        """
        async with self._lock:
            records = self._read_all_raw()
            idx = self._find_index(records, conn_id)
            record = records[idx].copy()

        record["uri"] = decrypt(record["uri"])
        return record

    async def create(self, data: ConnectionCreate) -> ConnectionResponse:
        """Create a new connection entry and persist it."""
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": str(uuid.uuid4()),
            "name": data.name,
            "uri": encrypt(data.uri),
            "tls": data.tls,
            "tls_ca_file": data.tls_ca_file,
            "created_at": now,
            "updated_at": now,
        }

        async with self._lock:
            records = self._read_all_raw()
            records.append(record)
            self._write_all_raw(records)

        logger.info("Created connection '%s' (id=%s)", data.name, record["id"])
        return self._to_response(record)

    async def update(self, conn_id: str, data: ConnectionUpdate) -> ConnectionResponse:
        """Update an existing connection.  Only non-None fields are applied.

        Raises
        ------
        KeyError
            If the connection ID does not exist.
        """
        async with self._lock:
            records = self._read_all_raw()
            idx = self._find_index(records, conn_id)
            record = records[idx]

            updates = data.model_dump(exclude_none=True)
            if not updates:
                return self._to_response(record)

            # Re-encrypt URI if it was updated
            if "uri" in updates:
                updates["uri"] = encrypt(updates["uri"])

            record.update(updates)
            record["updated_at"] = datetime.now(timezone.utc).isoformat()
            records[idx] = record
            self._write_all_raw(records)

        logger.info("Updated connection id=%s (fields: %s)", conn_id, list(updates.keys()))
        return self._to_response(record)

    async def delete(self, conn_id: str) -> None:
        """Remove a connection from the store.

        Raises
        ------
        KeyError
            If the connection ID does not exist.
        """
        async with self._lock:
            records = self._read_all_raw()
            idx = self._find_index(records, conn_id)
            removed = records.pop(idx)
            self._write_all_raw(records)

        logger.info("Deleted connection '%s' (id=%s)", removed["name"], conn_id)
