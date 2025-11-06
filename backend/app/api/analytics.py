from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select

from app.db.session import get_session
from app.models import PlanningRecord
from app.schemas.analytics import (
  AggregateResponse,
  ForecastResponse,
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
