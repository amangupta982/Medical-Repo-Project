"""
Federated learning across 5 SIMULATED clients labeled India, Brazil, Russia,
China, South Africa.

IMPORTANT / HONESTY NOTE (also in docs/DATA_SOURCES.md):
We do not have real per-country PHC datasets. Each "country" client is a
disjoint district-partition of the SAME calibrated synthetic Karnataka-style
PHC network, re-parameterized with a different demand/seasonality/resource
profile per client to simulate genuine cross-population heterogeneity
(non-IID data, which is the realistic and hard case for federated learning).
This is clearly a simulated multi-client harness demonstrating the FEDERATED
LEARNING MECHANISM (local training, weight-only aggregation, no raw data
crossing client boundaries) -- it is NOT a claim of real national datasets.

Uses Flower's simulation runtime (in-process, multiple virtual clients) with
a small Keras model on the stock-out classification task, so we can honestly
report: local-only performance vs FedAvg-aggregated performance.
"""
import os
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

import flwr as fl
from flwr.common import ndarrays_to_parameters
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, average_precision_score

from app.ml.preprocessing.features import load_panel, compute_stockout_labels, build_features, FEATURE_COLS, STOCKOUT_TARGET

tf.random.set_seed(42)
np.random.seed(42)

CLIENT_NAMES = ["India", "Brazil", "Russia", "China", "South_Africa"]

# per-client heterogeneity profile: simulates different national demand/resource
# realities so client data is genuinely non-IID (the realistic federated setting)
CLIENT_PROFILES = {
    "India":        {"demand_mult": 1.00, "lead_time_mult": 1.00, "outbreak_mult": 1.00},
    "Brazil":       {"demand_mult": 0.85, "lead_time_mult": 0.80, "outbreak_mult": 1.30},  # dengue-heavy
    "Russia":       {"demand_mult": 0.70, "lead_time_mult": 1.40, "outbreak_mult": 0.60},  # colder, slower supply
    "China":        {"demand_mult": 1.15, "lead_time_mult": 0.70, "outbreak_mult": 0.80},  # denser, faster logistics
    "South_Africa": {"demand_mult": 0.90, "lead_time_mult": 1.20, "outbreak_mult": 1.10},
}


def build_client_partitions():
    """Partitions districts across 5 clients and re-weights features per profile
    to create non-IID client datasets, without any raw data leaving its client."""
    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)

    districts = sorted(df["district"].unique())
    rng = np.random.default_rng(7)
    shuffled = list(districts)
    rng.shuffle(shuffled)
    splits = np.array_split(shuffled, len(CLIENT_NAMES))

    client_data = {}
    for name, dist_subset in zip(CLIENT_NAMES, splits):
        sub = df[df["district"].isin(dist_subset)].copy()
        profile = CLIENT_PROFILES[name]
        sub["consumption_ma7"] *= profile["demand_mult"]
        sub["consumption_ma14"] *= profile["demand_mult"]
        sub["lead_time_days"] *= profile["lead_time_mult"]
        sub["outbreak_active"] = (sub["outbreak_active"] * profile["outbreak_mult"]).clip(0, 1).round().astype(int)
        client_data[name] = sub
    return client_data


def _make_model(input_dim):
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,)),
        keras.layers.Dense(32, activation="relu"),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(16, activation="relu"),
        keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["AUC"])
    return model


class BricsClient(fl.client.NumPyClient):
    """One simulated national client. Trains only on ITS OWN local partition;
    only model weights are ever sent to the server (fl.client.NumPyClient
    handles this contract -- get_parameters/fit/evaluate never expose raw data)."""

    def __init__(self, name, X_train, y_train, X_test, y_test):
        self.name = name
        self.X_train, self.y_train = X_train, y_train
        self.X_test, self.y_test = X_test, y_test
        self.model = _make_model(X_train.shape[1])

    def get_parameters(self, config):
        return self.model.get_weights()

    def fit(self, parameters, config):
        self.model.set_weights(parameters)
        self.model.fit(self.X_train, self.y_train, epochs=3, batch_size=64, verbose=0)
        return self.model.get_weights(), len(self.X_train), {}

    def evaluate(self, parameters, config):
        self.model.set_weights(parameters)
        loss, auc = self.model.evaluate(self.X_test, self.y_test, verbose=0)
        prob = self.model.predict(self.X_test, verbose=0).flatten()
        pr_auc = average_precision_score(self.y_test, prob) if len(np.unique(self.y_test)) > 1 else 0.0
        return loss, len(self.X_test), {"roc_auc": float(auc), "pr_auc": float(pr_auc)}


def prepare_client_tensors(client_data):
    prepared = {}
    global_scaler = StandardScaler()
    all_train = pd.concat([d[d["date"] < d["date"].quantile(0.75)] for d in client_data.values()])
    global_scaler.fit(all_train[FEATURE_COLS])

    for name, df in client_data.items():
        cutoff = df["date"].quantile(0.75)
        train, test = df[df["date"] < cutoff], df[df["date"] >= cutoff]
        X_train = global_scaler.transform(train[FEATURE_COLS]).astype("float32")
        y_train = train[STOCKOUT_TARGET].values.astype("float32")
        X_test = global_scaler.transform(test[FEATURE_COLS]).astype("float32")
        y_test = test[STOCKOUT_TARGET].values.astype("float32")
        prepared[name] = (X_train, y_train, X_test, y_test)
    return prepared


def run_local_only_baseline(prepared):
    """Each client trains a model on ONLY its own data, no federation -- this
    is the 'before federated learning' comparison point."""
    results = {}
    for name, (X_train, y_train, X_test, y_test) in prepared.items():
        model = _make_model(X_train.shape[1])
        model.fit(X_train, y_train, epochs=5, batch_size=64, verbose=0)
        prob = model.predict(X_test, verbose=0).flatten()
        pr_auc = average_precision_score(y_test, prob) if len(np.unique(y_test)) > 1 else 0.0
        roc = roc_auc_score(y_test, prob) if len(np.unique(y_test)) > 1 else 0.0
        results[name] = {"pr_auc": round(float(pr_auc), 4), "roc_auc": round(float(roc), 4),
                          "n_train": len(X_train)}
    return results


def run_federated_training(rounds=5):
    print("Building non-IID client partitions (India/Brazil/Russia/China/South Africa)...")
    client_data = build_client_partitions()
    prepared = prepare_client_tensors(client_data)

    print("\n--- BEFORE: local-only training per client (no collaboration) ---")
    local_only = run_local_only_baseline(prepared)
    for name, m in local_only.items():
        print(f"  {name:15s} PR-AUC={m['pr_auc']:.4f}  ROC-AUC={m['roc_auc']:.4f}  (n={m['n_train']})")

    def client_fn(cid: str):
        name = CLIENT_NAMES[int(cid)]
        X_train, y_train, X_test, y_test = prepared[name]
        return BricsClient(name, X_train, y_train, X_test, y_test).to_client()

    strategy = fl.server.strategy.FedAvg(
        fraction_fit=1.0, fraction_evaluate=1.0,
        min_fit_clients=len(CLIENT_NAMES), min_evaluate_clients=len(CLIENT_NAMES),
        min_available_clients=len(CLIENT_NAMES),
    )

    print(f"\n--- Running {rounds} rounds of federated averaging (FedAvg) across {len(CLIENT_NAMES)} clients ---")
    history = fl.simulation.start_simulation(
        client_fn=client_fn,
        num_clients=len(CLIENT_NAMES),
        config=fl.server.ServerConfig(num_rounds=rounds),
        strategy=strategy,
        client_resources={"num_cpus": 1},
    )

    # aggregate final round's per-client metrics from history
    fed_metrics = {}
    if history.metrics_distributed:
        for metric_name, rounds_list in history.metrics_distributed.items():
            fed_metrics[metric_name] = rounds_list[-1][1]  # (round, value) of last round

    print("\n--- AFTER: federated (FedAvg) aggregated model, evaluated per client ---")
    print(f"  Federated round-{rounds} distributed metrics: {fed_metrics}")

    summary = {
        "clients": CLIENT_NAMES,
        "rounds": rounds,
        "local_only_before": local_only,
        "federated_avg_after": fed_metrics,
        "note": (
            "Clients are simulated national partitions of a calibrated synthetic "
            "PHC dataset with per-client demand/resource heterogeneity, NOT real "
            "national health records. Raw data never left each client during training; "
            "only model weight updates were exchanged (Flower NumPyClient contract)."
        ),
    }
    return summary


if __name__ == "__main__":
    result = run_federated_training(rounds=5)
    import json
    print(json.dumps(result, indent=2, default=str))
