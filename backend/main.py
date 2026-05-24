from __future__ import annotations

import logging
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse

from backend.responses import fail
from backend.routers import auth, friends, memorials


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONT_DIST_DIR = BASE_DIR / "front" / "dist"
FRONT_INDEX_PATH = FRONT_DIST_DIR / "index.html"
FRONT_DIST_RESOLVED = FRONT_DIST_DIR.resolve()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Memorials Backend API",
        version="2.0.0",
        description="皇宫御书房前端配套 FastAPI 后端。",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_request(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        if request.url.path.startswith("/api"):
            logger.info(
                "http %s %s -> %s %.1fms",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
            )
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled backend exception")
        return JSONResponse(fail(f"后端处理失败：{exc}"), status_code=500)

    @app.exception_handler(HTTPException)
    async def http_exception(_: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict) and "success" in exc.detail:
            return JSONResponse(exc.detail, status_code=exc.status_code)
        return JSONResponse(fail(str(exc.detail)), status_code=exc.status_code)

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    def serve_frontend(path: str = ""):
        if not FRONT_INDEX_PATH.exists():
            logger.warning("frontend build missing at %s", FRONT_INDEX_PATH)
            return PlainTextResponse(
                "Frontend build not found. Run `cd front && npm install && npm run build`.",
                status_code=503,
            )

        if path:
            requested = (FRONT_DIST_DIR / path).resolve()
            if requested.is_file() and (
                requested == FRONT_DIST_RESOLVED or FRONT_DIST_RESOLVED in requested.parents
            ):
                return FileResponse(requested)

        return FileResponse(FRONT_INDEX_PATH)

    app.include_router(auth.router)
    app.include_router(friends.router)
    app.include_router(memorials.router)

    @app.get("/", include_in_schema=False)
    def frontend_root():
        return serve_frontend()

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend_spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path in {"docs", "redoc", "openapi.json"}:
            raise HTTPException(status_code=404, detail="Not Found")
        return serve_frontend(full_path)

    return app


app = create_app()
