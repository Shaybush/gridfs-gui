"""
GridFS service — wraps Motor's AsyncIOMotorGridFSBucket operations.

Provides high-level methods for bucket discovery, file listing (paginated),
upload (streaming), download (streaming), metadata retrieval, and deletion.
All methods accept a ``conn_id`` and ``db_name`` and obtain the database
handle from the singleton :class:`ConnectionPool`.
"""

import io
import logging
import math
import re
import zipfile
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket

from app.models.bucket import BucketInfo, BucketStats
from app.models.file import FileCopyMoveResponse, FileInfo, FileListResponse, FileUploadResponse
from app.services.connection_pool import ConnectionPool
from app.services.content_type import detect_content_type

logger = logging.getLogger(__name__)


def _parse_object_id(file_id: str) -> ObjectId:
    """Convert a hex string to an ObjectId, raising ValueError on failure."""
    try:
        return ObjectId(file_id)
    except (InvalidId, TypeError) as exc:
        raise ValueError(f"Invalid file ID '{file_id}': {exc}") from exc


class GridFSService:
    """Stateless service for GridFS operations.

    Each method resolves its own database handle from the connection pool
    so there is no long-lived state to manage.
    """

    def __init__(self) -> None:
        self._pool = ConnectionPool.get_instance()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_db(self, conn_id: str, db_name: str) -> AsyncIOMotorDatabase:
        """Return a Motor database handle, raising KeyError if not connected."""
        return self._pool.get_database(conn_id, db_name)

    def _get_bucket(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str = "fs",
    ) -> AsyncIOMotorGridFSBucket:
        """Return a GridFSBucket handle for the given bucket prefix."""
        db = self._get_db(conn_id, db_name)
        return AsyncIOMotorGridFSBucket(db, bucket_name=bucket_name)

    async def _ensure_bucket_exists(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
    ) -> AsyncIOMotorDatabase:
        """Return the database handle after verifying the bucket exists.

        Raises KeyError if ``<bucket_name>.files`` is not found.
        """
        db = self._get_db(conn_id, db_name)
        collection_names = await db.list_collection_names()
        if f"{bucket_name}.files" not in collection_names:
            raise KeyError(f"Bucket '{bucket_name}' not found in database '{db_name}'")
        return db

    async def _get_bucket_file_stats(
        self,
        db: AsyncIOMotorDatabase,
        bucket_name: str,
    ) -> dict[str, int]:
        """Return ``{"count": N, "total_size": N}`` for a bucket's files collection."""
        files_col = db[f"{bucket_name}.files"]
        pipeline = [
            {"$group": {"_id": None, "count": {"$sum": 1}, "total_size": {"$sum": "$length"}}},
        ]
        result = await files_col.aggregate(pipeline).to_list(1)
        return result[0] if result else {"count": 0, "total_size": 0}

    @staticmethod
    def _deduplicate_filename(filename: str, seen_names: dict[str, int]) -> str:
        """Return a unique filename by appending a numeric suffix on collision."""
        if filename in seen_names:
            seen_names[filename] += 1
            name_parts = filename.rsplit(".", 1)
            if len(name_parts) == 2:
                return f"{name_parts[0]}_{seen_names[filename]}.{name_parts[1]}"
            return f"{filename}_{seen_names[filename]}"
        seen_names[filename] = 0
        return filename

    @staticmethod
    def _doc_to_file_info(doc: dict) -> FileInfo:
        """Convert a raw MongoDB ``.files`` document to a FileInfo model."""
        # content_type may live at the top-level (legacy) or inside metadata
        meta = doc.get("metadata") or {}
        content_type = doc.get("contentType") or meta.get("contentType")
        if not content_type:
            content_type = detect_content_type(doc.get("filename", ""))
        return FileInfo(
            id=str(doc["_id"]),
            filename=doc.get("filename", ""),
            length=doc.get("length", 0),
            content_type=content_type,
            upload_date=doc.get("uploadDate", datetime.now(timezone.utc)),
            metadata=doc.get("metadata"),
            chunk_size=doc.get("chunkSize", 0),
        )

    # ------------------------------------------------------------------
    # Bucket operations
    # ------------------------------------------------------------------

    async def list_buckets(
        self,
        conn_id: str,
        db_name: str,
    ) -> list[BucketInfo]:
        """Discover GridFS buckets by scanning for ``*.files`` collections.

        Returns a list of :class:`BucketInfo` with file count and total size
        for each bucket.
        """
        db = self._get_db(conn_id, db_name)
        collection_names = await db.list_collection_names()

        # Identify bucket prefixes from collections ending in ".files"
        bucket_names: list[str] = sorted(
            name.removesuffix(".files")
            for name in collection_names
            if name.endswith(".files")
        )

        buckets: list[BucketInfo] = []
        for name in bucket_names:
            stats = await self._get_bucket_file_stats(db, name)
            buckets.append(
                BucketInfo(name=name, file_count=stats["count"], total_size=stats["total_size"])
            )

        return buckets

    async def get_bucket_stats(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
    ) -> BucketStats:
        """Return detailed statistics for a single GridFS bucket.

        Raises KeyError if the bucket does not exist.
        """
        db = await self._ensure_bucket_exists(conn_id, db_name, bucket_name)

        files_col = db[f"{bucket_name}.files"]
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "total_size": {"$sum": "$length"},
                    "avg_size": {"$avg": "$length"},
                },
            },
        ]
        result = await files_col.aggregate(pipeline).to_list(1)

        if result:
            return BucketStats(
                name=bucket_name,
                file_count=result[0]["count"],
                total_size=result[0]["total_size"],
                avg_file_size=round(result[0]["avg_size"], 2),
            )

        return BucketStats(
            name=bucket_name,
            file_count=0,
            total_size=0,
            avg_file_size=0.0,
        )

    async def create_bucket(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
    ) -> BucketInfo:
        """Create a new GridFS bucket by initialising its collections.

        GridFS buckets are created implicitly on first upload, but this
        method ensures the ``.files`` and ``.chunks`` collections exist
        immediately (with indexes) so that the bucket shows up in
        :meth:`list_buckets` before any files are uploaded.
        """
        db = self._get_db(conn_id, db_name)

        # Check if the bucket already exists
        collection_names = await db.list_collection_names()
        if f"{bucket_name}.files" in collection_names:
            raise ValueError(f"Bucket '{bucket_name}' already exists")

        # Create the collections explicitly
        await db.create_collection(f"{bucket_name}.files")
        await db.create_collection(f"{bucket_name}.chunks")

        # Create the standard GridFS indexes
        files_col = db[f"{bucket_name}.files"]
        chunks_col = db[f"{bucket_name}.chunks"]
        await files_col.create_index([("filename", 1), ("uploadDate", 1)])
        await chunks_col.create_index([("files_id", 1), ("n", 1)], unique=True)

        # Additional indexes for search & filter performance
        await files_col.create_index("filename")
        await files_col.create_index("contentType")
        await files_col.create_index("uploadDate")
        await files_col.create_index("length")

        logger.info("Created bucket '%s' in db '%s' for connection %s", bucket_name, db_name, conn_id)
        return BucketInfo(name=bucket_name, file_count=0, total_size=0)

    async def delete_bucket(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
    ) -> None:
        """Delete a GridFS bucket by dropping its ``.files`` and ``.chunks`` collections.

        Raises KeyError if the bucket does not exist.
        """
        db = await self._ensure_bucket_exists(conn_id, db_name, bucket_name)

        await db.drop_collection(f"{bucket_name}.files")
        await db.drop_collection(f"{bucket_name}.chunks")

        logger.info(
            "Deleted bucket '%s' from db '%s' for connection %s",
            bucket_name, db_name, conn_id,
        )

    async def rename_bucket(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        new_name: str,
    ) -> BucketInfo:
        """Rename a GridFS bucket via the MongoDB ``renameCollection`` command.

        Raises KeyError if the source bucket does not exist, or ValueError
        if the target name is already taken.
        """
        db = await self._ensure_bucket_exists(conn_id, db_name, bucket_name)

        collection_names = await db.list_collection_names()
        if f"{new_name}.files" in collection_names:
            raise ValueError(f"Bucket '{new_name}' already exists in database '{db_name}'")

        admin_db = self._pool.get_client(conn_id).admin
        await admin_db.command(
            "renameCollection",
            f"{db_name}.{bucket_name}.files",
            to=f"{db_name}.{new_name}.files",
        )
        await admin_db.command(
            "renameCollection",
            f"{db_name}.{bucket_name}.chunks",
            to=f"{db_name}.{new_name}.chunks",
        )

        stats = await self._get_bucket_file_stats(db, new_name)

        logger.info(
            "Renamed bucket '%s' to '%s' in db '%s' for connection %s",
            bucket_name, new_name, db_name, conn_id,
        )

        return BucketInfo(name=new_name, file_count=stats["count"], total_size=stats["total_size"])

    async def export_bucket_zip(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
    ) -> bytes:
        """Export all files in a GridFS bucket as an in-memory ZIP archive.

        Raises KeyError if the bucket does not exist, or FileNotFoundError
        if the bucket has no files.
        """
        db = await self._ensure_bucket_exists(conn_id, db_name, bucket_name)

        file_docs = await db[f"{bucket_name}.files"].find({}).to_list(None)
        if not file_docs:
            raise FileNotFoundError(f"Bucket '{bucket_name}' has no files to export")

        bucket = self._get_bucket(conn_id, db_name, bucket_name)
        buf = io.BytesIO()
        seen_names: dict[str, int] = {}

        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for doc in file_docs:
                file_id = doc["_id"]
                filename = self._deduplicate_filename(
                    doc.get("filename", str(file_id)), seen_names,
                )

                try:
                    grid_out = await bucket.open_download_stream(file_id)
                    file_buf = bytearray()
                    while True:
                        chunk = await grid_out.read(256 * 1024)
                        if not chunk:
                            break
                        file_buf.extend(chunk)
                    zf.writestr(filename, bytes(file_buf))
                except Exception as exc:
                    logger.warning(
                        "Skipping file '%s' (id=%s) during bucket export: %s",
                        filename, file_id, exc,
                    )

        logger.info(
            "Exported bucket '%s' from db '%s': %d files archived",
            bucket_name, db_name, len(file_docs),
        )

        buf.seek(0)
        return buf.read()

    # ------------------------------------------------------------------
    # File listing
    # ------------------------------------------------------------------

    @staticmethod
    def _build_file_query(
        *,
        search: Optional[str] = None,
        content_type: Optional[str] = None,
        uploaded_after: Optional[datetime] = None,
        uploaded_before: Optional[datetime] = None,
        min_size: Optional[int] = None,
        max_size: Optional[int] = None,
        metadata_key: Optional[str] = None,
        metadata_value: Optional[str] = None,
    ) -> dict[str, Any]:
        """Build a MongoDB query dict from optional filter parameters."""
        query: dict[str, Any] = {}

        if search is not None:
            query["filename"] = {"$regex": search, "$options": "i"}

        if content_type is not None:
            escaped = re.escape(content_type)
            query["contentType"] = {"$regex": f"^{escaped}"}

        if uploaded_after is not None or uploaded_before is not None:
            date_filter: dict[str, datetime] = {}
            if uploaded_after is not None:
                date_filter["$gte"] = uploaded_after
            if uploaded_before is not None:
                date_filter["$lte"] = uploaded_before
            query["uploadDate"] = date_filter

        if min_size is not None or max_size is not None:
            size_filter: dict[str, int] = {}
            if min_size is not None:
                size_filter["$gte"] = min_size
            if max_size is not None:
                size_filter["$lte"] = max_size
            query["length"] = size_filter

        if metadata_key is not None and metadata_value is not None:
            query[f"metadata.{metadata_key}"] = metadata_value

        return query

    async def list_files(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        page: int = 1,
        limit: int = 25,
        sort_field: str = "uploadDate",
        sort_order: str = "desc",
        *,
        search: Optional[str] = None,
        content_type: Optional[str] = None,
        uploaded_after: Optional[datetime] = None,
        uploaded_before: Optional[datetime] = None,
        min_size: Optional[int] = None,
        max_size: Optional[int] = None,
        metadata_key: Optional[str] = None,
        metadata_value: Optional[str] = None,
    ) -> FileListResponse:
        """Return a paginated list of files in the given bucket.

        Parameters
        ----------
        page : int
            1-based page number.
        limit : int
            Number of files per page (capped at 100).
        sort_field : str
            MongoDB field name to sort by (e.g. ``uploadDate``, ``filename``, ``length``).
        sort_order : str
            ``"asc"`` or ``"desc"``.
        search : str, optional
            Regex pattern matched against ``filename`` (case-insensitive).
        content_type : str, optional
            Prefix match on ``contentType`` (e.g. ``"image/"``).
        uploaded_after : datetime, optional
            Only files uploaded on or after this timestamp.
        uploaded_before : datetime, optional
            Only files uploaded on or before this timestamp.
        min_size : int, optional
            Minimum file size in bytes.
        max_size : int, optional
            Maximum file size in bytes.
        metadata_key : str, optional
            Custom metadata field name to filter on (requires ``metadata_value``).
        metadata_value : str, optional
            Value for the custom metadata field.
        """
        db = self._get_db(conn_id, db_name)
        files_col = db[f"{bucket_name}.files"]

        # Clamp limit
        limit = min(max(limit, 1), 100)
        skip = (page - 1) * limit

        # Sort direction
        direction = 1 if sort_order == "asc" else -1

        # Build filter query
        query = self._build_file_query(
            search=search,
            content_type=content_type,
            uploaded_after=uploaded_after,
            uploaded_before=uploaded_before,
            min_size=min_size,
            max_size=max_size,
            metadata_key=metadata_key,
            metadata_value=metadata_value,
        )

        # Total count (with filters applied)
        total = await files_col.count_documents(query)
        total_pages = math.ceil(total / limit) if total > 0 else 0

        # Fetch page
        cursor = files_col.find(query).sort(sort_field, direction).skip(skip).limit(limit)
        docs = await cursor.to_list(limit)
        files = [self._doc_to_file_info(doc) for doc in docs]

        return FileListResponse(
            files=files,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )

    # ------------------------------------------------------------------
    # File upload
    # ------------------------------------------------------------------

    async def upload_file(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        filename: str,
        file_stream: AsyncIterator[bytes],
        content_type: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> FileUploadResponse:
        """Stream-upload a file into GridFS.

        Parameters
        ----------
        file_stream
            An async iterator yielding bytes chunks (e.g., ``UploadFile.read()``
            called in a loop, or an async generator).
        content_type
            MIME type to store alongside the file.
        metadata
            Arbitrary key-value metadata to attach.

        Returns
        -------
        FileUploadResponse
            Confirmation with the new file's ID and metadata.
        """
        bucket = self._get_bucket(conn_id, db_name, bucket_name)

        # Build kwargs for upload_from_stream
        kwargs: dict[str, Any] = {}
        if metadata:
            kwargs["metadata"] = metadata

        # Store content_type inside metadata (Motor no longer accepts it as a top-level param)
        if content_type:
            kwargs.setdefault("metadata", {})["contentType"] = content_type

        # Open an upload stream
        upload_stream = bucket.open_upload_stream(
            filename,
            **kwargs,
        )

        try:
            async for chunk in file_stream:
                await upload_stream.write(chunk)
            await upload_stream.close()
        except Exception:
            await upload_stream.abort()
            raise

        file_id = upload_stream._id  # noqa: SLF001 — Motor exposes this after close

        # Fetch the stored document for the response
        db = self._get_db(conn_id, db_name)
        doc = await db[f"{bucket_name}.files"].find_one({"_id": file_id})

        length = doc.get("length", 0) if doc else 0
        upload_date = doc.get("uploadDate", datetime.now(timezone.utc)) if doc else datetime.now(timezone.utc)

        logger.info(
            "Uploaded file '%s' (id=%s, size=%s) to bucket '%s'",
            filename, file_id, length, bucket_name,
        )

        return FileUploadResponse(
            id=str(file_id),
            filename=filename,
            length=length,
            content_type=content_type,
            upload_date=upload_date,
        )

    # ------------------------------------------------------------------
    # File download
    # ------------------------------------------------------------------

    async def download_file(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_id: str,
    ) -> tuple[AsyncIterator[bytes], dict]:
        """Open a download stream for a GridFS file.

        Returns
        -------
        tuple
            ``(async_byte_iterator, file_info_dict)`` where ``file_info_dict``
            contains ``filename``, ``content_type``, and ``length``.

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file ID is malformed.
        """
        oid = _parse_object_id(file_id)
        bucket = self._get_bucket(conn_id, db_name, bucket_name)

        # Look up file metadata first
        db = self._get_db(conn_id, db_name)
        doc = await db[f"{bucket_name}.files"].find_one({"_id": oid})
        if doc is None:
            raise FileNotFoundError(f"File '{file_id}' not found in bucket '{bucket_name}'")

        meta = doc.get("metadata") or {}
        file_info = {
            "filename": doc.get("filename", "download"),
            "content_type": doc.get("contentType") or meta.get("contentType") or detect_content_type(doc.get("filename", "")),
            "length": doc.get("length", 0),
        }

        # Open a GridFS download stream
        grid_out = await bucket.open_download_stream(oid)

        async def _stream() -> AsyncIterator[bytes]:
            """Yield chunks from the GridFS download stream."""
            while True:
                chunk = await grid_out.read(256 * 1024)  # 256 KB chunks
                if not chunk:
                    break
                yield chunk

        return _stream(), file_info

    async def download_file_range(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_id: str,
        start: int,
        end: int,
    ) -> tuple[AsyncIterator[bytes], dict]:
        """Open a download stream for a byte-range of a GridFS file.

        The caller is responsible for validating that *start* and *end* fall
        within the file's length.  This method seeks to *start* and reads
        ``(end - start + 1)`` bytes.

        Parameters
        ----------
        start : int
            First byte position (inclusive, 0-based).
        end : int
            Last byte position (inclusive, 0-based).

        Returns
        -------
        tuple
            ``(async_byte_iterator, file_info_dict)`` where the iterator
            yields only the requested byte range.

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file ID is malformed.
        """
        oid = _parse_object_id(file_id)
        bucket = self._get_bucket(conn_id, db_name, bucket_name)

        # Look up file metadata
        db = self._get_db(conn_id, db_name)
        doc = await db[f"{bucket_name}.files"].find_one({"_id": oid})
        if doc is None:
            raise FileNotFoundError(f"File '{file_id}' not found in bucket '{bucket_name}'")

        meta = doc.get("metadata") or {}
        file_info = {
            "filename": doc.get("filename", "download"),
            "content_type": doc.get("contentType") or meta.get("contentType") or detect_content_type(doc.get("filename", "")),
            "length": doc.get("length", 0),
        }

        # Open stream and seek to start position
        grid_out = await bucket.open_download_stream(oid)
        grid_out.seek(start)

        bytes_to_read = end - start + 1
        chunk_size = 256 * 1024  # 256 KB

        async def _range_stream() -> AsyncIterator[bytes]:
            """Yield chunks covering exactly the requested byte range."""
            remaining = bytes_to_read
            while remaining > 0:
                read_size = min(chunk_size, remaining)
                chunk = await grid_out.read(read_size)
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

        return _range_stream(), file_info

    # ------------------------------------------------------------------
    # File info
    # ------------------------------------------------------------------

    async def get_file_info(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_id: str,
    ) -> FileInfo:
        """Return full metadata for a single GridFS file.

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file ID is malformed.
        """
        oid = _parse_object_id(file_id)
        db = self._get_db(conn_id, db_name)
        doc = await db[f"{bucket_name}.files"].find_one({"_id": oid})

        if doc is None:
            raise FileNotFoundError(f"File '{file_id}' not found in bucket '{bucket_name}'")

        return self._doc_to_file_info(doc)

    # ------------------------------------------------------------------
    # File update
    # ------------------------------------------------------------------

    async def update_file(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_id: str,
        filename: str | None = None,
        metadata: dict | None = None,
    ) -> FileInfo:
        """Update a file's filename and/or metadata in GridFS.

        Directly modifies the ``.files`` collection document using
        ``$set``.  Only the provided fields are updated; omitted fields
        are left unchanged.

        Parameters
        ----------
        filename : str, optional
            New filename to assign.
        metadata : dict, optional
            New metadata dict (replaces existing metadata entirely).

        Returns
        -------
        FileInfo
            The updated file metadata.

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file ID is malformed.
        """
        oid = _parse_object_id(file_id)
        db = self._get_db(conn_id, db_name)
        files_col = db[f"{bucket_name}.files"]

        # Build $set update from provided fields
        update_fields: dict[str, Any] = {}
        if filename is not None:
            update_fields["filename"] = filename
        if metadata is not None:
            update_fields["metadata"] = metadata

        result = await files_col.update_one({"_id": oid}, {"$set": update_fields})
        if result.matched_count == 0:
            raise FileNotFoundError(f"File '{file_id}' not found in bucket '{bucket_name}'")

        updated_doc = await files_col.find_one({"_id": oid})

        logger.info(
            "Updated file '%s' (id=%s) in bucket '%s': fields=%s",
            updated_doc.get("filename", "?"),
            file_id,
            bucket_name,
            list(update_fields.keys()),
        )

        return self._doc_to_file_info(updated_doc)

    # ------------------------------------------------------------------
    # File copy / move
    # ------------------------------------------------------------------

    _COPY_CHUNK_SIZE = 256 * 1024  # 256 KB

    async def copy_file(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_id: str,
        target_bucket: str,
    ) -> FileCopyMoveResponse:
        """Copy a file from one GridFS bucket to another within the same database.

        The file is streamed chunk-by-chunk between the source download stream
        and the target upload stream, so the entire file is never held in memory.
        All metadata (filename, contentType, custom metadata) is preserved.

        Parameters
        ----------
        bucket_name : str
            Source bucket name.
        file_id : str
            ObjectId hex string of the file to copy.
        target_bucket : str
            Destination bucket name.

        Returns
        -------
        FileCopyMoveResponse
            The new file's ID and metadata in the target bucket.

        Raises
        ------
        ValueError
            If the file ID is malformed or target equals source bucket.
        FileNotFoundError
            If the source file does not exist.
        """
        if target_bucket == bucket_name:
            raise ValueError("Target bucket must differ from the source bucket")

        oid = _parse_object_id(file_id)

        # Fetch source file metadata
        db = self._get_db(conn_id, db_name)
        doc = await db[f"{bucket_name}.files"].find_one({"_id": oid})
        if doc is None:
            raise FileNotFoundError(f"File '{file_id}' not found in bucket '{bucket_name}'")

        filename = doc.get("filename", "")
        content_type = doc.get("contentType")
        metadata = doc.get("metadata")

        # Open download stream from source bucket
        source_bucket = self._get_bucket(conn_id, db_name, bucket_name)
        grid_out = await source_bucket.open_download_stream(oid)

        # Open upload stream to target bucket, preserving metadata
        target_bucket_handle = self._get_bucket(conn_id, db_name, target_bucket)
        upload_kwargs: dict[str, Any] = {}
        if metadata:
            upload_kwargs["metadata"] = metadata

        # Store content_type inside metadata (Motor no longer accepts it as a top-level param)
        if content_type:
            upload_kwargs.setdefault("metadata", {})["contentType"] = content_type

        upload_stream = target_bucket_handle.open_upload_stream(
            filename,
            **upload_kwargs,
        )

        try:
            while True:
                chunk = await grid_out.read(self._COPY_CHUNK_SIZE)
                if not chunk:
                    break
                await upload_stream.write(chunk)
            await upload_stream.close()
        except Exception:
            await upload_stream.abort()
            raise

        new_file_id = upload_stream._id  # noqa: SLF001

        # Fetch the stored document for the response
        new_doc = await db[f"{target_bucket}.files"].find_one({"_id": new_file_id})
        length = new_doc.get("length", 0) if new_doc else 0

        logger.info(
            "Copied file '%s' (id=%s) from bucket '%s' to bucket '%s' (new id=%s)",
            filename, file_id, bucket_name, target_bucket, new_file_id,
        )

        return FileCopyMoveResponse(
            id=str(new_file_id),
            filename=filename,
            target_bucket=target_bucket,
            length=length,
        )

    async def move_file(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_id: str,
        target_bucket: str,
    ) -> FileCopyMoveResponse:
        """Move a file from one GridFS bucket to another (copy then delete original).

        Parameters
        ----------
        bucket_name : str
            Source bucket name.
        file_id : str
            ObjectId hex string of the file to move.
        target_bucket : str
            Destination bucket name.

        Returns
        -------
        FileCopyMoveResponse
            The new file's ID and metadata in the target bucket.

        Raises
        ------
        ValueError
            If the file ID is malformed or target equals source bucket.
        FileNotFoundError
            If the source file does not exist.
        """
        result = await self.copy_file(conn_id, db_name, bucket_name, file_id, target_bucket)
        await self.delete_file(conn_id, db_name, bucket_name, file_id)

        logger.info(
            "Moved file '%s' (id=%s) from bucket '%s' to bucket '%s' (new id=%s)",
            result.filename, file_id, bucket_name, target_bucket, result.id,
        )

        return result

    # ------------------------------------------------------------------
    # File deletion
    # ------------------------------------------------------------------

    async def delete_file(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_id: str,
    ) -> None:
        """Delete a file from GridFS (removes both ``.files`` and ``.chunks`` documents).

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file ID is malformed.
        """
        oid = _parse_object_id(file_id)

        # Verify file exists before attempting deletion
        db = self._get_db(conn_id, db_name)
        doc = await db[f"{bucket_name}.files"].find_one({"_id": oid})
        if doc is None:
            raise FileNotFoundError(f"File '{file_id}' not found in bucket '{bucket_name}'")

        bucket = self._get_bucket(conn_id, db_name, bucket_name)
        await bucket.delete(oid)

        logger.info(
            "Deleted file '%s' (id=%s) from bucket '%s'",
            doc.get("filename", "?"),
            file_id,
            bucket_name,
        )

    # ------------------------------------------------------------------
    # Bulk operations
    # ------------------------------------------------------------------

    async def bulk_delete(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_ids: list[str],
    ) -> tuple[int, list[str]]:
        """Delete multiple files from GridFS.

        Iterates through each file ID, attempting deletion individually.
        Continues on per-file errors so that one bad ID does not block the
        rest of the batch.

        Returns
        -------
        tuple[int, list[str]]
            ``(deleted_count, error_messages)``
        """
        deleted = 0
        errors: list[str] = []

        for file_id in file_ids:
            try:
                await self.delete_file(conn_id, db_name, bucket_name, file_id)
                deleted += 1
            except ValueError as exc:
                errors.append(f"{file_id}: {exc}")
            except FileNotFoundError:
                errors.append(f"{file_id}: File not found")
            except Exception as exc:
                logger.exception("Unexpected error deleting file '%s': %s", file_id, exc)
                errors.append(f"{file_id}: {exc}")

        logger.info(
            "Bulk delete in bucket '%s': %d deleted, %d errors",
            bucket_name,
            deleted,
            len(errors),
        )
        return deleted, errors

    async def bulk_download_zip(
        self,
        conn_id: str,
        db_name: str,
        bucket_name: str,
        file_ids: list[str],
    ) -> bytes:
        """Create an in-memory ZIP archive containing the requested GridFS files.

        Each file is read fully from GridFS and written into the ZIP under
        its original filename.  If multiple files share the same name, a
        numeric suffix is appended to avoid collisions.

        Returns
        -------
        bytes
            The raw ZIP archive bytes, ready to be sent as a response body.

        Raises
        ------
        ValueError
            If any file ID is malformed.
        FileNotFoundError
            If none of the requested files exist.
        """
        buf = io.BytesIO()
        seen_names: dict[str, int] = {}
        files_added = 0
        errors: list[str] = []

        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for file_id in file_ids:
                try:
                    stream, file_info = await self.download_file(
                        conn_id, db_name, bucket_name, file_id,
                    )
                    filename = self._deduplicate_filename(
                        file_info["filename"], seen_names,
                    )

                    # Read all chunks into a buffer for this file
                    file_buf = bytearray()
                    async for chunk in stream:
                        file_buf.extend(chunk)

                    zf.writestr(filename, bytes(file_buf))
                    files_added += 1
                except (ValueError, FileNotFoundError) as exc:
                    errors.append(f"{file_id}: {exc}")
                    logger.warning("Skipping file '%s' in bulk download: %s", file_id, exc)
                except Exception as exc:
                    errors.append(f"{file_id}: {exc}")
                    logger.exception("Unexpected error reading file '%s' for ZIP: %s", file_id, exc)

        if files_added == 0:
            if errors:
                raise FileNotFoundError(
                    f"None of the requested files could be read: {'; '.join(errors)}"
                )
            raise FileNotFoundError("No files to download")

        logger.info(
            "Bulk download ZIP from bucket '%s': %d files added, %d skipped",
            bucket_name,
            files_added,
            len(errors),
        )

        buf.seek(0)
        return buf.read()
