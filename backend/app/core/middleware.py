import logging
import time
from typing import Callable

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


logger = logging.getLogger(__name__)

# Middleware for logging requests and responses
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Log the incoming request details
        logger.info(f"Request: {request.method} {request.url}")
        
        try:
            # Process the request and get the response
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Log the response details and processing time
            logger.info(
                f"Response: {response.status_code} - "
                f"Process time: {process_time:.4f}s"
            )
            
            return response
        
        except Exception as e:
            process_time = time.time() - start_time
            # Log any errors that occur during request processing
            logger.error(
                f"Error processing request: {str(e)} - "
                f"Process time: {process_time:.4f}s"
            )
            raise


# Custom handler for HTTP exceptions
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail
        }
    )


# Custom handler for general exceptions
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Internal server error",
            "status_code": 500
        }
    )