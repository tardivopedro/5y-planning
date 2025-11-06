import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import get_settings
from app.db.init_db import init_db

settings = get_settings()

logging.basicConfig(
  level=logging.INFO,
  format="[%(asctime)s] %(levelname)s %(name)s: %(message)s"
)

app = FastAPI(
  title=settings.app_name,
  debug=settings.debug,
  version="0.1.0"
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"]
)


@app.on_event("startup")
def on_startup() -> None:
  init_db()


@app.get("/health")
def healthcheck() -> dict[str, str]:
  return {"status": "ok"}


app.include_router(api_router)
