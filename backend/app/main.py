from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db
from app.services import NotFoundError


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # creates any missing tables; switch to Alembic migrations once the schema settles
    yield


app = FastAPI(title="RECShield API", lifespan=lifespan)

# Vite bumps to 5174/5175/... whenever 5173 is taken, and the QR/phone-verification demo
# (RS-14/RS-17) needs the frontend reachable from a phone on the same LAN, at whatever IP that
# happens to be - rather than hand-editing CORS_ORIGINS every time either changes, also allow
# any localhost/127.0.0.1 port and any private LAN IP (RFC 1918: 10.x, 172.16-31.x, 192.168.x)
# on any port. Deliberately not a public-internet wildcard - a real deployment (RS-17) should
# set CORS_ORIGINS to its actual frontend origin instead of relying on this regex.
_LOCAL_DEV_ORIGIN_REGEX = r"^http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=_LOCAL_DEV_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(NotFoundError)
async def not_found(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
