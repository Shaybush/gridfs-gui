import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.config import get_settings
from app.api.routes import router as api_router
from app.services.connection_pool import ConnectionPool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

try:
    settings = get_settings()
except ValidationError as e:
    missing = [err["loc"][0] for err in e.errors() if err["type"] == "missing"]
    if missing:
        print("\n" + "=" * 60)
        print("  GridFS GUI - Missing required environment variables:")
        print()
        for var in missing:
            print(f"    - {var}")
        print()
        print("  Example:")
        print("    docker run -e ENCRYPTION_KEY=$(openssl rand -hex 32) \\")
        print("      shaybush/gridfs-gui-server:latest")
        print("=" * 60 + "\n")
    else:
        print(f"\nConfiguration error: {e}\n")
    sys.exit(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s on %s:%s", settings.APP_NAME, settings.HOST, settings.PORT)
    yield
    logger.info("Shutting down %s", settings.APP_NAME)
    pool = ConnectionPool.get_instance()
    await pool.close_all()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

cors_origins = (
    settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}


# Static file serving + SPA fallback (may not exist during development)
STATIC_DIR = Path(__file__).resolve().parent.parent / "public"

if STATIC_DIR.is_dir():
    # Mount static asset directories (js, css, assets, etc.)
    for subdir in ("js", "css", "assets"):
        sub_path = STATIC_DIR / subdir
        if sub_path.is_dir():
            app.mount(f"/{subdir}", StaticFiles(directory=sub_path), name=f"static-{subdir}")

    @app.middleware("http")
    async def spa_fallback(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path

        if (
            response.status_code == 404
            and not path.startswith("/api")
            and not path.startswith(("/js", "/css", "/assets"))
            and path != "/health"
        ):
            index = STATIC_DIR / "index.html"
            if index.is_file():
                return FileResponse(index, media_type="text/html")

        return response

    @app.get("/")
    async def serve_index():
        return FileResponse(STATIC_DIR / "index.html", media_type="text/html")
