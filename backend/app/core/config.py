from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_DEVELOPMENT_SECRET = "dev-only-change-this-secret-before-deployment-2026"


class Settings(BaseSettings):
    app_name: str = "PRIME API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = (
        "postgresql+psycopg://prime_dev:prime_dev_local_only@localhost:5432/prime_dev"
    )
    cors_origins: str = (
        "http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost:8000,http://127.0.0.1:8000"
    )
    secret_key: str = _DEVELOPMENT_SECRET
    access_token_expire_minutes: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if self.access_token_expire_minutes < 1 or self.access_token_expire_minutes > 1440:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES deve ficar entre 1 e 1440.")
        if self.app_env.lower() in {"production", "prod"}:
            if self.secret_key == _DEVELOPMENT_SECRET or len(self.secret_key) < 32:
                raise ValueError(
                    "Em produção, configure SECRET_KEY com um segredo aleatório de pelo menos 32 caracteres."
                )
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
