from contextlib import asynccontextmanager
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal, init_database
from app.services.audit_log_service import should_record_audit_log, write_operation_audit_log
from app.services.bootstrap import seed_defaults

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    with SessionLocal() as db:
        seed_defaults(db)
    yield

app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=f"{settings.api_v1_prefix}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def operation_audit_middleware(request, call_next):
    should_audit = request.url.path.startswith(settings.api_v1_prefix) and should_record_audit_log(
        request.method,
        request.url.path,
    )
    started_at = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception as exc:
        if should_audit:
            write_operation_audit_log(
                method=request.method,
                path=request.url.path,
                status_code=500,
                duration_ms=int((time.perf_counter() - started_at) * 1000),
                authorization=request.headers.get("Authorization"),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
                error_message=str(exc),
                details={"query": dict(request.query_params)},
            )
        raise

    if should_audit:
        write_operation_audit_log(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=int((time.perf_counter() - started_at) * 1000),
            authorization=request.headers.get("Authorization"),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            details={"query": dict(request.query_params)},
        )

    return response


app.include_router(api_router, prefix=settings.api_v1_prefix)
