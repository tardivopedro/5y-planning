from datetime import datetime
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel


class YearAggregate(BaseModel):
  year: int
  volume: float
  revenue: float


class SummaryResponse(BaseModel):
  totals: List[YearAggregate]
  baseline: List[YearAggregate]
  combinations: int

  @classmethod
  def from_raw(
    cls,
    yearly: List[Tuple[int, float, float]],
    combinations: int,
    baseline: List[Tuple[int, float, float]]
  ) -> "SummaryResponse":
    def to_models(raw: List[Tuple[int, float, float]]) -> List[YearAggregate]:
      return [
        YearAggregate(year=year, volume=round(volume, 2), revenue=round(revenue, 2))
        for year, volume, revenue in raw
      ]

    return cls(
      totals=to_models(yearly),
      baseline=to_models(baseline),
      combinations=combinations
    )


class TypeProductBaseline(BaseModel):
  tipo_produto: str
  historico: List[YearAggregate]
  baseline: List[YearAggregate]

  @classmethod
  def from_raw(
    cls,
    tipo: str,
    historico: List[Tuple[int, float, float]],
    baseline: List[Tuple[int, float, float]]
  ) -> "TypeProductBaseline":
    def map_values(raw: List[Tuple[int, float, float]]) -> List[YearAggregate]:
      return [
        YearAggregate(year=year, volume=round(volume, 2), revenue=round(revenue, 2))
        for year, volume, revenue in raw
      ]

    return cls(
      tipo_produto=tipo,
      historico=map_values(historico),
      baseline=map_values(baseline)
    )


class AggregateRow(BaseModel):
  key: dict
  values: List[YearAggregate]


class AggregateResponse(BaseModel):
  group_by: List[str]
  metric: str
  rows: List[AggregateRow]


class ForecastRow(BaseModel):
  key: dict
  historico: List[YearAggregate]
  baseline: List[YearAggregate]


class ForecastResponse(BaseModel):
  group_by: List[str]
  rows: List[ForecastRow]


class ScenarioSeries(BaseModel):
  id: str
  label: str
  description: str
  totals: List[YearAggregate]

  @classmethod
  def from_raw(
    cls,
    scenario_id: str,
    label: str,
    description: str,
    values: List[Tuple[int, float, float]]
  ) -> "ScenarioSeries":
    return cls(
      id=scenario_id,
      label=label,
      description=description,
      totals=[
        YearAggregate(year=year, volume=round(volume, 2), revenue=round(revenue, 2))
        for year, volume, revenue in values
      ]
    )


class PreprocessResponse(BaseModel):
  filters: Dict[str, Optional[List[str]]]
  total_records: int
  scenarios: List[ScenarioSeries]


class CombinationRecord(BaseModel):
  id: int
  diretor: str
  sigla_uf: str
  tipo_produto: str
  familia: str
  familia_producao: str
  marca: str
  cod_produto: str
  produto: str
  registros: int
  first_year: int
  last_year: int
  volume_total: float
  receita_total: float


class LevelDescriptor(BaseModel):
  level_id: str
  dimensions: List[str]
  combinations: int
  status: str


class LevelScoreRunPayload(BaseModel):
  id: int
  status: str
  total_levels: int
  processed_levels: int
  total_combinations: int
  processed_combinations: int
  estimated_seconds: Optional[float]
  started_at: datetime
  finished_at: Optional[datetime]
  last_message: Optional[str]
  levels: List[LevelDescriptor]


class LevelScoreRowPayload(BaseModel):
  level_id: str
  dimensions: List[str]
  cov_nivel: float
  n_combinacoes: int
  score_cov: Optional[float]
  score_complex: Optional[float]
  score_final: Optional[float]
