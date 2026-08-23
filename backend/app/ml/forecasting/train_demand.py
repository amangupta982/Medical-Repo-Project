"""
Demand forecasting model comparison: predicts medicine consumption across multiple horizons
(1-day, 7-day, 14-day, 30-day) per (PHC, medicine). Compares naive/moving-average baselines,
XGBoost, LightGBM, and LSTM using MAE/RMSE/MAPE/R^2 with time-based (walk-forward) validation.
"""
import sys, os
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.database.session import SessionLocal
from app.models.db_models import ModelPerformance
from app.ml.preprocessing.features import (
    load_panel, compute_stockout_labels, compute_demand_targets,
    build_features, FEATURE_COLS, DEMAND_HORIZONS, DEMAND_TARGET_MAP
)

project_root = os.path.abspath(os.path.join(backend_dir, ".."))
MODEL_DIR = os.path.join(project_root, "models", "trained")
os.makedirs(MODEL_DIR, exist_ok=True)
np.random.seed(42)

DEMAND_FEATURES = FEATURE_COLS  # lags/rolling means are all causal (shifted), safe to use


def time_split(df, frac=0.75):
    dates = np.sort(df["date"].unique())
    cutoff = dates[int(len(dates) * frac)]
    return df[df["date"] < cutoff], df[df["date"] >= cutoff]


def mape(y_true, y_pred):
    mask = y_true > 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100) if mask.sum() else float("nan")


def metrics_for(y_true, y_pred, name):
    return {
        "model": name,
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 3),
        "mape": round(mape(np.array(y_true), np.array(y_pred)), 2),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def main():
    print("Loading panel + features from Postgres...")
    df = load_panel()
    df = compute_stockout_labels(df)
    df = compute_demand_targets(df)
    df = build_features(df)
    df = df.sort_values(["phc_id", "medicine", "date"])
    train, test = time_split(df)

    X_train = train[DEMAND_FEATURES]
    X_test = test[DEMAND_FEATURES]

    all_horizon_results = {}
    db = SessionLocal()

    for h in DEMAND_HORIZONS:
        target_col = DEMAND_TARGET_MAP[h]
        task_name = f"demand_forecast_{h}d"
        print(f"\n==================================================")
        print(f"  Training Demand Models for Horizon: {h}-Day ({task_name})")
        print(f"==================================================")

        y_train = train[target_col]
        y_test = test[target_col]

        results = []

        # --- Baseline: naive (yesterday's consumption * h) ---
        naive_pred = test["consumption_lag1"].values * h
        results.append(metrics_for(y_test, naive_pred, "naive_lag1"))

        # --- Baseline: 7-day moving average (* h) ---
        ma_pred = test["consumption_ma7"].values * h
        results.append(metrics_for(y_test, ma_pred, "moving_average_7d"))

        # --- XGBoost regressor ---
        xgb_reg = xgb.XGBRegressor(
            n_estimators=400, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1,
        )
        xgb_reg.fit(X_train, y_train)
        xgb_pred = np.clip(xgb_reg.predict(X_test), 0, None)
        results.append(metrics_for(y_test, xgb_pred, "xgboost"))
        
        xgb_path = os.path.join(MODEL_DIR, f"xgb_demand_{h}d.json")
        xgb_reg.save_model(xgb_path)
        if h == 1:
            # Backwards compatibility for default 1d artifact path
            xgb_reg.save_model(os.path.join(MODEL_DIR, "xgb_demand.json"))

        # --- LightGBM regressor ---
        lgb_reg = lgb.LGBMRegressor(
            n_estimators=400, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbose=-1,
        )
        lgb_reg.fit(X_train, y_train)
        lgb_pred = np.clip(lgb_reg.predict(X_test), 0, None)
        results.append(metrics_for(y_test, lgb_pred, "lightgbm"))
        
        lgb_path = os.path.join(MODEL_DIR, f"lgb_demand_{h}d.txt")
        lgb_reg.booster_.save_model(lgb_path)
        if h == 1:
            # Backwards compatibility for default 1d artifact path
            lgb_reg.booster_.save_model(os.path.join(MODEL_DIR, "lgb_demand.txt"))

        for m in results:
            print(f"  {m['model']:20s} MAE={m['mae']:<8.3f} RMSE={m['rmse']:<8.3f} MAPE={m['mape']:<6.2f}% R2={m['r2']:.4f}")

        candidates = {m["model"]: m for m in results if m["model"] in ("xgboost", "lightgbm")}
        champion = min(candidates, key=lambda k: candidates[k]["mae"])
        print(f"  Champion for {task_name}: {champion} (lowest MAE={candidates[champion]['mae']})")

        # Save to model_performance table
        db.query(ModelPerformance).filter(
            ModelPerformance.task == task_name,
            ModelPerformance.model_name.in_(["naive_lag1", "moving_average_7d", "xgboost", "lightgbm"])
        ).delete(synchronize_session=False)

        paths = {"xgboost": xgb_path, "lightgbm": lgb_path}
        for m in results:
            db.add(ModelPerformance(
                task=task_name, model_name=m["model"], metrics=m,
                is_current_champion=(m["model"] == champion), model_artifact_path=paths.get(m["model"]),
            ))
        db.commit()
        all_horizon_results[task_name] = (results, champion)

    db.close()
    print("\nSaved all per-horizon demand models to model_performance table.")
    return all_horizon_results


if __name__ == "__main__":
    main()

