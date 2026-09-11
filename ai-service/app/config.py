from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_PATH = (SERVICE_ROOT.parent / "data" / "micro-innovation-seed.db").resolve()


@dataclass(frozen=True)
class Settings:
    database_path: Path
    cors_origins: tuple[str, ...]
    database_api_url: str
    llm_api_key: str | None
    llm_model: str | None
    llm_base_url: str


def get_settings() -> Settings:
    load_dotenv(SERVICE_ROOT.parent / ".env.local", override=False)
    raw_database_path = os.getenv("AI_DATABASE_PATH")
    database_path = Path(raw_database_path).expanduser().resolve() if raw_database_path else DEFAULT_DATABASE_PATH
    origins = tuple(
        origin.strip()
        for origin in os.getenv("AI_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    )
    return Settings(
        database_path=database_path,
        cors_origins=origins,
        database_api_url=os.getenv("AI_DATABASE_API_URL", "http://127.0.0.1:3001"),
        llm_api_key=os.getenv("API_KEY"),
        llm_model=os.getenv("OPENAI_MODEL"),
        llm_base_url=os.getenv("AI_LLM_BASE_URL", "https://api.apiyi.com/v1/chat/completions"),
    )
