from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Column, Field, SQLModel, Text


class LevelScoreRun(SQLModel, table=True):
  id: Optional[int] = Field(default=None, primary_key=True)
  status: str = Field(default="pending", max_length=32)
  levels_payload: str = Field(sa_column=Column(Text, nullable=False))
  total_levels: int = Field(default=0)
  processed_levels: int = Field(default=0)
  total_combinations: int = Field(default=0)
  processed_combinations: int = Field(default=0)
  current_index: int = Field(default=0)
  avg_duration_ms: Optional[float] = None
  estimated_seconds: Optional[float] = None
  started_at: datetime = Field(default_factory=datetime.utcnow)
  finished_at: Optional[datetime] = None
  last_message: Optional[str] = Field(default=None, max_length=255)


class LevelScore(SQLModel, table=True):
  id: Optional[int] = Field(default=None, primary_key=True)
  run_id: int = Field(foreign_key="levelscorerun.id")
  level_id: str = Field(index=True)
  dimensions_json: str = Field(sa_column=Column(Text, nullable=False))
  cov_nivel: float
  n_combinacoes: int
  score_cov: Optional[float] = None
  score_complex: Optional[float] = None
  score_final: Optional[float] = None
