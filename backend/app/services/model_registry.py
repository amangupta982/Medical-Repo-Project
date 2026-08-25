"""
Cached ML model registry.

Loads trained model artifacts once and caches them in memory with a configurable TTL.
Thread-safe. Eliminates the ~200ms overhead of loading XGBoost/LightGBM models
on every single API request.
"""
import os
import time
import threading
from typing import Optional, Tuple, Any

import xgboost as xgb
import lightgbm as lgb

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.exceptions import ModelNotReadyError

logger = get_logger("model_registry")


class ModelRegistry:
    """
    Thread-safe, TTL-based cache for ML model artifacts.

    Usage:
        registry = ModelRegistry()
        model, model_type = registry.get_stockout_champion(db)
        # model is cached for MODEL_CACHE_TTL_SECONDS
    """

    def __init__(self):
        self._cache: dict[str, Tuple[Any, str, float]] = {}  # key -> (model, model_type, loaded_at)
        self._lock = threading.Lock()
        self._settings = get_settings()

    def _is_expired(self, key: str) -> bool:
        if key not in self._cache:
            return True
        _, _, loaded_at = self._cache[key]
        return (time.time() - loaded_at) > self._settings.MODEL_CACHE_TTL_SECONDS

    def _load_model_from_disk(self, model_name: str, artifact_path: Optional[str]) -> Tuple[Any, str]:
        """Load a model artifact from disk based on model name and path."""
        models_dir = self._settings.models_directory
        artifact_name = (
            artifact_path.replace("\\", "/").split("/")[-1]
            if artifact_path
            else None
        )

        if model_name == "xgboost":
            fname = artifact_name or "xgb_stockout.json"
            local_path = os.path.join(models_dir, fname)
            if not os.path.exists(local_path):
                raise ModelNotReadyError(
                    model_task="stockout_classification",
                    hint=f"Artifact not found: {local_path}",
                )
            m = xgb.XGBClassifier()
            m.load_model(local_path)
            logger.info("Loaded XGBoost model from %s", local_path)
            return m, "xgboost"

        elif model_name == "lightgbm":
            fname = artifact_name or "lgb_stockout.txt"
            local_path = os.path.join(models_dir, fname)
            if not os.path.exists(local_path):
                raise ModelNotReadyError(
                    model_task="stockout_classification",
                    hint=f"Artifact not found: {local_path}",
                )
            booster = lgb.Booster(model_file=local_path)
            logger.info("Loaded LightGBM model from %s", local_path)
            return booster, "lightgbm"

        else:
            raise ModelNotReadyError(
                model_task="stockout_classification",
                hint=f"Unknown model type: {model_name}",
            )

    def get_stockout_champion(self, db) -> Tuple[Any, str]:
        """
        Get the current champion model for stockout classification.
        Caches the loaded model to avoid repeated disk reads.
        """
        cache_key = "stockout_champion"

        with self._lock:
            if not self._is_expired(cache_key):
                model, model_type, _ = self._cache[cache_key]
                return model, model_type

        # Load champion info from DB (outside lock to avoid blocking)
        from app.models.db_models import ModelPerformance

        row = db.query(ModelPerformance).filter(
            ModelPerformance.task == "stockout_classification",
            ModelPerformance.is_current_champion == True,  # noqa: E712
        ).first()

        if row is None:
            raise ModelNotReadyError(
                model_task="stockout_classification",
                hint="Run app/ml/classification/train_stockout.py first.",
            )

        model, model_type = self._load_model_from_disk(row.model_name, row.model_artifact_path)

        with self._lock:
            self._cache[cache_key] = (model, model_type, time.time())

        return model, model_type

    def get_demand_model(self, db, model_name: str, horizon: int) -> Tuple[Any, str]:
        """
        Get a specific demand forecasting model for the given horizon.
        Caches the loaded model to avoid repeated disk reads.
        """
        cache_key = f"demand_{model_name}_{horizon}d"

        with self._lock:
            if not self._is_expired(cache_key):
                model, model_type, _ = self._cache[cache_key]
                return model, model_type

        models_dir = self._settings.models_directory

        if model_name == "xgboost":
            m = xgb.XGBRegressor()
            primary = os.path.join(models_dir, f"xgb_demand_{horizon}d.json")
            fallback = os.path.join(models_dir, "xgb_demand.json")
            path = primary if os.path.exists(primary) else fallback
            if not os.path.exists(path):
                raise ModelNotReadyError(
                    model_task=f"demand_forecast_{horizon}d",
                    hint=f"No artifact at {primary} or {fallback}",
                )
            m.load_model(path)
            logger.info("Loaded XGBoost demand model (%dd) from %s", horizon, path)
            result = (m, "xgboost")

        elif model_name == "lightgbm":
            primary = os.path.join(models_dir, f"lgb_demand_{horizon}d.txt")
            fallback = os.path.join(models_dir, "lgb_demand.txt")
            path = primary if os.path.exists(primary) else fallback
            if not os.path.exists(path):
                raise ModelNotReadyError(
                    model_task=f"demand_forecast_{horizon}d",
                    hint=f"No artifact at {primary} or {fallback}",
                )
            booster = lgb.Booster(model_file=path)
            logger.info("Loaded LightGBM demand model (%dd) from %s", horizon, path)
            result = (booster, "lightgbm")

        else:
            raise ModelNotReadyError(
                model_task=f"demand_forecast_{horizon}d",
                hint=f"Unknown model type: {model_name}",
            )

        with self._lock:
            self._cache[cache_key] = (*result, time.time())

        return result

    def invalidate(self, key: Optional[str] = None) -> None:
        """Clear cache. If key is None, clear everything."""
        with self._lock:
            if key:
                self._cache.pop(key, None)
            else:
                self._cache.clear()
                logger.info("Model registry cache fully invalidated")

    def get_cache_stats(self) -> dict:
        """Return current cache statistics for health/debug endpoints."""
        with self._lock:
            now = time.time()
            return {
                "cached_models": len(self._cache),
                "models": {
                    k: {
                        "model_type": v[1],
                        "age_seconds": round(now - v[2], 1),
                        "ttl_remaining": max(0, round(self._settings.MODEL_CACHE_TTL_SECONDS - (now - v[2]), 1)),
                    }
                    for k, v in self._cache.items()
                },
            }


# Singleton instance
model_registry = ModelRegistry()
