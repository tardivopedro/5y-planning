from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select

from app.db.session import get_session
from app.models import PlanningRecord
from app.schemas.analytics import (
  AggregateResponse,
  CombinationRecord,
  ForecastResponse,
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


@router.get("/preprocess", response_model=PreprocessResponse)
def preprocess_view(
  diretor: str | None = None,
  sigla_uf: str | None = None,
  tipo_produto: str | None = None,
  familia: str | None = None,
  familia_producao: str | None = None,
  marca: str | None = None,
  situacao_lista: str | None = None,
  cod_produto: str | None = None,
  produto: str | None = None,
  session=Depends(get_session)
):
  filters = {
    "diretor": diretor,
    "sigla_uf": sigla_uf,
    "tipo_produto": tipo_produto,
    "familia": familia,
    "familia_producao": familia_producao,
    "marca": marca,
    "situacao_lista": situacao_lista,
    "cod_produto": cod_produto,
    "produto": produto
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
  diretor: str | None = None,
  sigla_uf: str | None = None,
  tipo_produto: str | None = None,
  familia: str | None = None,
  familia_producao: str | None = None,
  marca: str | None = None,
  cod_produto: str | None = None,
  session=Depends(get_session)
):
  combinations = list_combinations_snapshot(
    session,
    limit=limit,
    ano=ano,
    diretor=diretor,
    sigla_uf=sigla_uf,
    tipo_produto=tipo_produto,
    familia=familia,
    familia_producao=familia_producao,
    marca=marca,
    cod_produto=cod_produto
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
