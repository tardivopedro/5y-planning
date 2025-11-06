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
cp .env.example .env       # ajuste DATABASE_URL conforme necessário
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
2. Configure `DATABASE_URL` em `backend/.env` ou nas variáveis de ambiente do Railway, conforme o ambiente:
   - **Desenvolvimento local (via proxy Railway):**
     ```env
     DATABASE_URL=postgresql://postgres:<senha>@[host].proxy.rlwy.net:[porta]/railway
     ```
   - **Serviço FastAPI hospedado na Railway:**
     - **Se os serviços estão linkados:** use o host interno (preferencial)
       ```env
       DATABASE_URL=postgresql://postgres:<senha>@postgres.railway.internal:5432/railway
       ```
     - **Se o host interno não resolve:** use a URL pública (proxy)
       ```env
       DATABASE_URL=postgresql://postgres:<senha>@[host].proxy.rlwy.net:[porta]/railway
       ```
     - **Nota:** O código tenta automaticamente a URL pública se a interna falhar
3. Reinstale dependências (já incluímos `psycopg[binary]`) e reinicie o backend; as tabelas são criadas automaticamente.

### Troubleshooting: Problemas de Conexão com PostgreSQL no Railway

Se você ver o erro `Could not resolve database host for postgresql+psycopg://postgres:***@postgres.railway.internal:5432/railway`, isso significa que o host do banco não está sendo resolvido. Isso geralmente acontece quando:

1. **O serviço PostgreSQL não está linkado ao serviço da aplicação:**
   - No painel do Railway, vá até o serviço da sua aplicação
   - Clique em "Variables" ou "Settings"
   - Verifique se há um serviço PostgreSQL linkado
   - Se não houver, adicione um serviço PostgreSQL e faça o link

2. **O nome do serviço PostgreSQL é diferente de "postgres":**
   - O host interno do Railway segue o padrão `[nome-do-servico].railway.internal`
   - Se seu serviço PostgreSQL se chama algo diferente (ex: `postgres-db`), o host seria `postgres-db.railway.internal`
   - Verifique o nome do serviço no painel do Railway e ajuste a `DATABASE_URL` se necessário

3. **Variáveis de ambiente não estão configuradas:**
   - O Railway normalmente cria automaticamente `DATABASE_URL` quando você linka um serviço PostgreSQL
   - Verifique em "Variables" se `DATABASE_URL` ou `POSTGRES_URL` está presente
   - Se não estiver, você pode configurá-la manualmente com a connection string correta

4. **Usando variáveis individuais:**
   - O código também suporta variáveis individuais: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
   - Essas podem ser configuradas manualmente se a `DATABASE_URL` não estiver disponível

**Nota:** Se nenhuma conexão PostgreSQL for possível, o aplicativo fará fallback automático para SQLite local (`sqlite:///./data/forecast.db`), mas isso não é recomendado para produção.

### Limpeza rápida do banco

O SQLite local (`backend/data/forecast.db`) é descartável. Para recomeçar, remova-o e reinicie o app. Ao usar Postgres/Supabase, esse arquivo deixa de ser necessário.

## Frontend (React + Vite)

### Configuração para Desenvolvimento Local

1. **Crie o arquivo `frontend/.env`** com as seguintes variáveis:

```env
# Para testar com backend local
VITE_API_URL=http://127.0.0.1:8000

# Para testar com backend no Railway (substitua pela URL do seu serviço)
# VITE_API_URL=https://5y-planning-production.up.railway.app

VITE_DELETE_TOKEN=DELETE-ALL
```

2. **Instale as dependências e inicie o servidor:**

```bash
cd frontend
npm install
npm run dev
```

- Servidor local na porta `5173`.
- Acesse `http://127.0.0.1:5173` no navegador

### Testando Conexão com Backend no Railway

**Para testar o frontend conectado ao backend no Railway:**

1. **Configure o `.env` do frontend:**
   ```env
   VITE_API_URL=https://5y-planning-production.up.railway.app
   VITE_DELETE_TOKEN=DELETE-ALL
   ```

2. **Inicie o frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Teste o upload de dados:**
   - Acesse `http://127.0.0.1:5173`
   - Vá para a aba "Upload"
   - Faça upload de um arquivo Excel/CSV
   - Verifique se o upload foi bem-sucedido

4. **Verificar se os dados estão no banco PostgreSQL:**
   
   **Opção A: Via logs do Railway**
   - No painel do Railway, vá até os logs do serviço da aplicação
   - Procure por mensagens como "Successfully connected to database"
   - Ao fazer upload, você verá logs de inserção/atualização
   
   **Opção B: Via API diretamente**
   ```bash
   # Verificar se o backend está respondendo
   curl https://5y-planning-production.up.railway.app/health
   
   # Listar registros (primeiros 10)
   curl https://5y-planning-production.up.railway.app/upload/records?limit=10
   ```
   
   **Opção C: Via Railway PostgreSQL (se tiver acesso SQL)**
   - No painel do Railway, clique no serviço PostgreSQL
   - Vá em "Data" ou "Query"
   - Execute: `SELECT COUNT(*) FROM planningrecord;`
   - Ou: `SELECT * FROM planningrecord LIMIT 10;`

5. **Verificar no frontend:**
   - Após upload, vá para a aba "Forecast" ou "Analytics"
   - Os dados devem aparecer automaticamente
   - Verifique se os filtros e agregações estão funcionando

### Mock de Estado (Desenvolvimento)

O mock de estado (`useForecastStore`) mantém dados de upload, forecasts e ajustes percentuais para navegação entre níveis (Diretor → SKU). Quando conectado ao backend real, os dados vêm do PostgreSQL via API.

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
