"""Core schema definitions shared across the backend services."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Literal, Optional

REQUIRED_COLUMNS = [
  "Ano",
  "Diretor",
  "Sigla UF",
  "Tipo Produto",
  "Família",
  "Família Produção",
  "Marca",
  "SITUAÇÃO LISTA",
  "Cod Produto",
  "Produto",
  "Fat Liq (Kg)",
  "Fat Liq (R$)",
]


class ForecastMethod(str, Enum):
  """Supported forecast strategies."""

  CAGR = "cagr"
  LINEAR_REGRESSION = "linear_regression"
  MANUAL_PERCENTAGE = "manual_percentage"


class PriceStrategy(str, Enum):
  """Supported price adjustment strategies."""

  HOLD_2026 = "hold_2026"
  CONSTANT_GROWTH = "constant_growth"


@dataclass
class ManualGrowthFactor:
  """Represents manual percentage growth at a specific hierarchy level."""

  level: Literal[
    "Diretor",
    "Sigla UF",
    "Tipo Produto",
    "Família",
    "Família Produção",
    "Marca",
  ]
  value: str
  percentage: float


@dataclass
class ForecastRequest:
  """Payload describing how to generate the forecast."""

  dataset: List[Dict[str, str | int | float]]
  method: ForecastMethod
  value_field: Literal["Fat Liq (Kg)", "Fat Liq (R$)"]
  forecast_years: List[int] = field(default_factory=lambda: [2027, 2028, 2029, 2030])
  manual_growth: Optional[List[ManualGrowthFactor]] = None
  price_strategy: PriceStrategy = PriceStrategy.HOLD_2026
  price_growth_rate: float = 0.03

  def __post_init__(self) -> None:
    if not self.dataset:
      raise ValueError("Dataset cannot be empty.")
    missing = set(REQUIRED_COLUMNS) - set(self.dataset[0].keys())
    if missing:
      raise ValueError(
        f"Dataset is missing required columns: {', '.join(sorted(missing))}"
      )
    if self.price_growth_rate < -0.5:
      raise ValueError("Price growth rate cannot be lower than -50%.")


@dataclass
class ForecastResponse:
  """Response returned after a forecast request."""

  forecast: List[Dict[str, str | int | float]]
  metadata: Dict[str, str | float | int]
