#!/usr/bin/env python3
"""
02 — Model Evaluation Analysis

Post-training analysis script. Connects to the Postgres database, loads the
model_performance table, and prints a comprehensive model comparison report.

Prerequisites: run the training scripts first:
    python app/ml/classification/train_stockout.py
    python app/ml/forecasting/train_demand.py
    python app/ml/lstm/train_demand_lstm.py

Usage (from backend/ directory):
    PYTHONPATH=. python ../notebooks/02_model_evaluation_analysis.py
"""
import sys
import os

# Allow import from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from sqlalchemy import text
    from app.database.session import engine
except ImportError:
    print("ERROR: Could not import backend modules.")
    print("Run this script from the project root with PYTHONPATH set:")
    print("  cd backend && PYTHONPATH=. python ../notebooks/02_model_evaluation_analysis.py")
    sys.exit(1)


def load_model_performance():
    """Load all rows from the model_performance table."""
    query = text("SELECT * FROM model_performance ORDER BY task, model_name")
    try:
        with engine.connect() as conn:
            import pandas as pd
            df = pd.read_sql(query, conn)
        return df
    except Exception as e:
        print(f"ERROR: Could not connect to database: {e}")
        print("Make sure Postgres is running and DATABASE_URL is set.")
        return None


def analyze_stockout_models(df):
    """Analyze stock-out classification models."""
    print("=" * 70)
    print("STOCK-OUT CLASSIFICATION — MODEL COMPARISON")
    print("=" * 70)

    stockout = df[df["task"] == "stockout_classification"]
    if stockout.empty:
        print("  No stock-out models found. Run train_stockout.py first.")
        return

    champion = stockout[stockout["is_current_champion"] == True]
    champion_name = champion.iloc[0]["model_name"] if not champion.empty else "none"

    print(f"\n  Champion model: {champion_name}")
    print(f"  Total models evaluated: {len(stockout)}")
    print()

    # Print comparison table
    print(f"  {'Model':<22s} {'PR-AUC':>8s} {'ROC-AUC':>9s} {'Recall':>8s} {'Precision':>10s} {'F1':>6s} {'F2':>6s} {'Champ':>6s}")
    print("  " + "-" * 75)
    for _, row in stockout.iterrows():
        m = row["metrics"]
        is_champ = "🏆" if row["is_current_champion"] else ""
        print(f"  {row['model_name']:<22s} {m.get('pr_auc', '-'):>8} {m.get('roc_auc', '-'):>9} "
              f"{m.get('recall', '-'):>8} {m.get('precision', '-'):>10} {m.get('f1', '-'):>6} "
              f"{m.get('f2_score', '-'):>6} {is_champ:>6s}")

    print()
    print("  Key observations:")
    if champion_name in ("xgboost", "lightgbm"):
        cm = champion.iloc[0]["metrics"]
        print(f"    - Champion PR-AUC: {cm.get('pr_auc', 'N/A')}")
        print(f"    - Recall (missable stock-outs): {cm.get('recall', 'N/A')}")
        print(f"    - F2 (recall-weighted): {cm.get('f2_score', 'N/A')}")
        print(f"    - Selection criterion: highest PR-AUC on time-based validation split")
    print()


def analyze_demand_models(df):
    """Analyze demand forecasting models."""
    print("=" * 70)
    print("DEMAND FORECASTING — MODEL COMPARISON")
    print("=" * 70)

    demand = df[df["task"] == "demand_forecast_1d"]
    if demand.empty:
        print("  No demand models found. Run train_demand.py first.")
        return

    champion = demand[demand["is_current_champion"] == True]
    champion_name = champion.iloc[0]["model_name"] if not champion.empty else "none"

    print(f"\n  Champion model: {champion_name}")
    print(f"  Total models evaluated: {len(demand)}")
    print()

    print(f"  {'Model':<22s} {'MAE':>8s} {'RMSE':>8s} {'MAPE%':>8s} {'R²':>8s} {'Champ':>6s}")
    print("  " + "-" * 60)
    for _, row in demand.iterrows():
        m = row["metrics"]
        is_champ = "🏆" if row["is_current_champion"] else ""
        print(f"  {row['model_name']:<22s} {m.get('mae', '-'):>8} {m.get('rmse', '-'):>8} "
              f"{m.get('mape', '-'):>8} {m.get('r2', '-'):>8} {is_champ:>6s}")

    print()
    print("  Key observations:")
    if champion_name in ("xgboost", "lightgbm", "lstm"):
        cm = champion.iloc[0]["metrics"]
        print(f"    - Champion MAE: {cm.get('mae', 'N/A')} units/day")
        print(f"    - Champion R²: {cm.get('r2', 'N/A')}")
        print(f"    - Selection criterion: lowest MAE on time-based validation split")
    print()


def main():
    print()
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║   BRICS Health Platform — Model Evaluation Analysis             ║")
    print("╚══════════════════════════════════════════════════════════════════╝")
    print()

    df = load_model_performance()
    if df is None:
        return

    if df.empty:
        print("No model performance data found.")
        print("Run the training scripts first:")
        print("  python app/ml/classification/train_stockout.py")
        print("  python app/ml/forecasting/train_demand.py")
        print("  python app/ml/lstm/train_demand_lstm.py")
        return

    analyze_stockout_models(df)
    analyze_demand_models(df)

    print("=" * 70)
    print("For live model comparison with charts, see the Model Comparison")
    print("page in the dashboard: http://localhost:5173/models")
    print("=" * 70)


if __name__ == "__main__":
    main()
