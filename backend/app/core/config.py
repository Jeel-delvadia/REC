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

    # RS-16: Supabase Auth. Either is enough to turn on verification - both empty (the
    # default) falls back to an unauthenticated "local-dev" identity, so pytest and a plain
    # local run keep working without Supabase configured.
    # - SUPABASE_JWT_SECRET: legacy HS256 shared secret (Project Settings -> API -> JWT
    #   Settings -> "Legacy JWT Secret"). Fast - no network call - but newer projects using
    #   Supabase's asymmetric signing keys may not expose one.
    # - SUPABASE_URL: same Project URL as the frontend's VITE_SUPABASE_URL. When set (and no
    #   JWT secret), tokens are verified against the project's public JWKS instead - works on
    #   every project regardless of which signing key type it uses, at the cost of a
    #   (cached) network fetch for the signing keys.
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_URL: str = ""

    DATA_DIR: Path = BACKEND_DIR / "data" / "simulated"
    ANOMALY_MODEL_PATH: Path = BACKEND_DIR / "ml" / "artifacts" / "isolation_forest.joblib"


settings = Settings()
