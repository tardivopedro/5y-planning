from __future__ import annotations

import time
from pathlib import Path
from typing import Dict, List

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import (
  get_active_database_url,
  get_candidate_database_urls
)


def _sanitize_url(raw_url: str) -> str:
  try:
    parsed = make_url(raw_url)
    return parsed.render_as_string(hide_password=True)
  except Exception:
    return raw_url


def _build_temp_engine(url: str):
  connect_args = {}
  if url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    if "///" in url:
      db_path = url.split("///", 1)[1]
      parent = Path(db_path).resolve().parent
      parent.mkdir(parents=True, exist_ok=True)
  return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


def _ping_url(url: str) -> Dict[str, str | float]:
  start = time.perf_counter()
  try:
    engine = _build_temp_engine(url)
    with engine.connect() as connection:
      connection.execute(text("SELECT 1"))
    duration = (time.perf_counter() - start) * 1000
    return {
      "status": "online",
      "latency_ms": round(duration, 2),
      "detail": "Conexão estabelecida com sucesso."
    }
  except SQLAlchemyError as exc:
    return {
      "status": "offline",
      "latency_ms": None,
      "detail": str(exc).splitlines()[0]
    }
  except Exception as exc:
    return {
      "status": "offline",
      "latency_ms": None,
      "detail": str(exc)
    }


def get_database_statuses() -> List[Dict[str, str | float | bool]]:
  candidates = get_candidate_database_urls()
  active = get_active_database_url()
  statuses: List[Dict[str, str | float | bool]] = []
  seen: set[str] = set()
  for url in candidates:
    if url in seen:
      continue
    seen.add(url)
    result = _ping_url(url)
    statuses.append({
      "raw_url": url,
      "url": _sanitize_url(url),
      "is_active": url == active,
      **result
    })
  return statuses
