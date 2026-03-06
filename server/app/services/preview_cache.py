"""In-memory LRU cache for converted document previews.

Stores converted PDF/HTML bytes keyed by ``file_id:upload_date`` with
configurable max size (MB) and TTL (seconds).  Uses an ``OrderedDict``
for LRU eviction and an ``asyncio.Lock`` for thread safety.
"""

import asyncio
import logging
import time
from collections import OrderedDict

from app.config import get_settings

logger = logging.getLogger(__name__)


class PreviewCache:
    """Singleton, async-safe, size- and TTL-bounded preview cache."""

    _instance: "PreviewCache | None" = None

    def __init__(self) -> None:
        settings = get_settings()
        self._max_bytes: int = settings.PREVIEW_CACHE_MAX_MB * 1024 * 1024
        self._ttl: int = settings.PREVIEW_CACHE_TTL_SECONDS
        self._store: OrderedDict[str, dict] = OrderedDict()
        self._total_size: int = 0
        self._lock: asyncio.Lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Singleton
    # ------------------------------------------------------------------

    @classmethod
    def get_instance(cls) -> "PreviewCache":
        """Return the singleton ``PreviewCache`` instance."""
        if cls._instance is None:
            cls._instance = PreviewCache()
        return cls._instance

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get(self, file_id: str, upload_date: str) -> bytes | None:
        """Retrieve cached preview data.

        Args:
            file_id: The GridFS file id.
            upload_date: ISO-formatted upload date string.

        Returns:
            Cached bytes, or ``None`` on cache miss / expiry.
        """
        key = self._make_key(file_id, upload_date)
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None

            # Check TTL
            if time.monotonic() - entry["timestamp"] > self._ttl:
                logger.debug("Cache entry expired for %s", key)
                self._remove(key)
                return None

            # Move to end (most recently used)
            self._store.move_to_end(key)
            logger.debug("Cache hit for %s (%d bytes)", key, entry["size"])
            return entry["data"]

    async def set(self, file_id: str, upload_date: str, data: bytes) -> None:
        """Store converted preview data in the cache.

        Evicts oldest entries if the total cache size would exceed the
        configured maximum.

        Args:
            file_id: The GridFS file id.
            upload_date: ISO-formatted upload date string.
            data: The converted preview bytes (PDF or HTML).
        """
        key = self._make_key(file_id, upload_date)
        size = len(data)

        async with self._lock:
            # If key already exists, remove old entry first
            if key in self._store:
                self._remove(key)

            # Evict oldest entries until we have room
            while self._store and (self._total_size + size) > self._max_bytes:
                oldest_key, oldest_entry = self._store.popitem(last=False)
                self._total_size -= oldest_entry["size"]
                logger.debug("Evicted cache entry %s (%d bytes)", oldest_key, oldest_entry["size"])

            self._store[key] = {
                "data": data,
                "timestamp": time.monotonic(),
                "size": size,
            }
            self._total_size += size
            logger.debug(
                "Cached %s (%d bytes, total %d bytes)",
                key, size, self._total_size,
            )

    async def clear(self) -> None:
        """Remove all entries from the cache."""
        async with self._lock:
            self._store.clear()
            self._total_size = 0
            logger.info("Preview cache cleared")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make_key(file_id: str, upload_date: str) -> str:
        return f"{file_id}:{upload_date}"

    def _remove(self, key: str) -> None:
        """Remove a single entry (caller must hold the lock)."""
        entry = self._store.pop(key, None)
        if entry is not None:
            self._total_size -= entry["size"]
