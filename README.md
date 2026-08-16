# BRICS Federated Health Resource & Supply Chain Resilience Platform

**PREDICT → EXPLAIN → SIMULATE → OPTIMIZE → ACT**

An AI-powered platform for national-scale PHC (Primary Health Centre) network
visibility, medicine stock-out prediction, cross-district resource
redistribution, emergency scenario simulation, and federated learning across
simulated BRICS national clients.

## 1. Problem

Public healthcare systems across developing nations lack real-time visibility
into medicine stock, patient footfall, bed availability, and staff attendance
across their PHC networks — leading to stock-outs and slow emergency response.

## 2. Solution

A full-stack system (React + FastAPI + PostgreSQL) that:
- Predicts stock-outs 7 days ahead (XGBoost vs LightGBM vs rule-based baseline)
- Forecasts medicine demand at 1/7/14/30-day horizons (XGBoost vs LightGBM vs LSTM vs naive baselines)
- Explains every high-risk prediction with SHAP (which factors, how much)
- Simulates emergencies (dengue/flu/GI outbreak presets, or custom sliders) and shows before/after impact
- Recommends optimal cross-PHC redistribution via OR-Tools (transportation LP), with FEFO expiry prioritization
- Scores every district 0–100 on resilience (medicine/beds/staffing/readiness), transparently weighted
- Demonstrates real federated learning (Flower) across 5 simulated national clients — raw data never leaves a client

See `docs/ARCHITECTURE.md` for diagrams and `docs/DATA_SOURCES.md` for exactly
what's real data vs. calibrated synthetic data (full honesty, no fabricated claims).

## 3. Architecture

```
backend/    FastAPI + SQLAlchemy + Postgres, all ML training & inference
frontend/   React + Vite dashboard (12 pages, real API calls, no mock data)
data/       real calibration datasets (data/raw) and Postgres seed scripts
models/     trained model artifacts (.json/.txt/.keras) land here
docs/       architecture, data sources, resilience methodology
notebooks/  EDA scripts validating calibration against real data
```

## 4. Why XGBoost / LightGBM / LSTM (not just one)

- **XGBoost / LightGBM**: gradient-boosted trees on engineered features
  (lags, rolling stats, peer-PHC risk, staffing shortfall) — strong on
  tabular panel data, fast to train, natively give SHAP explanations.
- **LSTM**: sequence model consuming a raw 14-day window — tests whether
  temporal patterns are better learned end-to-end than hand-engineered.
- We do **not** hard-code a winner. Every training run evaluates all
  candidates on a **time-based** (walk-forward) held-out split and stores
  the metrics; the API picks the champion from those stored metrics at
  request time. In our reference run, XGBoost narrowly beat LightGBM on
  stock-out PR-AUC (0.816 vs 0.816, effectively tied) — see
  `outputs`/`model_performance` table for your own run's numbers, which
  will differ slightly by random seed and data draw.

## 5. Model evaluation

- **Classification (stock-out)**: Recall, Precision, F1, **F2** (recall-weighted,
  because a missed stock-out is worse than a false alarm), PR-AUC, ROC-AUC, confusion matrix.
- **Regression (demand)**: MAE, RMSE, MAPE, R².
- **Optimization**: stock-outs before/after, unmet demand, transport cost, wastage avoided (FEFO).
- Validation is **always time-based** — we never randomly shuffle time series.

## 6. Installation

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env      # edit if needed
docker-compose up --build
```
This starts Postgres, the FastAPI backend (port 8000), and the React frontend (port 5173).

### Option B — Manual

**Backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start Postgres yourself (or via `docker run -p 5432:5432 -e POSTGRES_PASSWORD=brics_dev_pw -e POSTGRES_DB=brics_health postgres:16`)

export DATABASE_URL="postgresql://postgres:brics_dev_pw@localhost:5432/brics_health"
export PYTHONPATH="$(pwd)"

python app/database/seed.py                       # creates schema + seeds ~350k rows (~1 min)
python app/ml/classification/train_stockout.py     # trains baseline/XGBoost/LightGBM for stock-out
python app/ml/forecasting/train_demand.py           # trains baseline/XGBoost/LightGBM for demand
python app/ml/lstm/train_demand_lstm.py             # trains LSTM (slowest step, run separately)

uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
```
Open http://localhost:5173.

## 7. Database setup

Schema creation + seeding is one command: `python app/database/seed.py`
(drops and recreates all tables, so safe to re-run). See
`backend/app/models/db_models.py` for the full SQLAlchemy schema.

## 8. Training models

Run the three scripts above in order. Each writes trained artifacts to
`models/trained/` and evaluation metrics + champion flag to the
`model_performance` Postgres table. Re-run any of them any time to retrain
(the "Retrain Models" action described in the spec maps directly to
re-running these scripts, or wiring a `/api/models/retrain` endpoint that
shells out to them if you want it in-UI).

## 9. Running predictions

Via the dashboard: **Stock-out Risk** or **Demand Forecasting** pages → pick
a PHC + medicine → click Predict. Via API directly:

```bash
curl -X POST http://localhost:8000/api/predict/stockout \
  -H "Content-Type: application/json" \
  -d '{"phc_id": "MYS-PHC04", "medicine": "Insulin"}'
```

## 10. API documentation

Interactive docs (Swagger UI) at **http://localhost:8000/docs** once the
backend is running. Key endpoints:

```
GET  /api/phcs
GET  /api/districts
GET  /api/inventory
GET  /api/alerts
POST /api/predict/demand
POST /api/predict/stockout
POST /api/emergency/simulate
POST /api/optimize/redistribution
GET  /api/resilience-score
POST /api/federated/train
GET  /api/models/performance
GET  /api/explainability/{prediction_id}
```

## 11. Testing

```bash
cd backend
pytest tests/ -v
```
Covers feature-engineering leakage checks, risk-level threshold logic, and
live API integration tests (health, PHC listing, prediction error handling,
emergency simulation before/after sanity check).

## 12. Limitations (stated honestly)

- No public dataset exists at daily PHC-level granularity — that layer is
  calibrated synthetic data (see `docs/DATA_SOURCES.md`). This mirrors the
  exact real-world data gap the problem statement describes.
- Federated learning "BRICS clients" are simulated partitions of one
  dataset with per-client heterogeneity, not real national records.
- LSTM demand forecasting is trained on a subsampled sequence set for
  reasonable local training time; set `sample_frac=1.0` in
  `train_demand_lstm.py` for the full run (slower).
- OR-Tools CP-SAT solve is capped at 10s per medicine for demo responsiveness;
  raise `max_time_in_seconds` for larger networks.

## 13. Future improvements

- Real district-level PHC datasets where governments publish them (data.gov.in
  publishes network counts but not daily operational data — worth monitoring).
- Alembic migrations for schema versioning (dependency is included; migration
  files aren't scaffolded yet — `alembic init` from `backend/` to add them).
- Model retraining scheduler (cron / Celery beat) instead of manual script runs.
- Real per-country federated deployment (each client as its own service) rather
  than in-process Flower simulation.

## 14. Hackathon differentiation

1. **Federated learning is real, not decorative** — actual Flower NumPyClient
   contract, non-IID client partitions, before/after comparison.
2. **Optimization, not just prediction** — OR-Tools transportation LP with
   FEFO, not "send stock to whoever asks."
3. **Honest data provenance** — every number is traceable to either a cited
   real source or explicitly labeled synthetic generation logic.
4. **Model selection is evidence-based** — stored time-based validation
   metrics decide the champion, shown transparently in the UI, losers included.
5. **Recall-first evaluation** — F2/PR-AUC front and center for the classifier,
   because in this domain a missed stock-out costs more than a false alarm.
