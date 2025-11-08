import logging
from collections import deque
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
RAILWAY_INTERNAL_SUFFIX = ".railway.internal"


def _clean_url(url: str) -> str:
  """Limpa URLs mal formatadas, especialmente aquelas com +psycopg no nome do database."""
  # Remove +psycopg do final do nome do database se estiver presente
  # Exemplo: postgresql://.../railway+psycopg -> postgresql://.../railway
  # Isso corrige URLs mal formatadas do Railway onde o driver foi colocado no lugar errado
  if "+psycopg" in url and "/" in url:
    # Usa uma abordagem mais robusta: tenta fazer parse primeiro
    try:
      parsed = make_url(url)
      # Se o database name contém +psycopg, remove
      if parsed.database and "+psycopg" in parsed.database:
        parsed = parsed.set(database=parsed.database.replace("+psycopg", ""))
        return parsed.render_as_string(hide_password=False)
    except Exception:
      # Se o parse falhar, tenta limpeza manual
      pass
    
    # Fallback: limpeza manual usando split
    parts = url.split("/")
    if len(parts) >= 3:
      # O último segmento pode conter o nome do database
      last_part = parts[-1]
      if "+psycopg" in last_part:
        # Remove +psycopg do nome do database
        if "?" in last_part:
          # Se houver query parameters, trata separadamente
          db_part, query_part = last_part.split("?", 1)
          db_part = db_part.replace("+psycopg", "")
          parts[-1] = f"{db_part}?{query_part}"
        else:
          parts[-1] = last_part.replace("+psycopg", "")
        url = "/".join(parts)
  return url


def _normalize_url(url: str) -> str:
  """Ensure Railway public hosts enforce SSL and return the canonical string."""
  # Limpa a URL primeiro para corrigir formatações incorretas
  url = _clean_url(url)
  
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


def _collect_candidate_urls() -> list[str]:
  """Return normalized database URLs to try, preferring local before remote."""
  import os

  candidates: list[str] = []
  seen: set[str] = set()

  def add(url: str | None) -> None:
    if not url:
      return
    normalized = _normalize_url(url)
    if normalized not in seen:
      candidates.append(normalized)
      seen.add(normalized)

  add(settings.database_url_local)
  add(settings.database_url or DEFAULT_SQLITE_URL)
  add(settings.database_url_remote)

  # Railway / Supabase aliases
  env_aliases = [
    os.getenv("POSTGRES_URL"),
    os.getenv("POSTGRES_URL_PUBLIC"),
    os.getenv("DATABASE_URL_PUBLIC")
  ]
  for alias in env_aliases:
    add(alias)

  add(DEFAULT_SQLITE_URL)
  return candidates


def _is_dns_error(message: str) -> bool:
  lowered = message.lower()
  return (
    "name or service not known" in lowered or
    "could not translate host name" in lowered or
    "getaddrinfo failed" in lowered
  )


def _build_public_fallback(url: str) -> str | None:
  """Best-effort attempt to switch from Railway internal host to public proxy."""
  import os

  env_public = os.getenv("POSTGRES_URL_PUBLIC") or os.getenv("DATABASE_URL_PUBLIC")
  if env_public:
    return _normalize_url(env_public)

  try:
    parsed = make_url(url)
  except Exception:
    return None

  if not parsed.host or RAILWAY_INTERNAL_SUFFIX not in parsed.host:
    return None

  public_host = os.getenv("POSTGRES_HOSTNAME_PUBLIC") or os.getenv("PGHOST_PUBLIC")
  public_port = os.getenv("POSTGRES_PORT_PUBLIC") or os.getenv("PGPORT_PUBLIC")
  if public_host and public_port:
    parsed = parsed.set(host=public_host, port=int(public_port))
    return _normalize_url(parsed.render_as_string(hide_password=False))
  return None


def _initialize_engine():
  """Create the primary engine trying local DB first, then fallbacks (Railway/public, SQLite)."""
  candidate_queue = deque(_collect_candidate_urls())
  seen: set[str] = set(candidate_queue)

  while candidate_queue:
    current_url = candidate_queue.popleft()
    engine = _build_engine(current_url)
    sanitized_url = engine.url.render_as_string(hide_password=True)

    try:
      _assert_connectable(engine)
      logger.info("Connected to database at %s", sanitized_url)
      return engine
    except OperationalError as exc:
      message = str(exc)
      logger.warning("Connection failed for %s: %s", sanitized_url, message.strip())

      if (
        not current_url.startswith("sqlite") and
        _is_dns_error(message) and
        engine.url.host and RAILWAY_INTERNAL_SUFFIX in engine.url.host
      ):
        public_url = _build_public_fallback(current_url)
        if public_url and public_url not in seen:
          logger.info("Trying Railway public host fallback...")
          candidate_queue.appendleft(public_url)
          seen.add(public_url)
          continue

  # If we exit the loop something unexpected happened even with SQLite fallback.
  fallback_engine = _build_engine(DEFAULT_SQLITE_URL)
  _assert_connectable(fallback_engine)
  logger.warning("All configured databases failed; using local SQLite at %s", DEFAULT_SQLITE_URL)
  return fallback_engine


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


def get_candidate_database_urls() -> list[str]:
  """Expose candidate URLs used during initialization for diagnostics."""
  return list(_collect_candidate_urls())


def get_active_database_url() -> str:
  """Return the URL currently bound to the main engine."""
  return engine.url.render_as_string(hide_password=False)
