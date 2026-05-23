from __future__ import annotations

import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.responses import fail
from backend.routers import auth, friends, memorials


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


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

    app.include_router(auth.router)
    app.include_router(friends.router)
    app.include_router(memorials.router)
    return app


app = create_app()
