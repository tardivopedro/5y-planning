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


def _initialize_engine():
  """Create the primary engine, falling back to SQLite when a private host isn't reachable."""
  primary_url = _normalize_url(settings.database_url or DEFAULT_SQLITE_URL)
  engine = _build_engine(primary_url)
  try:
    _assert_connectable(engine)
    logger.info("Successfully connected to database at %s", engine.url.render_as_string(hide_password=True))
    return engine
  except OperationalError as exc:
    message = str(exc).lower()
    if ("name or service not known" in message or "could not translate host name" in message) and not primary_url.startswith("sqlite"):
      sanitized_url = engine.url.render_as_string(hide_password=True)
      logger.warning(
        "Could not resolve database host for %s; falling back to local SQLite at %s.",
        sanitized_url,
        DEFAULT_SQLITE_URL
      )
      logger.warning(
        "Tip: Verifique se o serviço PostgreSQL está linkado corretamente no Railway. "
        "No painel do Railway, vá em 'Variables' e verifique se DATABASE_URL ou POSTGRES_URL está configurada. "
        "Se o serviço PostgreSQL tem outro nome (não 'postgres'), o host seria '[nome-do-servico].railway.internal'."
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
