"""
AES-256-GCM encryption service using ENCRYPTION_KEY from application settings.

Provides symmetric encrypt/decrypt functions for securing sensitive data
such as stored MongoDB connection strings.
"""

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

_NONCE_SIZE = 12  # 96-bit nonce recommended for AES-GCM


def _derive_key() -> bytes:
    """Derive a 32-byte AES-256 key from the configured ENCRYPTION_KEY string
    using SHA-256 so users can supply any arbitrary string as the key."""
    raw_key = get_settings().ENCRYPTION_KEY.encode("utf-8")
    return hashlib.sha256(raw_key).digest()


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string using AES-256-GCM.

    Args:
        plaintext: The string to encrypt.

    Returns:
        A base64-encoded string containing nonce + ciphertext + tag.
    """
    key = _derive_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(_NONCE_SIZE)
    ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    # AESGCM.encrypt returns ciphertext || tag (16-byte tag appended)
    return base64.b64encode(nonce + ciphertext_with_tag).decode("utf-8")


def decrypt(token: str) -> str:
    """Decrypt a base64-encoded AES-256-GCM token.

    Args:
        token: The base64 string produced by encrypt().

    Returns:
        The original plaintext string.

    Raises:
        cryptography.exceptions.InvalidTag: If the key is wrong or data is tampered.
        ValueError: If the token is malformed.
    """
    key = _derive_key()
    raw = base64.b64decode(token)
    if len(raw) < _NONCE_SIZE + 16:
        raise ValueError("Ciphertext too short to contain nonce and authentication tag")
    nonce = raw[:_NONCE_SIZE]
    ciphertext_with_tag = raw[_NONCE_SIZE:]
    aesgcm = AESGCM(key)
    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext_with_tag, None)
    return plaintext_bytes.decode("utf-8")
