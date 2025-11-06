import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import make_url
from sqlmodel import Session

from app.core.config import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)

DEFAULT_SQLITE_URL = "sqlite:///./data/forecast.db"
RAILWAY_PUBLIC_HOST_SUFFIXES = (".railway.app", ".proxy.rlwy.net")
RAILWAY_INTERNAL_HOST = "postgres.railway.internal"


def _normalize_url(url: str) -> str:
  """Ensure Railway public hosts enforce SSL and return the canonical string."""
  try:
    parsed = make_url(url)
  except Exception:
    return url

  driver = parsed.drivername or ""
  host = parsed.host or ""

  if driver.startswith("postgresql") and host:
    is_public_host = host.endswith(RAILWAY_PUBLIC_HOST_SUFFIXES)

    if driver == "postgresql":
      # Force psycopg (psycopg3) instead of the legacy psycopg2 driver.
      parsed = parsed.set(drivername="postgresql+psycopg")
    elif driver == "postgresql+psycopg2":
      parsed = parsed.set(drivername="postgresql+psycopg")

    if is_public_host and not parsed.query.get("sslmode"):
      parsed = parsed.set(query={**parsed.query, "sslmode": "require"})

    return parsed.render_as_string(hide_password=False)

  return url


def _build_engine(url: str):
  """Create the SQLAlchemy engine with the proper SQLite connect args."""
  connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
  if url.startswith("sqlite"):
    Path("data").mkdir(parents=True, exist_ok=True)
  return create_engine(url, connect_args=connect_args)


def _assert_connectable(engine):
  """Open a temporary connection and issue a no-op query to validate connectivity."""
  with engine.connect() as connection:
    connection.execute(text("SELECT 1"))


def _initialize_engine():
  """Create the primary engine, falling back to SQLite when a private host isn't reachable."""
  primary_url = _normalize_url(settings.database_url or DEFAULT_SQLITE_URL)
  engine = _build_engine(primary_url)
  try:
    _assert_connectable(engine)
    return engine
  except OperationalError as exc:
    message = str(exc).lower()
    if "name or service not known" in message and not primary_url.startswith("sqlite"):
      sanitized_url = engine.url.render_as_string(hide_password=True)
      logger.warning(
        "Could not resolve database host for %s; falling back to local SQLite at %s.",
        sanitized_url,
        DEFAULT_SQLITE_URL
      )
      fallback_engine = _build_engine(DEFAULT_SQLITE_URL)
      _assert_connectable(fallback_engine)
      return fallback_engine
    raise


engine = _initialize_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)


@contextmanager
def session_context() -> Iterator[Session]:
  session: Session = SessionLocal()
  try:
    yield session
    session.commit()
  except Exception:
    session.rollback()
    raise
  finally:
    session.close()


def get_session() -> Iterator[Session]:
  with SessionLocal() as session:
    yield session
