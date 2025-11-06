import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.schemas.core import ForecastMethod, ForecastRequest, ManualGrowthFactor, PriceStrategy
from backend.app.services.forecast_engine import ForecastEngine


def build_dataset(base_values):
    rows = []
    for year, kg in base_values.items():
        rows.append(
            {
                "Ano": year,
                "Diretor": "Norte",
                "Sigla UF": "PA",
                "Tipo Produto": "Massa",
                "Família": "Tradicional",
                "Família Produção": "Seca",
                "Marca": "Sabor",
                "SITUAÇÃO LISTA": "Ativo",
                "Cod Produto": "SKU001",
                "Produto": "Produto A",
                "Fat Liq (Kg)": kg,
                "Fat Liq (R$)": kg * 2,
            }
        )
    return rows


def test_cagr_forecast_projects_growth():
    dataset = build_dataset({2024: 100.0, 2025: 110.0, 2026: 121.0})
    request = ForecastRequest(
        dataset=dataset,
        method=ForecastMethod.CAGR,
        value_field="Fat Liq (Kg)",
    )
    engine = ForecastEngine()
    response = engine.generate_forecast(request)
    forecast = response["forecast"]
    assert len(forecast) == 4
    first_year = forecast[0]
    assert first_year["Ano"] == 2027
    assert round(first_year["Fat Liq (Kg)"], 1) == 133.1
    assert round(first_year["Receita Projetada"], 1) == 266.2


def test_regression_forecast_uses_trend():
    dataset = build_dataset({2022: 80.0, 2023: 90.0, 2024: 100.0, 2025: 110.0, 2026: 120.0})
    request = ForecastRequest(
        dataset=dataset,
        method=ForecastMethod.LINEAR_REGRESSION,
        value_field="Fat Liq (Kg)",
    )
    engine = ForecastEngine()
    forecast = engine.generate_forecast(request)["forecast"]
    assert forecast[0]["Ano"] == 2027
    assert round(forecast[0]["Fat Liq (Kg)"], 1) == 130.0


def test_manual_percentage_requires_factor():
    dataset = build_dataset({2025: 95.0, 2026: 100.0})
    request = ForecastRequest(
        dataset=dataset,
        method=ForecastMethod.MANUAL_PERCENTAGE,
        value_field="Fat Liq (Kg)",
        manual_growth=[ManualGrowthFactor(level="Tipo Produto", value="Massa", percentage=0.05)],
        price_strategy=PriceStrategy.CONSTANT_GROWTH,
        price_growth_rate=0.02,
    )
    engine = ForecastEngine()
    forecast = engine.generate_forecast(request)["forecast"]
    assert round(forecast[0]["Fat Liq (Kg)"], 2) == 105.0
    assert round(forecast[0]["Preço Projetado"], 2) == 2.04
    assert round(forecast[0]["Receita Projetada"], 2) == 214.2
