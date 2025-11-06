# 5-Year Planning Platform

Cockpit completo para planejamento comercial com projeções automáticas de cinco anos (2026–2030). O projeto reúne um backend **FastAPI** com motor de forecast e um frontend **React + TypeScript + Tailwind** que simula todo o fluxo de upload, configuração, edição multinível e visualização de cenários.

## Visão Geral do Repositório

- `backend/app/main.py` — inicializa a aplicação FastAPI, configura CORS, executa `init_db()` no startup e registra todos os routers (`upload`, `analytics`, `forecast`).
- `backend/app/api/forecast.py` — mantém os endpoints originais de geração de forecast com o motor determinístico.
- `backend/app/api/upload.py` & `backend/app/api/analytics.py` — expõem ingestão da base histórica e consultas agregadas simuladas para o cockpit.
- `backend/app/services/forecast_engine.py` — motor principal com CAGR, regressão e crescimento manual; compartilha esquemas em `backend/app/schemas/core.py`.
- `frontend/src/App.tsx` — orquestra a navegação entre módulos (Upload, Forecast, Edição, Pricing, Reporting).
- `frontend/src/modules/*` — implementações modulares da UI mockada, utilizando Zustand para estado global (`useForecastStore`).
- `docs/architecture.md` — visão arquitetural detalhada e roadmap técnico.
- `tests/test_forecast_engine.py` — garante a lógica central do motor de forecast.

## Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate no Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- Variáveis sensíveis ficam em `backend/.env` (ignorado via `.gitignore`); defina `DATABASE_URL`, `DELETE_CONFIRMATION_TEXT`, `APP_NAME`, etc.
- O endpoint de saúde responde em `http://127.0.0.1:8000/health`.
- Swagger disponível em `http://127.0.0.1:8000/docs` com rotas de upload, analytics e forecast.

### Executando com Docker (Railway ou local)

```bash
docker build -t 5y-planning-backend .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql+psycopg://... \
  -e APP_NAME=5y-planning-api \
  -e DELETE_CONFIRMATION_TEXT=DELETE-ALL \
  5y-planning-backend
```

- O Dockerfile já fixa o Python 3.12 e lê a porta da variável `PORT` (Railway fornece automaticamente).
- Em ambiente Railway, selecione “Dockerfile” como estratégia de build/start e mantenha o comando padrão.

### Supabase/PostgreSQL

1. Gere o connection string completo no Supabase.
2. Configure `DATABASE_URL` em `backend/.env`, ex.:
   ```env
   DATABASE_URL=postgresql+psycopg://usuario:senha@host:porta/postgres?options=-csearch_path%3Dpublic
   ```
3. Reinstale dependências (já incluímos `psycopg[binary]`) e reinicie o backend; as tabelas são criadas automaticamente.

### Limpeza rápida do banco

O SQLite local (`backend/data/forecast.db`) é descartável. Para recomeçar, remova-o e reinicie o app. Ao usar Postgres/Supabase, esse arquivo deixa de ser necessário.

## Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- Servidor local na porta `5173`.
- Configure `frontend/.env` com:
  ```
  VITE_API_URL=http://127.0.0.1:8000
  VITE_DELETE_TOKEN=DELETE-ALL
  ```
- O mock de estado (`useForecastStore`) mantém dados de upload, forecasts e ajustes percentuais para navegação entre níveis (Diretor → SKU).

## Testes

Execute os testes unitários do motor de forecast:

```bash
pytest
```

## Próximos Passos Sugeridos

1. Substituir os mocks do frontend por chamadas reais aos endpoints (`upload`, `analytics`, `forecast`).
2. Implementar persistência definitiva (Postgres/Supabase) e histórico de ajustes.
3. Adicionar sugestão de forecast via IA (Prophet/XGBoost) reutilizando `ForecastEngine`.
4. Construir exportações Excel/PDF no backend.
5. Criar testes end-to-end (Playwright/Cypress) cobrindo o cockpit completo.

## Deploy

- **Backend**: empacotar e publicar em Railway/Render. Comando sugerido: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend**: deploy no Vercel apontando para `frontend/`, scripts padrão (`npm install`, `npm run build`) e saída `dist/`.
- Configure variáveis de ambiente em ambos para alinhar `VITE_API_URL`, `VITE_DELETE_TOKEN` e demais segredos.

## Limpeza Total da Base

O painel de upload possui “Zona perigosa” que exige digitar o token configurado (`VITE_DELETE_TOKEN` / `DELETE_CONFIRMATION_TEXT`) antes de chamar `DELETE /upload/records`. Utilize com cautela e mantenha backups.
