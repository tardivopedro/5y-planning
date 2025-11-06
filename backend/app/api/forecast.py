"""REST endpoints exposing forecast capabilities."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..schemas.core import ForecastRequest, ForecastResponse
from ..services.forecast_engine import ForecastEngine

router = APIRouter()

engine = ForecastEngine()


@router.post("/generate")
def generate_forecast(request: ForecastRequest) -> ForecastResponse:
    """Generate the forecast for the provided dataset."""
    try:
        result = engine.generate_forecast(request)
    except ValueError as exc:  # pragma: no cover - handled for API consumers
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ForecastResponse(**result)
