import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.db.session import get_session
from app.models import PlanningRecord
from app.schemas.analytics import (
  AggregateResponse,
  CombinationRecord,
  ForecastResponse,
  LevelDescriptor,
  LevelScoreRowPayload,
  LevelScoreRunPayload,
  PreprocessResponse,
  ScenarioSeries,
  SummaryResponse,
  TypeProductBaseline
)
from app.services.analytics_service import (
  compute_baseline,
  generate_aggregate,
  generate_forecast,
  get_type_product_baseline,
  get_yearly_totals
)
from app.services.preprocess_service import (
  generate_preprocess_payload,
  list_combinations_snapshot
)
from app.services import level_score_service


class LevelScoreRunRequest(BaseModel):
  levels: List[List[str]] | None = None

router = APIRouter()


@router.get("/summary", response_model=SummaryResponse)
def get_summary():
  yearly, combinations = get_yearly_totals()
  baseline = compute_baseline(yearly)
  return SummaryResponse.from_raw(yearly, combinations, baseline)


@router.get("/type-product", response_model=list[TypeProductBaseline])
def get_type_product_summary():
  dataset = get_type_product_baseline()
  return [TypeProductBaseline.from_raw(tipo, historico, baseline) for tipo, historico, baseline in dataset]


@router.get("/aggregate", response_model=AggregateResponse)
def aggregate_view(
  group_by: list[str] = Query(default=["ano", "diretor", "sigla_uf"]),
  metric: str = Query(default="volume", pattern="^(volume|revenue)$"),
  session=Depends(get_session)
):
  try:
    data = generate_aggregate(session, group_by, metric)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  return data


@router.get("/forecast", response_model=ForecastResponse)
def forecast_view(
  group_by: list[str] = Query(default=["cod_produto", "diretor", "sigla_uf", "tipo_produto", "familia"]),
  session=Depends(get_session)
):
  try:
    data = generate_forecast(session, group_by)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  return data

def _normalize_multi(values: list[str] | None) -> list[str] | None:
  if not values:
    return None
  normalized = [value for value in values if value]
  return normalized or None


@router.get("/preprocess", response_model=PreprocessResponse)
def preprocess_view(
  diretor: list[str] | None = Query(default=None),
  sigla_uf: list[str] | None = Query(default=None),
  tipo_produto: list[str] | None = Query(default=None),
  familia: list[str] | None = Query(default=None),
  familia_producao: list[str] | None = Query(default=None),
  marca: list[str] | None = Query(default=None),
  situacao_lista: list[str] | None = Query(default=None),
  cod_produto: list[str] | None = Query(default=None),
  produto: list[str] | None = Query(default=None),
  session=Depends(get_session)
):
  filters = {
    "diretor": _normalize_multi(diretor),
    "sigla_uf": _normalize_multi(sigla_uf),
    "tipo_produto": _normalize_multi(tipo_produto),
    "familia": _normalize_multi(familia),
    "familia_producao": _normalize_multi(familia_producao),
    "marca": _normalize_multi(marca),
    "situacao_lista": _normalize_multi(situacao_lista),
    "cod_produto": _normalize_multi(cod_produto),
    "produto": _normalize_multi(produto)
  }

  total_records, scenario_payload = generate_preprocess_payload(session, filters)
  scenarios = [
    ScenarioSeries.from_raw(defn.id, defn.label, defn.description, totals)
    for defn, totals in scenario_payload
  ]

  return PreprocessResponse(
    filters=filters,
    total_records=total_records,
    scenarios=scenarios
  )


@router.get("/combinations", response_model=list[CombinationRecord])
def combinations_view(
  limit: int = 500,
  ano: int | None = None,
  diretor: list[str] | None = Query(default=None),
  sigla_uf: list[str] | None = Query(default=None),
  tipo_produto: list[str] | None = Query(default=None),
  familia: list[str] | None = Query(default=None),
  familia_producao: list[str] | None = Query(default=None),
  marca: list[str] | None = Query(default=None),
  cod_produto: list[str] | None = Query(default=None),
  session=Depends(get_session)
):
  filters = {
    "diretor": _normalize_multi(diretor),
    "sigla_uf": _normalize_multi(sigla_uf),
    "tipo_produto": _normalize_multi(tipo_produto),
    "familia": _normalize_multi(familia),
    "familia_producao": _normalize_multi(familia_producao),
    "marca": _normalize_multi(marca),
    "cod_produto": _normalize_multi(cod_produto)
  }

  combinations = list_combinations_snapshot(
    session,
    limit=limit,
    ano=ano,
    filters=filters
  )

  return [
    CombinationRecord(
      id=item.id or 0,
      diretor=item.diretor,
      sigla_uf=item.sigla_uf,
      tipo_produto=item.tipo_produto,
      familia=item.familia,
      familia_producao=item.familia_producao,
      marca=item.marca,
      cod_produto=item.cod_produto,
      produto=item.produto,
      registros=item.registros,
      first_year=item.first_year,
      last_year=item.last_year,
      volume_total=item.volume_total,
      receita_total=item.receita_total
    )
    for item in combinations
  ]


def _run_to_payload(run) -> LevelScoreRunPayload:
  levels_info = level_score_service.get_levels_info(run)
  descriptors = []
  for idx, info in enumerate(levels_info):
    descriptors.append(
      LevelDescriptor(
        level_id=info.level_id,
        dimensions=info.dimensions,
        combinations=info.combinations,
        status="completed" if idx < run.processed_levels else "pending"
      )
    )
  return LevelScoreRunPayload(
    id=run.id,
    status=run.status,
    total_levels=run.total_levels,
    processed_levels=run.processed_levels,
    total_combinations=run.total_combinations,
    processed_combinations=run.processed_combinations,
    estimated_seconds=run.estimated_seconds,
    started_at=run.started_at,
    finished_at=run.finished_at,
    last_message=run.last_message,
    levels=descriptors
  )


@router.post("/level-score/run", response_model=LevelScoreRunPayload)
def start_level_score_run(payload: LevelScoreRunRequest | None = None):
  active_run = level_score_service.get_active_run()
  if active_run:
    raise HTTPException(status_code=400, detail="Já existe um cálculo em andamento.")
  run = level_score_service.start_level_score_run(payload.levels if payload else None)
  return _run_to_payload(run)


@router.post("/level-score/run/{run_id}/next", response_model=LevelScoreRunPayload)
def process_next_level(run_id: int):
  try:
    run = level_score_service.process_next_level(run_id)
  except ValueError as exc:
    raise HTTPException(status_code=404, detail=str(exc)) from exc
  return _run_to_payload(run)


@router.get("/level-score/run/{run_id}", response_model=LevelScoreRunPayload)
def get_level_score_run(run_id: int):
  run = level_score_service.get_run(run_id)
  if not run:
    raise HTTPException(status_code=404, detail="Execução não encontrada")
  return _run_to_payload(run)


@router.get("/level-score/results/{run_id}", response_model=list[LevelScoreRowPayload])
def get_level_score_results(run_id: int):
  run = level_score_service.get_run(run_id)
  if not run:
    raise HTTPException(status_code=404, detail="Execução não encontrada")
  rows = level_score_service.get_run_results(run_id)
  result = []
  for row in rows:
    result.append(
      LevelScoreRowPayload(
        level_id=row.level_id,
        dimensions=json.loads(row.dimensions_json),
        cov_nivel=row.cov_nivel,
        n_combinacoes=row.n_combinacoes,
        score_cov=row.score_cov,
        score_complex=row.score_complex,
        score_final=row.score_final
      )
    )
  return result
