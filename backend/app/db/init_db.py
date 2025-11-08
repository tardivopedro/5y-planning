from sqlmodel import SQLModel

from app.db.session import engine
from app.models import planning_record, planning_combination  # noqa: F401  # ensure models imported


def init_db() -> None:
  SQLModel.metadata.create_all(bind=engine)
