# 5-Year Planning Architecture Overview

This document describes the reference architecture for the 5-year planning tool requested by the business team. The solution is divided into clearly separated layers so the forecasting logic can evolve without impacting presentation or persistence concerns.

## High-Level Components

1. **Frontend (React + TypeScript + Tailwind)**
   - Uploads the historical spreadsheet (2017–2026) and provides validation feedback.
   - Renders the hierarchical planning views (Diretor → UF → Tipo Produto → Família → Marca → SKU).
   - Hosts forecast configuration forms, scenario comparisons, and chart visualizations.
   - Consumes the REST API exposed by the backend to run forecasts, persist plans, and export reports.

2. **Backend API (FastAPI)**
   - Exposes REST endpoints for dataset upload, forecast generation, scenario management, and exports.
   - Delegates forecasting and aggregation tasks to the forecasting engine located in `backend/app/services`.
   - Performs column/type validation, missing-value detection, and orchestrates price adjustments.

3. **Forecast Engine (Python Services)**
   - Provides deterministic implementations for CAGR, linear regression, and manual percentage growth.
   - Derives base prices from 2026 data to support price-freeze and constant-growth scenarios.
   - Produces normalized tabular results that the frontend can drill through and edit at any level.
   - Designed to be extended with Prophet/XGBoost models for the “IA Sugere Forecast” capability.

4. **Persistence Layer (PostgreSQL / Supabase)**
   - Stores raw uploads, cleansed datasets, generated forecasts, manual overrides, and scenario metadata.
   - Enables version control for plans and supports “Base”, “Otimista”, and “Pessimista” scenario branches.

5. **Exports (Pandas + OpenPyXL / ReportLab)**
   - Backend endpoints transform the forecasted DataFrame into Excel templates and PDF dashboards.
   - Supports snapshotting of the current scenario to guarantee reproducibility.

## Data Flow

1. **Upload**
   - The user submits the 2017–2026 dataset as XLSX/CSV.
   - The backend validates column presence, enforces data types, and stores the cleansed dataset.

2. **Forecast Generation**
   - The frontend sends a `ForecastRequest` with method, variable (Kg/R$), price strategy, and optional manual overrides.
   - The `ForecastEngine` groups the dataset by SKU, calculates growth, and produces rows for 2027–2030.
   - Pricing rules adjust projected revenue. Aggregated results are cached for multi-level rollups.

3. **Editing & Approval**
   - The UI allows inline edits at any hierarchy level. Updates are persisted as adjustments while base forecasts remain intact.
   - Totals are recomputed bottom-up to maintain consistency.

4. **Scenario Management**
   - Each save generates a new scenario version linked to the base dataset and adjustment set.
   - Comparing scenarios uses diff views and waterfall charts to highlight deltas.

5. **Exports & Reporting**
   - Users trigger exports that render Excel/PDF artifacts with volumetric, revenue, price, and contribution analyses.

## Extensibility Hooks

- **Advanced Forecasting**: Implement `ForecastEngine.generate_ai_suggestion` that leverages Prophet/XGBoost while reusing the existing schema contracts.
- **Monthly / Quarterly Views**: Enhance the dataset schema with a `Período` column to support sub-annual breakdowns.
- **API Authentication**: Secure endpoints with Supabase Auth or OAuth2 to segment access by director/region.
- **Event Log**: Append a change log table to track who edited what and when for audit purposes.

## Deployment Pipeline

- **Frontend** deployed to Vercel with environment variables pointing to the API base URL.
- **Backend** containerized and deployed to Railway/Render with managed PostgreSQL.
- **CI/CD** using GitHub Actions to run `pytest`, lint checks, and build artifacts on each commit.

This architecture ensures the planning team receives automated, explainable forecasts while retaining the flexibility to adjust plans manually across multiple scenarios.
