"""Uniform JSON error body — every error from every endpoint looks the same (TODO 4.8).

Shape:
    {"error": {"code": "<machine-readable>", "message": "<human text>", "details": ...}}

Never leaks stack traces, SQL, or DB details — a 500 is just
"internal error" and gets logged server-side.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.exceptions import ConflictError, NotFoundError, ServiceError

logger = logging.getLogger("nexus.api.errors")


def _error(code: str, message: str, details=None) -> dict:
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def _service_error(request: Request, exc: ServiceError):
        if isinstance(exc, NotFoundError):
            return JSONResponse(status_code=404, content=_error("not_found", exc.message))
        if isinstance(exc, ConflictError):
            return JSONResponse(status_code=409, content=_error("conflict", exc.message))
        return JSONResponse(status_code=400, content=_error("bad_request", exc.message))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        # Same shape as everything else; details keeps per-field info so
        # clients can fix their payloads without guessing. jsonable_encoder
        # because error details can carry non-JSON values (datetime input
        # values, ValueError ctx, ...) that would crash a raw json.dumps.
        return JSONResponse(
            status_code=422,
            content=_error(
                "validation_error",
                "request validation failed",
                details=jsonable_encoder(exc.errors()),
            ),
        )

    @app.exception_handler(ValueError)
    async def _value_error(request: Request, exc: ValueError):
        # e.g. an un-normalizable plate filter or a bad status value from
        # the query service — bad input, cleanly reported.
        return JSONResponse(status_code=422, content=_error("invalid_value", str(exc)))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_error("error", str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # Log the real traceback server-side; the client only ever sees
        # a generic message (TODO 3.4 / 4.8).
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content=_error("internal_error", "an internal error occurred"),
        )
