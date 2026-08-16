"""
Demand forecasting model comparison: predicts next-day medicine consumption
per (PHC, medicine). Compares naive/moving-average baseline, XGBoost, LightGBM,
and LSTM using MAE/RMSE/MAPE/R^2 with time-based (not random) validation.
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.database.session import SessionLocal
from app.models.db_models import ModelPerformance
from app.ml.preprocessing.features import load_panel, compute_stockout_labels, build_features, FEATURE_COLS, DEMAND_TARGET

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "models", "trained")
os.makedirs(MODEL_DIR, exist_ok=True)
np.random.seed(42)

DEMAND_FEATURES = [c for c in FEATURE_COLS if c not in ("consumption_lag1",)]  # keep lag1 but drop leaking target-derived items
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


def build_lstm_sequences(df, window=14):
    seq_cols = ["daily_consumption", "current_stock", "patients", "beds_occupied", "outbreak_active"]
    df = df.sort_values(["phc_id", "medicine", "date"])
    Xs, ys, ds = [], [], []
    for _, g in df.groupby(["phc_id", "medicine"]):
        g = g.reset_index(drop=True)
        vals = g[seq_cols].values
        target = g[DEMAND_TARGET].values
        dates = g["date"].values
        for i in range(window, len(g)):
            Xs.append(vals[i - window:i])
            ys.append(target[i])
            ds.append(dates[i])
    return np.array(Xs), np.array(ys), np.array(ds)


def main():
    print("Loading panel + features from Postgres...")
    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)
    df = df.sort_values(["phc_id", "medicine", "date"])
    train, test = time_split(df)

    X_train, y_train = train[DEMAND_FEATURES], train[DEMAND_TARGET]
    X_test, y_test = test[DEMAND_FEATURES], test[DEMAND_TARGET]

    results = []

    # --- Baseline: naive (yesterday's consumption) ---
    naive_pred = test["consumption_lag1"].values
    results.append(metrics_for(y_test, naive_pred, "naive_lag1"))

    # --- Baseline: 7-day moving average ---
    ma_pred = test["consumption_ma7"].values
    results.append(metrics_for(y_test, ma_pred, "moving_average_7d"))

    # --- XGBoost regressor ---
    xgb_reg = xgb.XGBRegressor(
        n_estimators=400, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
        random_state=42, n_jobs=-1,
    )
    xgb_reg.fit(X_train, y_train)
    xgb_pred = np.clip(xgb_reg.predict(X_test), 0, None)
    results.append(metrics_for(y_test, xgb_pred, "xgboost"))
    xgb_path = os.path.join(MODEL_DIR, "xgb_demand.json")
    xgb_reg.save_model(xgb_path)

    # --- LightGBM regressor ---
    lgb_reg = lgb.LGBMRegressor(
        n_estimators=400, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
        random_state=42, n_jobs=-1, verbose=-1,
    )
    lgb_reg.fit(X_train, y_train)
    lgb_pred = np.clip(lgb_reg.predict(X_test), 0, None)
    results.append(metrics_for(y_test, lgb_pred, "lightgbm"))
    lgb_path = os.path.join(MODEL_DIR, "lgb_demand.txt")
    lgb_reg.booster_.save_model(lgb_path)

    print("\n=== Demand forecasting: model comparison (tree models) ===")
    for m in results:
        print(f"{m['model']:20s} MAE={m['mae']:.3f}  RMSE={m['rmse']:.3f}  MAPE={m['mape']:.2f}%  R2={m['r2']:.4f}")

    candidates = {m["model"]: m for m in results if m["model"] in ("xgboost", "lightgbm")}
    champion = min(candidates, key=lambda k: candidates[k]["mae"])
    print(f"\nProvisional champion (pre-LSTM): {champion} (lowest MAE={candidates[champion]['mae']})")

    db = SessionLocal()
    db.query(ModelPerformance).filter(
        ModelPerformance.task == "demand_forecast_1d",
        ModelPerformance.model_name.in_(["naive_lag1", "moving_average_7d", "xgboost", "lightgbm"])
    ).delete(synchronize_session=False)
    paths = {"xgboost": xgb_path, "lightgbm": lgb_path}
    for m in results:
        db.add(ModelPerformance(
            task="demand_forecast_1d", model_name=m["model"], metrics=m,
            is_current_champion=(m["model"] == champion), model_artifact_path=paths.get(m["model"]),
        ))
    db.commit()
    db.close()
    print("Saved to model_performance table.")
    print("\nNEXT STEP: run `python app/ml/lstm/train_demand_lstm.py` to add the LSTM")
    print("comparison and re-evaluate the overall champion (kept separate: LSTM")
    print("training is the slowest step and shouldn't block the fast tree-model runs).")
    return results, champion


if __name__ == "__main__":
    main()
