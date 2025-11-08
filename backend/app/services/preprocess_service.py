from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import and_, delete, func, select
from sqlmodel import Session

from app.db.session import session_context
from app.models import PlanningCombination, PlanningRecord
from app.services.analytics_service import compute_baseline

FilterDict = Dict[str, Optional[List[str]]]


@dataclass(frozen=True)
class ScenarioDefinition:
  id: str
  label: str
  description: str
  volume_multiplier: float = 1.0
  revenue_multiplier: float = 1.0


SCENARIO_DEFINITIONS: List[ScenarioDefinition] = [
  ScenarioDefinition(
    id="base",
    label="Base 2030",
    description="Projeção automática (CAGR) usando o histórico filtrado."
  ),
  ScenarioDefinition(
    id="optimistic",
    label="Otimista",
    description="Incremento de +5% em volume e +4% em receita para os anos projetados.",
    volume_multiplier=1.05,
    revenue_multiplier=1.04
  ),
  ScenarioDefinition(
    id="pessimistic",
    label="Pessimista",
    description="Redução de -3% em volume e receita nos anos projetados.",
    volume_multiplier=0.97,
    revenue_multiplier=0.97
  )
] 

def _coerce_values(raw_value: Optional[Sequence[str] | str]) -> Optional[List[str]]:
  if raw_value is None:
    return None
  if isinstance(raw_value, str):
    values = [raw_value]
  else:
    values = [item for item in raw_value if item not in (None, "")]
  return values or None


def apply_filters(statement, filters: FilterDict, model=PlanningRecord):
  for field, raw_values in filters.items():
    values = _coerce_values(raw_values)
    if not values:
      continue
    column = getattr(model, field, None)
    if column is None:
      continue
    if len(values) == 1:
      statement = statement.where(column == values[0])
    else:
      statement = statement.where(column.in_(values))
  return statement


def _collect_yearly_totals(session: Session, filters: FilterDict) -> List[Tuple[int, float, float]]:
  statement = (
    select(
      PlanningRecord.ano,
      func.sum(PlanningRecord.fat_liq_kg),
      func.sum(PlanningRecord.fat_liq_reais)
    )
    .group_by(PlanningRecord.ano)
    .order_by(PlanningRecord.ano)
  )
  statement = apply_filters(statement, filters)
  rows = session.exec(statement).all()
  return [
    (row[0], float(row[1] or 0), float(row[2] or 0))
    for row in rows
  ]


def _count_records(session: Session, filters: FilterDict) -> int:
  statement = select(func.count()).select_from(PlanningRecord)
  statement = apply_filters(statement, filters)
  result = session.exec(statement).one()
  total = result[0] if isinstance(result, (tuple, list)) else result
  return int(total or 0)


def generate_preprocess_payload(
  session: Session,
  filters: FilterDict
) -> Tuple[int, List[Tuple[ScenarioDefinition, List[Tuple[int, float, float]]]]]:
  yearly = _collect_yearly_totals(session, filters)
  total_records = _count_records(session, filters)

  historical = [(year, volume, revenue) for year, volume, revenue in yearly if year <= 2026]
  existing_future = [(year, volume, revenue) for year, volume, revenue in yearly if year > 2026]
  baseline = compute_baseline(yearly)

  scenario_payload = []
  for scenario in SCENARIO_DEFINITIONS:
    projections_source = baseline or existing_future
    projections: List[Tuple[int, float, float]] = []
    for year, volume, revenue in projections_source:
      volume_projection = volume * scenario.volume_multiplier
      revenue_projection = revenue * scenario.revenue_multiplier
      projections.append((year, volume_projection, revenue_projection))

    combined = historical + projections
    scenario_payload.append((scenario, combined))

  return total_records, scenario_payload


def rebuild_combinations_snapshot() -> int:
  """Recalcula a tabela auxiliar de combinações após ingestão."""
  with session_context() as session:
    session.exec(delete(PlanningCombination))
    statement = (
      select(
        PlanningRecord.diretor,
        PlanningRecord.sigla_uf,
        PlanningRecord.tipo_produto,
        PlanningRecord.familia,
        PlanningRecord.familia_producao,
        PlanningRecord.marca,
        PlanningRecord.cod_produto,
        PlanningRecord.produto,
        func.count(),
        func.min(PlanningRecord.ano),
        func.max(PlanningRecord.ano),
        func.sum(PlanningRecord.fat_liq_kg),
        func.sum(PlanningRecord.fat_liq_reais)
      )
      .group_by(
        PlanningRecord.diretor,
        PlanningRecord.sigla_uf,
        PlanningRecord.tipo_produto,
        PlanningRecord.familia,
        PlanningRecord.familia_producao,
        PlanningRecord.marca,
        PlanningRecord.cod_produto,
        PlanningRecord.produto
      )
      .order_by(PlanningRecord.diretor, PlanningRecord.sigla_uf, PlanningRecord.tipo_produto)
    )

    rows = session.exec(statement).all()
    total = 0
    for (
      diretor,
      sigla_uf,
      tipo_produto,
      familia,
      familia_producao,
      marca,
      cod_produto,
      produto,
      registros,
      first_year,
      last_year,
      volume_total,
      receita_total
    ) in rows:
      snapshot = PlanningCombination(
        diretor=diretor or "",
        sigla_uf=sigla_uf or "",
        tipo_produto=tipo_produto or "",
        familia=familia or "",
        familia_producao=familia_producao or "",
        marca=marca or "",
        cod_produto=cod_produto or "",
        produto=produto or "",
        registros=int(registros or 0),
        first_year=int(first_year or 0),
        last_year=int(last_year or 0),
        volume_total=float(volume_total or 0),
        receita_total=float(receita_total or 0)
      )
      session.add(snapshot)
      total += 1
    return total


def list_combinations_snapshot(
  session: Session,
  *,
  limit: int = 500,
  ano: Optional[int] = None,
  filters: Optional[FilterDict] = None
) -> List[PlanningCombination]:
  statement = select(PlanningCombination).order_by(
    PlanningCombination.diretor,
    PlanningCombination.sigla_uf,
    PlanningCombination.tipo_produto,
    PlanningCombination.familia,
    PlanningCombination.marca,
    PlanningCombination.cod_produto
  )

  if filters:
    statement = apply_filters(statement, filters, model=PlanningCombination)

  if ano is not None:
    statement = statement.where(
      and_(
        PlanningCombination.first_year <= ano,
        PlanningCombination.last_year >= ano
      )
    )

  if limit:
    statement = statement.limit(limit)

  return session.exec(statement).all()
