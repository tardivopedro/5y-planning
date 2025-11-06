import logging
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

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


class ForceHTTPSMiddleware(BaseHTTPMiddleware):
  """Middleware para garantir que respostas sempre usem HTTPS quando a requisição veio via HTTPS."""
  async def dispatch(self, request: Request, call_next):
    response = await call_next(request)
    # Detecta se a requisição original veio via HTTPS
    is_https = (
      request.url.scheme == "https" or 
      request.headers.get("x-forwarded-proto") == "https" or
      request.headers.get("x-forwarded-ssl") == "on"
    )
    
    if is_https:
      # Adiciona header HSTS para forçar HTTPS no futuro
      response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
      
      # Se houver redirect, garante que seja HTTPS
      if "location" in response.headers:
        location = response.headers["location"]
        if location.startswith("http://"):
          response.headers["location"] = location.replace("http://", "https://", 1)
    
    return response


# Adiciona middleware de HTTPS primeiro
app.add_middleware(ForceHTTPSMiddleware)

# Depois adiciona CORS
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
  expose_headers=["*"]
)


@app.on_event("startup")
def on_startup() -> None:
  init_db()


@app.get("/health")
def healthcheck() -> dict[str, str]:
  return {"status": "ok"}


app.include_router(api_router)
