"""
Pydantic models for MongoDB connection management.

ConnectionCreate  — validated input when creating a new stored connection.
ConnectionUpdate  — partial update payload (all fields optional).
ConnectionResponse — safe representation returned to the frontend (URI masked).
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ConnectionCreate(BaseModel):
    """Input model for creating a new MongoDB connection."""

    name: str = Field(..., min_length=1, max_length=128, description="Human-readable connection name")
    uri: str = Field(..., min_length=10, description="MongoDB connection URI")
    tls: bool = Field(default=False, description="Enable TLS for the connection")
    tls_ca_file: Optional[str] = Field(default=None, description="Path to TLS CA certificate file")

    @field_validator("uri")
    @classmethod
    def validate_uri_scheme(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError("URI must start with mongodb:// or mongodb+srv://")
        return v


class ConnectionUpdate(BaseModel):
    """Partial update model — only supplied fields will be changed."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    uri: Optional[str] = Field(default=None, min_length=10)
    tls: Optional[bool] = None
    tls_ca_file: Optional[str] = None

    @field_validator("uri")
    @classmethod
    def validate_uri_scheme(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v.startswith(("mongodb://", "mongodb+srv://")):
                raise ValueError("URI must start with mongodb:// or mongodb+srv://")
        return v


class ConnectionResponse(BaseModel):
    """Safe connection representation returned to the frontend.

    The raw URI is never exposed — only a masked version that hides
    the password portion of the connection string.
    """

    id: str
    name: str
    uri_masked: str
    tls: bool
    created_at: str  # ISO-8601
    updated_at: str  # ISO-8601
