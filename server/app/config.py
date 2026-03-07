from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    APP_NAME: str = "gridfs-gui"
    CORS_ORIGINS: str = "*"
    ENCRYPTION_KEY: str = "282df7198dfba090a8c6defba8eb609f068392ffc385a9b8ffc9a1dc27b264c2"
    DATA_DIR: str = "./data"
    PREVIEW_CACHE_MAX_MB: int = 200
    PREVIEW_CACHE_TTL_SECONDS: int = 3600
    PREVIEW_CONVERSION_TIMEOUT_SECONDS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
