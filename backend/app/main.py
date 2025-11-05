"""FastAPI application entry point for the 5-year planning tool."""
from fastapi import FastAPI

from .api import forecast

app = FastAPI(title="5Y Planning", version="0.1.0")


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}


app.include_router(forecast.router, prefix="/forecast", tags=["forecast"])
