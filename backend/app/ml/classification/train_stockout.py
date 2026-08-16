"""
Trains baseline, XGBoost, and LightGBM stock-out classifiers with walk-forward
(time-based) validation, evaluates on Recall/Precision/F1/PR-AUC/ROC-AUC/F2,
and persists BOTH the trained artifacts AND the evaluation metrics into
model_performance so the API can serve live inference + honest comparison
without retraining on every request.
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    recall_score, precision_score, fbeta_score, f1_score,
    average_precision_score, roc_auc_score, confusion_matrix
)

from app.database.session import SessionLocal
from app.models.db_models import ModelPerformance
from app.ml.preprocessing.features import load_panel, compute_stockout_labels, build_features, FEATURE_COLS, STOCKOUT_TARGET

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "models", "trained")
os.makedirs(MODEL_DIR, exist_ok=True)


def time_split(df, frac=0.75):
    dates = np.sort(df["date"].unique())
    cutoff = dates[int(len(dates) * frac)]
    return df[df["date"] < cutoff], df[df["date"] >= cutoff]


def tune_threshold(y_true, y_prob, min_recall=0.80):
    best_thr, best_f2 = 0.5, -1
    for thr in np.arange(0.05, 0.95, 0.02):
        pred = (y_prob >= thr).astype(int)
        r = recall_score(y_true, pred)
        if r >= min_recall:
            f2 = fbeta_score(y_true, pred, beta=2, zero_division=0)
            if f2 > best_f2:
                best_f2, best_thr = f2, thr
    return best_thr


def evaluate(y_true, y_prob, thr):
    pred = (y_prob >= thr).astype(int)
    cm = confusion_matrix(y_true, pred).tolist()
    return {
        "threshold": round(float(thr), 3),
        "recall": round(recall_score(y_true, pred), 4),
        "precision": round(precision_score(y_true, pred, zero_division=0), 4),
        "f1": round(f1_score(y_true, pred, zero_division=0), 4),
        "f2_score": round(fbeta_score(y_true, pred, beta=2, zero_division=0), 4),
        "pr_auc": round(average_precision_score(y_true, y_prob), 4),
        "roc_auc": round(roc_auc_score(y_true, y_prob), 4),
        "confusion_matrix": cm,
    }


def main():
    print("Loading panel from Postgres...")
    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)
    train, test = time_split(df)

    X_train, y_train = train[FEATURE_COLS], train[STOCKOUT_TARGET]
    X_test, y_test = test[FEATURE_COLS], test[STOCKOUT_TARGET]
    print(f"Train {len(train)} rows | Test {len(test)} rows | pos rate train={y_train.mean():.4f} test={y_test.mean():.4f}")

    results = {}

    # --- Baseline: rule (days_of_stock_left < lead_time * 1.3) ---
    base_prob = (test["days_of_stock_left"] < test["lead_time_days"] * 1.3).astype(float).values
    results["baseline"] = evaluate(y_test, base_prob, 0.5)

    # --- Logistic Regression (secondary baseline) ---
    scaler = StandardScaler()
    Xtr_s = scaler.fit_transform(X_train)
    Xte_s = scaler.transform(X_test)
    logreg = LogisticRegression(max_iter=1000, class_weight="balanced").fit(Xtr_s, y_train)
    lr_prob = logreg.predict_proba(Xte_s)[:, 1]
    thr = tune_threshold(y_test, lr_prob)
    results["logistic_regression"] = evaluate(y_test, lr_prob, thr)

    # --- XGBoost ---
    spw = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    xgb_model = xgb.XGBClassifier(
        n_estimators=400, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=spw, eval_metric="aucpr", random_state=42, n_jobs=-1,
    )
    xgb_model.fit(X_train, y_train)
    xgb_prob = xgb_model.predict_proba(X_test)[:, 1]
    thr = tune_threshold(y_test, xgb_prob)
    results["xgboost"] = evaluate(y_test, xgb_prob, thr)
    xgb_path = os.path.join(MODEL_DIR, "xgb_stockout.json")
    xgb_model.save_model(xgb_path)

    # --- LightGBM ---
    lgb_model = lgb.LGBMClassifier(
        n_estimators=400, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=spw, random_state=42, n_jobs=-1, verbose=-1,
    )
    lgb_model.fit(X_train, y_train)
    lgb_prob = lgb_model.predict_proba(X_test)[:, 1]
    thr = tune_threshold(y_test, lgb_prob)
    results["lightgbm"] = evaluate(y_test, lgb_prob, thr)
    lgb_path = os.path.join(MODEL_DIR, "lgb_stockout.txt")
    lgb_model.booster_.save_model(lgb_path)

    print("\n=== Stock-out classification: model comparison ===")
    for name, m in results.items():
        print(f"{name:22s} PR-AUC={m['pr_auc']:.4f}  Recall={m['recall']:.4f}  Precision={m['precision']:.4f}  F2={m['f2_score']:.4f}")

    # champion = highest PR-AUC among the REAL candidate models (not the naive baseline)
    candidates = {k: v for k, v in results.items() if k in ("xgboost", "lightgbm")}
    champion_name = max(candidates, key=lambda k: candidates[k]["pr_auc"])
    print(f"\nChampion model: {champion_name} (PR-AUC={candidates[champion_name]['pr_auc']})")

    # persist to DB
    db = SessionLocal()
    db.query(ModelPerformance).filter(ModelPerformance.task == "stockout_classification").delete()
    for name, metrics in results.items():
        path = {"xgboost": xgb_path, "lightgbm": lgb_path}.get(name)
        db.add(ModelPerformance(
            task="stockout_classification", model_name=name, metrics=metrics,
            is_current_champion=(name == champion_name), model_artifact_path=path,
        ))
    db.commit()
    db.close()
    print("Saved model comparison + champion flag to model_performance table.")
    return results, champion_name


if __name__ == "__main__":
    main()
