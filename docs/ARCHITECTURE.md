# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Frontend [React + Vite]
        UI[Dashboard Pages]
    end

    subgraph Backend [FastAPI]
        API[REST API]
        SVC[Services Layer]
        ML[ML Models\nXGBoost / LightGBM / LSTM]
        OPT[OR-Tools Optimizer]
        SHAP[SHAP Explainability]
        FL[Flower Federated Learning]
    end

    subgraph DB [PostgreSQL]
        T[(PHCs, Districts, Inventory,\nConsumption, Predictions,\nModel Performance)]
    end

    UI -->|HTTP/JSON| API
    API --> SVC
    SVC --> ML
    SVC --> OPT
    SVC --> SHAP
    SVC --> FL
    SVC --> T
    ML --> T
```

## Prediction request flow

```mermaid
sequenceDiagram
    participant React
    participant FastAPI
    participant DB as Postgres
    participant Models as XGBoost/LightGBM (loaded artifacts)

    React->>FastAPI: POST /api/predict/stockout {phc_id, medicine}
    FastAPI->>DB: load latest feature snapshot for phc+medicine
    FastAPI->>DB: load stored validation metrics per model
    FastAPI->>Models: run live inference (all candidate models)
    Models-->>FastAPI: per-model probability
    FastAPI->>FastAPI: select champion = highest stored PR-AUC
    FastAPI->>DB: log Prediction row (audit trail)
    FastAPI-->>React: {all_model_outputs, selected_model, risk_level, top_drivers}
```

## Model training vs. inference separation

Training (`app/ml/**/train_*.py`) is run **offline**, on demand, or on a
schedule — never inside a request handler. Each training script:

1. Loads the full historical panel from Postgres.
2. Builds causal (no-leakage) features.
3. Splits by **time**, not randomly (walk-forward validation).
4. Trains baseline + XGBoost + LightGBM (+ LSTM where applicable).
5. Evaluates all candidates on the same held-out future window.
6. Persists both the trained artifact (to `models/trained/`) and the
   evaluation metrics (to the `model_performance` table), flagging exactly
   one row per task as `is_current_champion`.

At **request time**, the API only loads already-trained artifacts and runs
inference — it never retrains. This keeps the "Prediction" button fast while
still comparing genuinely different, independently-evaluated models.

## Database schema (key tables)

```mermaid
erDiagram
    DISTRICTS ||--o{ PHCS : contains
    PHCS ||--o{ INVENTORY : has
    PHCS ||--o{ MEDICINE_CONSUMPTION : has
    PHCS ||--o{ PATIENTS : has
    PHCS ||--o{ BEDS : has
    PHCS ||--o{ STAFF_ATTENDANCE : has
    MEDICINES ||--o{ INVENTORY : tracked_in
    MEDICINES ||--o{ MEDICINE_CONSUMPTION : tracked_in
    DISTRICTS ||--o{ DISEASE_CASES : reports
    PHCS ||--o{ PREDICTIONS : subject_of
    PHCS ||--o{ REDISTRIBUTION_RECOMMENDATIONS : source_or_target
```
