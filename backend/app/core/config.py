from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://user:password@localhost:5432/recshield"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Server-side only. Never put this in a VITE_ variable: those are bundled into the browser.
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "claude-opus-5"

    # Where QR codes point: the frontend's public verification page.
    PUBLIC_BASE_URL: str = "http://localhost:5173"

    # RS-16: Supabase Auth. Project Settings -> API -> JWT Settings -> "JWT Secret" (legacy
    # HS256 shared secret - Supabase still issues these alongside the newer signing keys).
    # Left empty, auditor routes fall back to an unauthenticated "local-dev" identity, so
    # pytest and a plain local run keep working without Supabase configured.
    SUPABASE_JWT_SECRET: str = ""

    DATA_DIR: Path = BACKEND_DIR / "data" / "simulated"
    ANOMALY_MODEL_PATH: Path = BACKEND_DIR / "ml" / "artifacts" / "isolation_forest.joblib"


settings = Settings()
