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
  """Create the primary engine, falling back to public URL or SQLite when private host isn't reachable."""
  import os
  
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
        "Could not resolve database host for %s; trying alternatives...",
        sanitized_url
      )
      
      # Tenta usar URL pública se disponível (Railway fornece POSTGRES_URL_PUBLIC ou similar)
      public_url = None
      if os.getenv("POSTGRES_URL_PUBLIC"):
        public_url = _normalize_url(os.getenv("POSTGRES_URL_PUBLIC"))
      elif os.getenv("DATABASE_URL_PUBLIC"):
        public_url = _normalize_url(os.getenv("DATABASE_URL_PUBLIC"))
      else:
        # Tenta construir URL pública a partir da URL interna se for .railway.internal
        try:
          parsed = make_url(primary_url)
          if parsed.host and ".railway.internal" in parsed.host:
            # Railway pode fornecer variáveis com host público
            public_host = os.getenv("POSTGRES_HOSTNAME_PUBLIC") or os.getenv("PGHOST_PUBLIC")
            public_port = os.getenv("POSTGRES_PORT_PUBLIC") or os.getenv("PGPORT_PUBLIC")
            if public_host and public_port:
              public_url = f"{parsed.drivername}://{parsed.username}:{parsed.password}@{public_host}:{public_port}/{parsed.database}"
              public_url = _normalize_url(public_url)
        except Exception:
          pass
      
      # Tenta URL pública se disponível
      if public_url and public_url != primary_url:
        logger.info("Attempting to connect using public URL...")
        try:
          public_engine = _build_engine(public_url)
          _assert_connectable(public_engine)
          logger.info("Successfully connected to database using public URL at %s", 
                     public_engine.url.render_as_string(hide_password=True))
          return public_engine
        except Exception as pub_exc:
          logger.warning("Public URL also failed: %s", str(pub_exc))
      
      # Diagnóstico detalhado
      logger.error("=" * 60)
      logger.error("DIAGNÓSTICO DE CONEXÃO POSTGRESQL")
      logger.error("=" * 60)
      logger.error("A URL interna não pode ser resolvida.")
      logger.error("URL tentada: %s", sanitized_url)
      if public_url:
        logger.error("URL pública tentada: %s", public_url.split("@")[1] if "@" in public_url else public_url)
      logger.error("")
      logger.error("VARIÁVEIS DE AMBIENTE DETECTADAS:")
      db_vars = {
        "DATABASE_URL": os.getenv("DATABASE_URL", "NÃO DEFINIDA"),
        "POSTGRES_URL": os.getenv("POSTGRES_URL", "NÃO DEFINIDA"),
        "POSTGRES_URL_PUBLIC": os.getenv("POSTGRES_URL_PUBLIC", "NÃO DEFINIDA"),
        "PGHOST": os.getenv("PGHOST", "NÃO DEFINIDA"),
      }
      for var_name, var_value in db_vars.items():
        if var_value != "NÃO DEFINIDA" and var_value:
          if "@" in var_value:
            masked = var_value.split("@")[0].split(":")[0] + ":***@" + "@".join(var_value.split("@")[1:])
            logger.error("  %s=%s", var_name, masked)
          else:
            logger.error("  %s=%s", var_name, var_value)
      logger.error("")
      logger.error("SOLUÇÃO: Use a URL pública (proxy) se os serviços estão no mesmo espaço:")
      logger.error("Configure DATABASE_URL com: postgresql://postgres:senha@[host].proxy.rlwy.net:[porta]/railway")
      logger.error("=" * 60)
      
      # Fallback para SQLite
      logger.warning("Falling back to local SQLite at %s", DEFAULT_SQLITE_URL)
      logger.warning("⚠️ Isso não é recomendado para produção!")
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
