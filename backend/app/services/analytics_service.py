from collections import defaultdict
from typing import Dict, List, Tuple

from sqlalchemy import func, select

from app.db.session import session_context
from app.models import PlanningRecord


def get_yearly_totals() -> Tuple[List[Tuple[int, float, float]], int]:
  with session_context() as session:
    statement = (
      select(
        PlanningRecord.ano,
        func.sum(PlanningRecord.fat_liq_kg),
        func.sum(PlanningRecord.fat_liq_reais),
        func.count()
      )
      .group_by(PlanningRecord.ano)
      .order_by(PlanningRecord.ano)
    )
    rows = session.exec(statement).all()
    total_rows_statement = select(func.count()).select_from(PlanningRecord)
    raw_total = session.exec(total_rows_statement).one()
    total_rows = raw_total[0] if isinstance(raw_total, (tuple, list)) else raw_total or 0
    yearly = [(row[0], float(row[1] or 0), float(row[2] or 0)) for row in rows]
    return yearly, int(total_rows)


def compute_baseline(yearly: List[Tuple[int, float, float]]) -> List[Tuple[int, float, float]]:
  if not yearly:
    return []

  historical_years = [year for year, _, _ in yearly if year <= 2026]
  if len(historical_years) < 2:
    return []

  start_year = historical_years[0]
  end_year = historical_years[-1]
  periods = end_year - start_year or 1

  start_volume = next(volume for year, volume, _ in yearly if year == start_year)
  end_volume = next(volume for year, volume, _ in yearly if year == end_year)
  start_revenue = next(revenue for year, _, revenue in yearly if year == start_year)
  end_revenue = next(revenue for year, _, revenue in yearly if year == end_year)

  def safe_cagr(start: float, end: float) -> float:
    if start <= 0 or end <= 0:
      return 0.0
    return (end / start) ** (1 / periods) - 1

  volume_cagr = safe_cagr(start_volume, end_volume)
  revenue_cagr = safe_cagr(start_revenue, end_revenue)

  baseline = []
  last_volume = end_volume
  last_revenue = end_revenue

  for i, year in enumerate(range(2027, 2031), start=1):
    last_volume = max(0.0, last_volume * (1 + volume_cagr))
    last_revenue = max(0.0, last_revenue * (1 + revenue_cagr))
    baseline.append((year, last_volume, last_revenue))

  return baseline


def get_type_product_baseline() -> List[Tuple[str, List[Tuple[int, float, float]], List[Tuple[int, float, float]]]]:
  with session_context() as session:
    statement = (
      select(
        PlanningRecord.tipo_produto,
        PlanningRecord.ano,
        func.sum(PlanningRecord.fat_liq_kg),
        func.sum(PlanningRecord.fat_liq_reais)
      )
      .group_by(PlanningRecord.tipo_produto, PlanningRecord.ano)
    )
    rows = session.exec(statement).all()

  grouped: Dict[str, List[Tuple[int, float, float]]] = defaultdict(list)
  for tipo, ano, volume, revenue in rows:
    grouped[tipo].append((ano, float(volume or 0), float(revenue or 0)))

  result = []
  for tipo, values in grouped.items():
    values.sort(key=lambda item: item[0])
    baseline = compute_baseline(values)
    result.append((tipo, values, baseline))

  return result


ALLOWED_FIELDS = {
  "ano": PlanningRecord.ano,
  "diretor": PlanningRecord.diretor,
  "sigla_uf": PlanningRecord.sigla_uf,
  "tipo_produto": PlanningRecord.tipo_produto,
  "familia": PlanningRecord.familia,
  "familia_producao": PlanningRecord.familia_producao,
  "marca": PlanningRecord.marca,
  "situacao_lista": PlanningRecord.situacao_lista,
  "cod_produto": PlanningRecord.cod_produto,
  "produto": PlanningRecord.produto
}


def generate_aggregate(session, group_by: List[str], metric: str):
  if not group_by:
    raise ValueError("Informe ao menos um campo de agrupamento.")

  invalid = [field for field in group_by if field not in ALLOWED_FIELDS]
  if invalid:
    raise ValueError(f"Campos inválidos para agrupamento: {', '.join(invalid)}")

  grouping_columns = [ALLOWED_FIELDS[field] for field in group_by]
  value_column = PlanningRecord.fat_liq_kg if metric == "volume" else PlanningRecord.fat_liq_reais

  statement = (
    select(*grouping_columns, PlanningRecord.ano, func.sum(value_column))
    .group_by(*grouping_columns, PlanningRecord.ano)
  )

  rows = session.exec(statement).all()

  grouped: Dict[Tuple, List[Tuple[int, float]]] = defaultdict(list)
  for *keys, year, value in rows:
    grouped[tuple(keys)].append((year, float(value or 0)))

  result = []
  for key_tuple, values in grouped.items():
    key_dict = {field: key_tuple[idx] for idx, field in enumerate(group_by)}
    values.sort(key=lambda item: item[0])
    aggregates = [
      {
        "year": year,
        "volume": value if metric == "volume" else 0,
        "revenue": value if metric == "revenue" else 0
      }
      for year, value in values
    ]
    result.append({"key": key_dict, "values": aggregates})

  return {
    "group_by": group_by,
    "metric": metric,
    "rows": result
  }


def generate_forecast(session, group_by: List[str]):
  invalid = [field for field in group_by if field not in ALLOWED_FIELDS]
  if invalid:
    raise ValueError(f"Campos inválidos para agrupamento: {', '.join(invalid)}")

  grouping_columns = [ALLOWED_FIELDS[field] for field in group_by]

  statement = (
    select(
      *grouping_columns,
      PlanningRecord.ano,
      func.sum(PlanningRecord.fat_liq_kg),
      func.sum(PlanningRecord.fat_liq_reais)
    )
    .group_by(*grouping_columns, PlanningRecord.ano)
  )

  rows = session.exec(statement).all()

  history_map: Dict[Tuple, List[Tuple[int, float, float]]] = defaultdict(list)
  for *keys, year, volume, revenue in rows:
    history_map[tuple(keys)].append((year, float(volume or 0), float(revenue or 0)))

  results = []
  for key_tuple, history in history_map.items():
    key_dict = {field: key_tuple[idx] for idx, field in enumerate(group_by)}
    history.sort(key=lambda item: item[0])
    baseline = compute_baseline(history)
    baseline = [(year, max(0.0, volume), max(0.0, revenue)) for year, volume, revenue in baseline]
    results.append({
      "key": key_dict,
      "historico": [
        {
          "year": year,
          "volume": volume,
          "revenue": revenue
        }
        for year, volume, revenue in history
      ],
      "baseline": [
        {
          "year": year,
          "volume": volume,
          "revenue": revenue
        }
        for year, volume, revenue in baseline
      ]
    })

  return {
    "group_by": group_by,
    "rows": results
  }
