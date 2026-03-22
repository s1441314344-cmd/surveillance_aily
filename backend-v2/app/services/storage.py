from pathlib import Path
import uuid

from app.core.config import get_settings

settings = get_settings()


def ensure_storage_root(path: str | None = None) -> str:
    target = Path(path or settings.storage_root).resolve()
    target.mkdir(parents=True, exist_ok=True)
    return str(target)


class FileStorageService:
    def __init__(self, root: str | None = None):
        self.root = Path(ensure_storage_root(root))

    def save_bytes(self, content: bytes, original_name: str, folder: str = "uploads") -> str:
        target_dir = self.root / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(original_name).suffix or ".bin"
        filename = f"{uuid.uuid4().hex}{suffix}"
        target_path = target_dir / filename
        target_path.write_bytes(content)
        return str(target_path)
