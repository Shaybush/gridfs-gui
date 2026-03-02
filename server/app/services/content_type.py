"""Content-type detection by file extension.

Uses Python stdlib ``mimetypes`` with a comprehensive fallback map so that
GridFS files without a stored ``contentType`` can still be served with the
correct MIME type.
"""

import mimetypes
import os

EXTENSION_MAP: dict[str, str] = {
    # Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".avif": "image/avif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    # Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".rtf": "application/rtf",
    ".epub": "application/epub+zip",
    # Text / Code
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".json": "application/json",
    ".xml": "application/xml",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".toml": "text/plain",
    ".ini": "text/plain",
    ".cfg": "text/plain",
    ".conf": "text/plain",
    ".env": "text/plain",
    ".log": "text/plain",
    ".sql": "application/sql",
    ".sh": "application/x-sh",
    ".bash": "application/x-sh",
    ".zsh": "application/x-sh",
    ".ps1": "text/plain",
    ".bat": "text/plain",
    ".py": "text/x-python",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".jsx": "text/jsx",
    ".tsx": "text/tsx",
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".scss": "text/x-scss",
    ".less": "text/x-less",
    ".java": "text/x-java",
    ".c": "text/x-c",
    ".cpp": "text/x-c++",
    ".h": "text/x-c",
    ".hpp": "text/x-c++",
    ".cs": "text/x-csharp",
    ".go": "text/x-go",
    ".rs": "text/x-rust",
    ".rb": "text/x-ruby",
    ".php": "text/x-php",
    ".swift": "text/x-swift",
    ".kt": "text/x-kotlin",
    ".scala": "text/x-scala",
    ".r": "text/x-r",
    ".lua": "text/x-lua",
    ".pl": "text/x-perl",
    ".dart": "text/x-dart",
    ".vue": "text/x-vue",
    ".svelte": "text/x-svelte",
    ".graphql": "text/x-graphql",
    ".proto": "text/x-protobuf",
    ".dockerfile": "text/x-dockerfile",
    ".makefile": "text/x-makefile",
    ".cmake": "text/x-cmake",
    # Video
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
    ".m4v": "video/mp4",
    ".3gp": "video/3gpp",
    # Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",
    ".wma": "audio/x-ms-wma",
    ".opus": "audio/opus",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".aiff": "audio/aiff",
    ".ape": "audio/x-ape",
    # Archives
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".bz2": "application/x-bzip2",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar",
    ".xz": "application/x-xz",
    ".zst": "application/zstd",
    # Fonts
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
    # Data
    ".parquet": "application/vnd.apache.parquet",
    ".arrow": "application/vnd.apache.arrow.file",
    ".ndjson": "application/x-ndjson",
    ".geojson": "application/geo+json",
    ".gpx": "application/gpx+xml",
    ".kml": "application/vnd.google-earth.kml+xml",
    # Other
    ".wasm": "application/wasm",
    ".sqlite": "application/x-sqlite3",
    ".db": "application/x-sqlite3",
}


def detect_content_type(filename: str) -> str:
    """Detect MIME type from a filename's extension.

    Resolution order:
    1. ``mimetypes.guess_type`` (stdlib)
    2. ``EXTENSION_MAP`` fallback dict
    3. ``application/octet-stream`` default
    """
    if not filename:
        return "application/octet-stream"

    # Try stdlib first
    guessed, _ = mimetypes.guess_type(filename, strict=False)
    if guessed:
        return guessed

    # Fallback to our comprehensive map (case-insensitive)
    ext = os.path.splitext(filename)[1].lower()
    return EXTENSION_MAP.get(ext, "application/octet-stream")
