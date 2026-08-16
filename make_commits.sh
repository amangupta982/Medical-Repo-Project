#!/bin/bash

# 1
git add .gitignore README.md .env.example
git commit -m "chore: initial repository setup with configuration files"

# 2
git add docs/
git commit -m "docs: add architecture and data sources documentation"

# 3
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile
git commit -m "ci: add docker and docker-compose configurations"

# 4
git add backend/requirements.txt backend/app/main.py backend/app/__init__.py
git commit -m "build: setup backend dependencies and main application entry point"

# 5
git add backend/app/models/ backend/app/database/session.py backend/app/database/__init__.py
git commit -m "feat(db): implement database models and session management"

# 6
git add backend/app/database/seed.py
git commit -m "chore(db): add database seeding script"

# 7
git add backend/app/schemas/
git commit -m "feat(api): define pydantic schemas for API requests and responses"

# 8
git add backend/app/ml/preprocessing/ backend/app/ml/__init__.py
git commit -m "feat(ml): add data preprocessing and feature engineering modules"

# 9
git add backend/app/ml/xgboost/ backend/app/ml/lightgbm/
git commit -m "feat(ml): integrate XGBoost and LightGBM models"

# 10
git add backend/app/ml/lstm/ backend/app/ml/forecasting/
git commit -m "feat(ml): implement LSTM demand forecasting models"

# 11
git add backend/app/ml/classification/
git commit -m "feat(ml): add stockout risk classification models"

# 12
git add backend/app/ml/evaluation/ backend/app/ml/explainability/
git commit -m "feat(ml): introduce model evaluation and SHAP explainability"

# 13
git add backend/app/ml/federated/
git commit -m "feat(ml): setup federated learning components"

# 14
git add backend/app/services/
git commit -m "feat(backend): implement core business logic services"

# 15
git add backend/app/optimization/
git commit -m "feat(optimization): add resource redistribution optimization logic"

# 16
git add backend/app/api/
git commit -m "feat(api): create API endpoints for predictions and network simulation"

# 17
git add backend/app/utils/ backend/test_predict.py backend/tests/
git commit -m "test: add unit tests and utility functions"

# 18
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html
git commit -m "build(frontend): initialize React app with Vite configuration"

# 19
git add frontend/src/App.jsx frontend/src/main.jsx frontend/src/index.css frontend/src/services/ frontend/src/components/
git commit -m "feat(frontend): create core app layout, components, and API service"

# 20
git add frontend/src/pages/ frontend/dist/ models/trained/ notebooks/
git commit -m "feat: add frontend pages, notebooks, and trained models"

git add -A
git commit -m "chore: add remaining uncommitted files" || true
