# 5Y Planning

Ferramenta de planejamento automático para projetar vendas e receita de 2027–2030 a partir de históricos 2017–2025 e do plano manual de 2026.

## Conteúdo do Repositório

- `backend/app/main.py` — ponto de entrada FastAPI.
- `backend/app/api/forecast.py` — endpoint REST para geração de forecast.
- `backend/app/schemas.py` — contratos de dados tipados compartilhados entre frontend e backend.
- `backend/app/services/forecast_engine.py` — motor principal com CAGR, regressão linear e variação manual.
- `tests/test_forecast_engine.py` — testes unitários garantindo a lógica de projeção.
- `docs/architecture.md` — visão arquitetural completa e plano de evolução.

## Executando os Testes

Os testes cobrem os três métodos principais de projeção e a lógica de preço.

```bash
pytest
```

## Próximos Passos

1. Implementar upload de arquivos e persistência em banco relacional.
2. Construir frontend React com navegação hierárquica e telas de edição manual.
3. Adicionar motor de IA opcional (Prophet/XGBoost) e gerenciamento de cenários.
4. Disponibilizar exportações Excel/PDF a partir do backend.
