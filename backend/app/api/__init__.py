from fastapi import APIRouter

from .analytics import router as analytics_router
from .forecast import router as forecast_router
from .upload import router as upload_router

api_router = APIRouter()
api_router.include_router(upload_router, prefix="/upload", tags=["upload"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(forecast_router, prefix="/forecast", tags=["forecast"])

__all__ = ["api_router"]
