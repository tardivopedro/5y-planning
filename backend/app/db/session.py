from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session

from app.core.config import get_settings

settings = get_settings()

if settings.database_url.startswith("sqlite"):
  Path("data").mkdir(parents=True, exist_ok=True)
  connect_args = {"check_same_thread": False}
else:
  connect_args = {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(
  autocommit=False,
  autoflush=False,
  bind=engine,
  class_=Session
)


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
