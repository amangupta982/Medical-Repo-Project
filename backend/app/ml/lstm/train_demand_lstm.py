"""
Standalone LSTM training for demand forecasting (kept separate from
train_demand.py so it can be run/retrained independently without re-running
the XGBoost/LightGBM fits every time).

Run AFTER train_demand.py has written the xgboost/lightgbm rows, then this
script appends the LSTM row and re-picks the champion.
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import tensorflow as tf
from tensorflow import keras
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.database.session import SessionLocal
from app.models.db_models import ModelPerformance
from app.ml.preprocessing.features import load_panel, compute_stockout_labels, build_features, DEMAND_TARGET

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "models", "trained")
os.makedirs(MODEL_DIR, exist_ok=True)
tf.random.set_seed(42)
np.random.seed(42)

WINDOW = 14
SEQ_COLS = ["daily_consumption", "current_stock", "patients", "beds_occupied", "outbreak_active"]


def mape(y_true, y_pred):
    mask = y_true > 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100) if mask.sum() else float("nan")


def build_sequences(df, sample_frac=1.0):
    df = df.sort_values(["phc_id", "medicine", "date"])
    groups = list(df.groupby(["phc_id", "medicine"]))
    if sample_frac < 1.0:
        rng = np.random.default_rng(42)
        idx = rng.choice(len(groups), size=int(len(groups) * sample_frac), replace=False)
        groups = [groups[i] for i in idx]
    Xs, ys, ds = [], [], []
    for _, g in groups:
        g = g.reset_index(drop=True)
        vals = g[SEQ_COLS].values
        target = g[DEMAND_TARGET].values
        dates = g["date"].values
        for i in range(WINDOW, len(g)):
            Xs.append(vals[i - WINDOW:i])
            ys.append(target[i])
            ds.append(dates[i])
    return np.array(Xs), np.array(ys), np.array(ds)


def main(sample_frac=1.0, epochs=8):
    print("Loading panel from Postgres...")
    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)

    print("Building LSTM sequences...")
    Xs, ys, ds = build_sequences(df, sample_frac=sample_frac)
    cutoff = np.sort(np.unique(ds))[int(len(np.unique(ds)) * 0.75)]
    tr_mask = ds < cutoff
    Xs_tr, ys_tr = Xs[tr_mask], ys[tr_mask]
    Xs_te, ys_te = Xs[~tr_mask], ys[~tr_mask]
    print(f"Train sequences: {len(Xs_tr)} | Test sequences: {len(Xs_te)}")

    n_feat = Xs.shape[2]
    mu = Xs_tr.reshape(-1, n_feat).mean(0)
    sigma = Xs_tr.reshape(-1, n_feat).std(0) + 1e-6
    Xs_tr_n = (Xs_tr - mu) / sigma
    Xs_te_n = (Xs_te - mu) / sigma

    model = keras.Sequential([
        keras.layers.Input(shape=(WINDOW, n_feat)),
        keras.layers.LSTM(32),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(16, activation="relu"),
        keras.layers.Dense(1, activation="relu"),
    ])
    model.compile(optimizer="adam", loss="mae")
    model.fit(
        Xs_tr_n, ys_tr, validation_split=0.15, epochs=epochs, batch_size=512, verbose=2,
        callbacks=[keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True)],
    )

    pred = np.clip(model.predict(Xs_te_n, batch_size=1024).flatten(), 0, None)
    metrics = {
        "model": "lstm",
        "mae": round(float(mean_absolute_error(ys_te, pred)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(ys_te, pred))), 3),
        "mape": round(mape(ys_te, pred), 2),
        "r2": round(float(r2_score(ys_te, pred)), 4),
    }
    print("LSTM metrics:", metrics)

    model_path = os.path.join(MODEL_DIR, "lstm_demand.keras")
    model.save(model_path)

    db = SessionLocal()
    db.query(ModelPerformance).filter(
        ModelPerformance.task == "demand_forecast_1d", ModelPerformance.model_name == "lstm"
    ).delete()
    db.add(ModelPerformance(
        task="demand_forecast_1d", model_name="lstm", metrics=metrics,
        is_current_champion=False, model_artifact_path=model_path,
    ))
    db.commit()

    # re-evaluate champion across all stored demand-forecast rows by lowest MAE
    rows = db.query(ModelPerformance).filter(ModelPerformance.task == "demand_forecast_1d").all()
    candidates = {r.model_name: r.metrics["mae"] for r in rows if r.model_name in ("xgboost", "lightgbm", "lstm")}
    if candidates:
        champion = min(candidates, key=candidates.get)
        for r in rows:
            r.is_current_champion = (r.model_name == champion)
        db.commit()
        print(f"Champion re-evaluated: {champion}")
    db.close()


if __name__ == "__main__":
    # NOTE: sample_frac < 1.0 trades a little accuracy for much faster training
    # on lower-powered machines; set to 1.0 for the full 60-PHC x 8-medicine panel.
    main(sample_frac=1.0, epochs=8)
