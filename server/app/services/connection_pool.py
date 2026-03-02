"""
Singleton connection-pool manager for MongoDB (Motor) clients.

Maintains a dictionary of ``AsyncIOMotorClient`` instances keyed by
connection ID.  Clients are created lazily via :meth:`connect` and
torn down individually via :meth:`disconnect` or globally via
:meth:`close_all` (used during application shutdown).
"""

import logging
import time

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.services.connection_store import ConnectionStore

logger = logging.getLogger(__name__)


class ConnectionPool:
    """Manages a pool of Motor async MongoDB clients keyed by connection ID.

    This class follows the singleton pattern — use :meth:`get_instance` to
    obtain the single global pool instance.
    """

    _instance: "ConnectionPool | None" = None

    def __init__(self) -> None:
        self._clients: dict[str, AsyncIOMotorClient] = {}
        self._store = ConnectionStore()

    @classmethod
    def get_instance(cls) -> "ConnectionPool":
        """Return the singleton pool instance, creating it on first call."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset the singleton (primarily useful in tests)."""
        cls._instance = None

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, conn_id: str) -> None:
        """Look up a stored connection, create a Motor client, and cache it.

        If a client already exists for *conn_id* it is a no-op.

        Raises
        ------
        KeyError
            If the connection ID is not found in the store.
        """
        if conn_id in self._clients:
            logger.debug("Client for connection %s already exists — skipping", conn_id)
            return

        conn_data = await self._store.get(conn_id)  # raises KeyError if missing
        uri = conn_data["uri"]
        tls = conn_data.get("tls", False)
        tls_ca_file = conn_data.get("tls_ca_file")

        # Atlas SRV URIs require TLS — enable it automatically
        if uri.startswith("mongodb+srv://"):
            tls = True

        kwargs: dict = {}
        if tls:
            kwargs["tls"] = True
        if tls and tls_ca_file:
            kwargs["tlsCAFile"] = tls_ca_file

        client = AsyncIOMotorClient(uri, **kwargs)
        self._clients[conn_id] = client
        logger.info("Connected client for connection %s ('%s')", conn_id, conn_data["name"])

    async def disconnect(self, conn_id: str) -> None:
        """Close and remove the Motor client for *conn_id*.

        Raises
        ------
        KeyError
            If no active client exists for the connection ID.
        """
        client = self._clients.pop(conn_id, None)
        if client is None:
            raise KeyError(f"No active client for connection '{conn_id}'")
        client.close()
        logger.info("Disconnected client for connection %s", conn_id)

    def get_client(self, conn_id: str) -> AsyncIOMotorClient:
        """Return the active Motor client for *conn_id*.

        Raises
        ------
        KeyError
            If the connection has not been established via :meth:`connect`.
        """
        if conn_id not in self._clients:
            raise KeyError(
                f"No active client for connection '{conn_id}'. "
                "Call connect() first."
            )
        return self._clients[conn_id]

    def get_database(self, conn_id: str, db_name: str) -> AsyncIOMotorDatabase:
        """Shorthand to obtain a database handle from an active client.

        Raises
        ------
        KeyError
            If the connection has not been established via :meth:`connect`.
        """
        client = self.get_client(conn_id)
        return client[db_name]

    def is_connected(self, conn_id: str) -> bool:
        """Return ``True`` if an active client exists for *conn_id*."""
        return conn_id in self._clients

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    async def test_connection(self, conn_id: str) -> dict:
        """Test connectivity by issuing a ``ping`` command.

        If the connection was not previously established it is created
        temporarily and torn down after the test.

        Returns
        -------
        dict
            ``{"ok": True, "latency_ms": <float>}`` on success, or
            ``{"ok": False, "error": "<message>"}`` on failure.
        """
        was_connected = self.is_connected(conn_id)

        try:
            if not was_connected:
                await self.connect(conn_id)

            client = self.get_client(conn_id)
            start = time.monotonic()
            result = await client.admin.command("ping")
            latency_ms = round((time.monotonic() - start) * 1000, 2)

            if result.get("ok") != 1:
                return {"ok": False, "error": "ping returned non-ok response"}

            return {"ok": True, "latency_ms": latency_ms}

        except Exception as exc:
            logger.warning("Connection test failed for %s: %s", conn_id, exc)
            return {"ok": False, "error": str(exc)}

        finally:
            # Tear down the temporary client if it was not connected before
            if not was_connected and self.is_connected(conn_id):
                try:
                    await self.disconnect(conn_id)
                except Exception:
                    pass

    async def list_databases(self, conn_id: str) -> list[str]:
        """List database names on the MongoDB server for *conn_id*.

        The connection must already be established via :meth:`connect`.

        Raises
        ------
        KeyError
            If no active client exists for the connection ID.
        """
        client = self.get_client(conn_id)
        return await client.list_database_names()

    async def close_all(self) -> None:
        """Close every active Motor client.  Used during app shutdown."""
        ids = list(self._clients.keys())
        for conn_id in ids:
            try:
                client = self._clients.pop(conn_id)
                client.close()
                logger.info("Closed client for connection %s", conn_id)
            except Exception as exc:
                logger.warning("Error closing client %s: %s", conn_id, exc)
        logger.info("All connection-pool clients closed")
