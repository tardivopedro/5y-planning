"""Core forecasting logic used by the API layer."""
from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Any, Dict, List, Sequence, Tuple

from ..schemas.core import (
    ForecastMethod,
    ForecastRequest,
    ManualGrowthFactor,
    PriceStrategy,
    REQUIRED_COLUMNS,
)

HierarchyKey = Tuple[str, ...]

DESCRIPTIVE_COLUMNS = [
    col
    for col in REQUIRED_COLUMNS
    if col not in {"Ano", "Fat Liq (Kg)", "Fat Liq (R$)"}
]


@dataclass(frozen=True)
class Hierarchy:
    """Represents the hierarchical ordering for aggregations."""

    levels: Tuple[str, ...] = (
        "Diretor",
        "Sigla UF",
        "Tipo Produto",
        "Família",
        "Família Produção",
        "Marca",
        "Cod Produto",
    )

    def hierarchy_key(self, row: Dict[str, Any]) -> HierarchyKey:
        return tuple(str(row[level]) for level in self.levels)


class ForecastEngine:
    """Encapsulates the forecasting pipeline."""

    hierarchy = Hierarchy()

    def generate_forecast(self, request: ForecastRequest) -> Dict[str, object]:
        dataset = request.dataset
        self._validate_dataset(dataset)

        base_years = sorted({int(row["Ano"]) for row in dataset})
        if base_years[-1] < 2026:
            raise ValueError("Dataset must contain the 2026 baseline plan.")

        grouped_history = self._group_by_hierarchy(dataset, request.value_field)

        if request.method == ForecastMethod.CAGR:
            projections = self._forecast_with_cagr(grouped_history, request)
        elif request.method == ForecastMethod.LINEAR_REGRESSION:
            projections = self._forecast_with_regression(grouped_history, request)
        elif request.method == ForecastMethod.MANUAL_PERCENTAGE:
            projections = self._forecast_with_manual_percentages(grouped_history, request)
        else:  # pragma: no cover - safeguard for new enum members
            raise ValueError(f"Unsupported forecast method: {request.method}")

        priced = self._apply_price_strategy(projections, request)

        metadata = {
            "method": request.method.value,
            "value_field": request.value_field,
            "price_strategy": request.price_strategy.value,
        }
        return {"forecast": priced, "metadata": metadata}

    # ------------------------------------------------------------------
    # Validation helpers
    def _validate_dataset(self, dataset: List[Dict[str, Any]]) -> None:
        missing_columns = set(REQUIRED_COLUMNS) - set(dataset[0].keys())
        if missing_columns:
            raise ValueError(
                "Dataset is missing required columns: " + ", ".join(sorted(missing_columns))
            )

    # ------------------------------------------------------------------
    # Grouping helpers
    def _group_by_hierarchy(
        self, dataset: List[Dict[str, Any]], value_field: str
    ) -> Dict[HierarchyKey, Dict[str, Any]]:
        grouped: Dict[HierarchyKey, Dict[str, Any]] = {}
        for row in dataset:
            if row.get("SITUAÇÃO LISTA", "Ativo") != "Ativo":
                continue
            key = self.hierarchy.hierarchy_key(row)
            group = grouped.setdefault(
                key,
                {
                    "values": {},
                    "kg": {},
                    "revenue": {},
                    "metadata": {col: row[col] for col in DESCRIPTIVE_COLUMNS},
                },
            )
            year = int(row["Ano"])
            group["values"][year] = float(row[value_field])
            group["kg"][year] = float(row["Fat Liq (Kg)"])
            group["revenue"][year] = float(row["Fat Liq (R$)"])
            if year == 2026:
                group["metadata"]["Fat Liq (Kg) Base 2026"] = group["kg"][year]
                group["metadata"]["Fat Liq (R$) Base 2026"] = group["revenue"][year]
        for payload in grouped.values():
            payload["base_price"] = self._compute_base_price(payload)
        return grouped

    def _compute_base_price(self, payload: Dict[str, Any]) -> float:
        kg_2026 = payload["kg"].get(2026)
        revenue_2026 = payload["revenue"].get(2026)
        if kg_2026 in (None, 0):
            return 0.0
        return float(revenue_2026) / float(kg_2026)

    # ------------------------------------------------------------------
    # Forecasting implementations
    def _forecast_with_cagr(
        self,
        grouped: Dict[HierarchyKey, Dict[str, Any]],
        request: ForecastRequest,
    ) -> List[Dict[str, Any]]:
        projections: List[Dict[str, Any]] = []
        for payload in grouped.values():
            values = payload["values"]
            if not values:
                continue
            sorted_years = sorted(values.keys())
            start_year, end_year = sorted_years[0], sorted_years[-1]
            start_value, end_value = values[start_year], values[end_year]
            periods = end_year - start_year or 1
            growth = self._compute_cagr(start_value, end_value, periods)
            last_value = values.get(2026, end_value)
            projections.extend(
                self._project_growth_for_years(
                    payload["metadata"],
                    last_value,
                    growth,
                    request.forecast_years,
                    payload["base_price"],
                    request.value_field,
                )
            )
        return projections

    def _forecast_with_regression(
        self,
        grouped: Dict[HierarchyKey, Dict[str, Any]],
        request: ForecastRequest,
    ) -> List[Dict[str, Any]]:
        projections: List[Dict[str, Any]] = []
        for payload in grouped.values():
            values = payload["values"]
            if len(values) < 2:
                continue
            years = sorted(values.keys())
            y_values = [values[year] for year in years]
            slope, intercept = self._linear_regression(years, y_values)
            for year in request.forecast_years:
                projections.append(
                    self._build_projection_row(
                        payload["metadata"],
                        year,
                        max(intercept + slope * year, 0.0),
                        payload["base_price"],
                        values.get(2026),
                        request.value_field,
                        growth_rate=slope / values[years[-1]] if values[years[-1]] else 0.0,
                    )
                )
        return projections

    def _forecast_with_manual_percentages(
        self,
        grouped: Dict[HierarchyKey, Dict[str, Any]],
        request: ForecastRequest,
    ) -> List[Dict[str, Any]]:
        if not request.manual_growth:
            raise ValueError("Manual growth factors must be provided for manual percentage forecasts.")
        projections: List[Dict[str, Any]] = []
        for payload in grouped.values():
            values = payload["values"]
            last_value = values.get(2026)
            if last_value is None:
                continue
            growth_rate = self._resolve_manual_growth(payload["metadata"], request.manual_growth)
            projections.extend(
                self._project_growth_for_years(
                    payload["metadata"],
                    last_value,
                    growth_rate,
                    request.forecast_years,
                    payload["base_price"],
                    request.value_field,
                )
            )
        return projections

    def _apply_price_strategy(
        self,
        projections: List[Dict[str, Any]],
        request: ForecastRequest,
    ) -> List[Dict[str, Any]]:
        priced: List[Dict[str, Any]] = []
        for row in projections:
            base_price = float(row.get("Preço Base 2026", 0.0))
            if request.price_strategy == PriceStrategy.HOLD_2026:
                price = base_price
            else:
                years_ahead = int(row["Ano"]) - 2026
                price = base_price * (1 + request.price_growth_rate) ** years_ahead
            row_copy = dict(row)
            revenue = price * float(row_copy.get("Fat Liq (Kg)", 0.0))
            if request.value_field == "Fat Liq (R$)":
                revenue = float(row_copy.get("Fat Liq (R$)", 0.0))
            else:
                row_copy["Fat Liq (R$)"] = revenue
            row_copy["Preço Projetado"] = price
            row_copy["Receita Projetada"] = revenue
            priced.append(row_copy)
        return priced

    # ------------------------------------------------------------------
    # Utility helpers
    def _project_growth_for_years(
        self,
        metadata: Dict[str, Any],
        base_value: float,
        growth_rate: float,
        years: Sequence[int],
        base_price: float,
        value_field: str,
    ) -> List[Dict[str, Any]]:
        projections: List[Dict[str, Any]] = []
        value = base_value
        for year in years:
            value *= 1 + growth_rate
            projections.append(
                self._build_projection_row(
                    metadata,
                    year,
                    max(value, 0.0),
                    base_price,
                    base_value,
                    value_field,
                    growth_rate,
                )
            )
        return projections

    def _build_projection_row(
        self,
        metadata: Dict[str, Any],
        year: int,
        value: float,
        base_price: float,
        base_value: float | None,
        value_field: str,
        growth_rate: float,
    ) -> Dict[str, Any]:
        row = {
            **metadata,
            "Ano": year,
            "Fat Liq (Kg)": value if value_field == "Fat Liq (Kg)" else metadata.get("Fat Liq (Kg) Base 2026", 0.0),
            "Fat Liq (R$)": value if value_field == "Fat Liq (R$)" else metadata.get("Fat Liq (R$) Base 2026", 0.0),
            "Valor Base 2026": base_value,
            "Preço Base 2026": base_price,
            "Taxa Aplicada": growth_rate,
            "SITUAÇÃO LISTA": "Planejado",
        }
        return row

    def _compute_cagr(self, start_value: float, end_value: float, periods: int) -> float:
        if start_value <= 0:
            return 0.0
        ratio = end_value / start_value
        if ratio <= 0:
            return 0.0
        return ratio ** (1 / periods) - 1

    def _linear_regression(self, x_values: Sequence[int], y_values: Sequence[float]) -> Tuple[float, float]:
        n = len(x_values)
        sum_x = sum(x_values)
        sum_y = sum(y_values)
        sum_xy = sum(x * y for x, y in zip(x_values, y_values))
        sum_x2 = sum(x * x for x in x_values)
        denominator = n * sum_x2 - sum_x**2
        if denominator == 0:
            return 0.0, mean(y_values)
        slope = (n * sum_xy - sum_x * sum_y) / denominator
        intercept = (sum_y - slope * sum_x) / n
        return slope, intercept

    def _resolve_manual_growth(
        self, metadata: Dict[str, Any], factors: Sequence[ManualGrowthFactor]
    ) -> float:
        best_match = (-1, 0.0)
        for factor in factors:
            if metadata.get(factor.level) != factor.value:
                continue
            level_index = self.hierarchy.levels.index(factor.level)
            if level_index > best_match[0]:
                best_match = (level_index, factor.percentage)
        return best_match[1]
