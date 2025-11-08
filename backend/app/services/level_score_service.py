from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Sequence

from sqlalchemy import func, select
from sqlmodel import Session

from app.db.session import session_context
from app.models import LevelScore, LevelScoreRun, PlanningRecord

DEFAULT_LEVELS: List[List[str]] = [
  ["diretor", "sigla_uf", "tipo_produto"],
  ["diretor", "sigla_uf"],
  ["diretor"],
  ["sigla_uf", "tipo_produto"],
  ["tipo_produto", "familia"],
]


@dataclass
class LevelInfo:
  level_id: str
  dimensions: List[str]
  combinations: int


def _level_id(dimensions: Sequence[str]) -> str:
  return "_".join(dimensions)


def _count_combinations(session: Session, dimensions: Sequence[str]) -> int:
  columns = [getattr(PlanningRecord, dim) for dim in dimensions]
  subquery = select(*columns).distinct().subquery()
  stmt = select(func.count()).select_from(subquery)
  result = session.exec(stmt).one()
  total = result[0] if isinstance(result, (tuple, list)) else result
  return int(total or 0)


def _compute_level_metrics(session: Session, dimensions: Sequence[str]) -> tuple[float, int]:
  columns = [getattr(PlanningRecord, dim) for dim in dimensions]
  volume_subquery = (
    select(*columns, PlanningRecord.ano.label("ano"), func.sum(PlanningRecord.fat_liq_kg).label("volume"))
    .group_by(*columns, PlanningRecord.ano)
  ).subquery()

  stats_stmt = (
    select(
      *[volume_subquery.c[dim] for dim in dimensions],
      func.count().label("periods"),
      func.sum(volume_subquery.c.volume).label("sum_volume"),
      func.sum(volume_subquery.c.volume * volume_subquery.c.volume).label("sum_sq"),
    )
    .group_by(*[volume_subquery.c[dim] for dim in dimensions])
  )

  rows = session.exec(stats_stmt).all()
  if not rows:
    return 0.0, 0

  weighted_cov_sum = 0.0
  total_volume = 0.0
  for row in rows:
    periods = float(row.periods or 0)
    sum_volume = float(row.sum_volume or 0)
    sum_sq = float(row.sum_sq or 0)
    if periods <= 1 or sum_volume <= 0:
      continue
    mean = sum_volume / periods
    variance = max((sum_sq / periods) - (mean ** 2), 0)
    std_dev = math.sqrt(variance)
    cov = std_dev / mean if mean > 0 else 0
    weighted_cov_sum += cov * sum_volume
    total_volume += sum_volume

  cov_level = (weighted_cov_sum / total_volume) if total_volume > 0 else 0.0
  return cov_level, len(rows)


def _serialize_levels(levels: List[LevelInfo]) -> str:
  payload = [
    {
      "level_id": item.level_id,
      "dimensions": item.dimensions,
      "combinations": item.combinations
    }
    for item in levels
  ]
  return json.dumps(payload)


def _deserialize_levels(payload: str) -> List[LevelInfo]:
  data = json.loads(payload)
  return [LevelInfo(level_id=item["level_id"], dimensions=item["dimensions"], combinations=item["combinations"]) for item in data]


def get_levels_info(run: LevelScoreRun) -> List[LevelInfo]:
  return _deserialize_levels(run.levels_payload)


def start_level_score_run(levels: List[List[str]] | None = None) -> LevelScoreRun:
  target_levels = levels or DEFAULT_LEVELS
  with session_context() as session:
    level_infos: List[LevelInfo] = []
    total_combos = 0
    for dims in target_levels:
      combos = _count_combinations(session, dims)
      total_combos += combos
      level_infos.append(LevelInfo(level_id=_level_id(dims), dimensions=list(dims), combinations=combos))

    run = LevelScoreRun(
      status="pending",
      levels_payload=_serialize_levels(level_infos),
      total_levels=len(level_infos),
      total_combinations=total_combos,
      started_at=datetime.utcnow()
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def get_run(run_id: int) -> LevelScoreRun | None:
  with session_context() as session:
    return session.get(LevelScoreRun, run_id)


def list_runs(limit: int = 5) -> List[LevelScoreRun]:
  with session_context() as session:
    stmt = select(LevelScoreRun).order_by(LevelScoreRun.id.desc()).limit(limit)
    return session.exec(stmt).all()


def get_run_results(run_id: int) -> List[LevelScore]:
  with session_context() as session:
    stmt = select(LevelScore).where(LevelScore.run_id == run_id).order_by(LevelScore.score_final.desc().nulls_last())
    return session.exec(stmt).all()


def get_active_run() -> LevelScoreRun | None:
  with session_context() as session:
    stmt = (
      select(LevelScoreRun)
      .where(LevelScoreRun.status.in_(["pending", "running"]))
      .order_by(LevelScoreRun.id.desc())
      .limit(1)
    )
    return session.exec(stmt).first()


def process_next_level(run_id: int) -> LevelScoreRun:
  with session_context() as session:
    run = session.get(LevelScoreRun, run_id)
    if run is None:
      raise ValueError("Run not found")
    if run.status == "completed":
      return run

    level_infos = _deserialize_levels(run.levels_payload)
    if run.current_index >= len(level_infos):
      run.status = "completed"
      run.finished_at = datetime.utcnow()
      session.add(run)
      session.commit()
      return run

    current_info = level_infos[run.current_index]
    start = time.perf_counter()
    cov_level, combos_measured = _compute_level_metrics(session, current_info.dimensions)
    combos_processed = combos_measured or current_info.combinations
    duration = (time.perf_counter() - start) * 1000

    level_record = LevelScore(
      run_id=run.id,
      level_id=current_info.level_id,
      dimensions_json=json.dumps(current_info.dimensions),
      cov_nivel=cov_level,
      n_combinacoes=combos_processed
    )
    session.add(level_record)

    run.status = "running"
    run.processed_levels += 1
    run.current_index += 1
    run.processed_combinations += combos_processed
    if run.avg_duration_ms:
      run.avg_duration_ms = (run.avg_duration_ms * (run.processed_levels - 1) + duration) / run.processed_levels
    else:
      run.avg_duration_ms = duration

    if run.avg_duration_ms and run.total_combinations:
      remaining_combos = max(run.total_combinations - run.processed_combinations, 0)
      avg_per_combo = (run.avg_duration_ms / 1000) / max(combos_processed, 1)
      run.estimated_seconds = round(remaining_combos * avg_per_combo, 2)

    run.last_message = f"{current_info.level_id}: {combos_processed} combinações processadas"

    if run.current_index >= len(level_infos):
      _finalize_run(session, run.id)
      run.status = "completed"
      run.finished_at = datetime.utcnow()

    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def _finalize_run(session: Session, run_id: int) -> None:
  stmt = select(LevelScore).where(LevelScore.run_id == run_id)
  rows = session.exec(stmt).all()
  if not rows:
    return

  cov_values = [row.cov_nivel for row in rows]
  combo_values = [row.n_combinacoes for row in rows]
  min_cov, max_cov = min(cov_values), max(cov_values)
  min_combo, max_combo = min(combo_values), max(combo_values)

  def normalize(value: float, min_value: float, max_value: float) -> float:
    if max_value == min_value:
      return 0.5
    return (value - min_value) / (max_value - min_value)

  for row in rows:
    norm_cov = normalize(row.cov_nivel, min_cov, max_cov)
    norm_combo = normalize(row.n_combinacoes, min_combo, max_combo)
    row.score_cov = round(1 - norm_cov, 4)
    row.score_complex = round(1 - norm_combo, 4)
    row.score_final = round((row.score_cov + row.score_complex) / 2, 4)
    session.add(row)
  session.commit()
