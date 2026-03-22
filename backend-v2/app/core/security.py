import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings

settings = get_settings()
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 600000


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, iterations_raw, salt, stored_hash = hashed_password.split("$", 3)
    except ValueError:
        return False

    if scheme != PASSWORD_SCHEME:
        return False

    derived_hash = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations_raw),
    )
    return hmac.compare_digest(
        stored_hash,
        base64.urlsafe_b64encode(derived_hash).decode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    )
    encoded_hash = base64.urlsafe_b64encode(password_hash).decode("utf-8")
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${salt}${encoded_hash}"


def create_token(
    subject: str | Any,
    token_type: str,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(
            minutes=(
                settings.access_token_expire_minutes
                if token_type == ACCESS_TOKEN_TYPE
                else settings.refresh_token_expire_minutes
            )
        )
    )
    payload = {
        "exp": int(expire.timestamp()),
        "sub": str(subject),
        "type": token_type,
    }
    encoded_payload = _urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _sign(encoded_payload)
    return f"{encoded_payload}.{signature}"


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    return create_token(subject=subject, token_type=ACCESS_TOKEN_TYPE, expires_delta=expires_delta)


def create_refresh_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    return create_token(subject=subject, token_type=REFRESH_TOKEN_TYPE, expires_delta=expires_delta)


def decode_token(token: str) -> dict[str, Any]:
    try:
        encoded_payload, signature = token.split(".", 1)
    except ValueError as exc:
        raise ValueError("Malformed token") from exc

    expected_signature = _sign(encoded_payload)
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("Invalid token signature")

    payload = json.loads(_urlsafe_b64decode(encoded_payload).decode("utf-8"))
    if payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("Token expired")
    return payload


def is_refresh_token(payload: dict[str, Any]) -> bool:
    return payload.get("type") == REFRESH_TOKEN_TYPE


def _get_secret_key_bytes() -> bytes:
    return hashlib.sha256(settings.secret_key.encode("utf-8")).digest()


def _urlsafe_b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _urlsafe_b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("utf-8"))


def _sign(encoded_payload: str) -> str:
    digest = hmac.new(
        settings.secret_key.encode("utf-8"),
        encoded_payload.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return _urlsafe_b64encode(digest)


def _xor_bytes(data: bytes, key: bytes) -> bytes:
    return bytes(byte ^ key[index % len(key)] for index, byte in enumerate(data))


def encrypt_secret(secret: str | None) -> str | None:
    if not secret:
        return None
    encoded = _xor_bytes(secret.encode("utf-8"), _get_secret_key_bytes())
    return base64.urlsafe_b64encode(encoded).decode("utf-8")


def decrypt_secret(secret_encrypted: str | None) -> str | None:
    if not secret_encrypted:
        return None
    try:
        decoded = base64.urlsafe_b64decode(secret_encrypted.encode("utf-8"))
        return _xor_bytes(decoded, _get_secret_key_bytes()).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None


def mask_secret(secret: str | None) -> str:
    if not secret:
        return ""
    if len(secret) <= 4:
        return "*" * len(secret)
    return f"{secret[:2]}***{secret[-2:]}"
