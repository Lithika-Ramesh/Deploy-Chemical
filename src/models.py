"""Model factory + training helpers for the AIFI predictive engine.

Two production-grade tree learners are wired in by default:

* :class:`sklearn.ensemble.RandomForestClassifier` - robust baseline,
  trivially parallelisable, no calibration headaches.
* :class:`xgboost.XGBClassifier` - gradient boosting baseline that
  usually wins on tabular sensor data.

Both share a unified ``train_model`` interface so the orchestrator and
the API can swap implementations without touching the rest of the code.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

from . import config
from .preprocessing import PreprocessingArtifacts

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Bundle that gets persisted to disk
# ---------------------------------------------------------------------------
@dataclass
class TrainedModel:
    name: str
    estimator: Any
    label_encoder: LabelEncoder
    preprocessor: PreprocessingArtifacts
    feature_columns: List[str]
    classes_: np.ndarray
    train_time_s: float = 0.0
    metrics: Dict[str, Any] = field(default_factory=dict)

    # ---- persistence ------------------------------------------------------
    def save(self, path: Optional[Path] = None) -> Path:
        path = Path(path) if path else config.MODEL_DIR / f"{self.name}.joblib"
        joblib.dump(self, path)
        logger.info("Saved %s -> %s", self.name, path)
        return path

    @staticmethod
    def load(path: Path) -> "TrainedModel":
        return joblib.load(path)

    # ---- inference --------------------------------------------------------
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        Xp = self.preprocessor.transform(X)
        y_enc = self.estimator.predict(Xp)
        return self.label_encoder.inverse_transform(y_enc)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        Xp = self.preprocessor.transform(X)
        return self.estimator.predict_proba(Xp)


# ---------------------------------------------------------------------------
# Estimator factories
# ---------------------------------------------------------------------------
def make_random_forest(cfg: config.ModelConfig = config.DEFAULT_MODEL) -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=cfg.rf_n_estimators,
        max_depth=cfg.rf_max_depth,
        n_jobs=cfg.n_jobs,
        random_state=cfg.random_state,
        class_weight="balanced_subsample",
        min_samples_leaf=2,
    )


def make_xgboost(num_classes: int,
                 cfg: config.ModelConfig = config.DEFAULT_MODEL):
    """XGBoost classifier configured for multi-class TEP fault prediction."""
    from xgboost import XGBClassifier  # local import - heavy
    return XGBClassifier(
        n_estimators=cfg.xgb_n_estimators,
        max_depth=cfg.xgb_max_depth,
        learning_rate=cfg.xgb_learning_rate,
        subsample=cfg.xgb_subsample,
        colsample_bytree=cfg.xgb_colsample_bytree,
        objective="multi:softprob",
        num_class=num_classes,
        tree_method="hist",
        eval_metric="mlogloss",
        n_jobs=cfg.n_jobs,
        random_state=cfg.random_state,
    )


MODEL_FACTORY = {
    "random_forest": make_random_forest,
    "xgboost":       make_xgboost,
}


# ---------------------------------------------------------------------------
# Unified training entry point
# ---------------------------------------------------------------------------
def train_model(
    name: str,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    preprocessor: PreprocessingArtifacts,
    cfg: config.ModelConfig = config.DEFAULT_MODEL,
    X_val: Optional[pd.DataFrame] = None,
    y_val: Optional[pd.Series] = None,
) -> TrainedModel:
    """Encode labels, build the estimator, fit it, return a TrainedModel."""
    name = name.lower()
    if name not in MODEL_FACTORY:
        raise ValueError(f"Unknown model '{name}'. Choose one of {list(MODEL_FACTORY)}.")

    le = LabelEncoder()
    y_enc = le.fit_transform(y_train.values)
    n_classes = int(len(le.classes_))

    if name == "xgboost":
        estimator = MODEL_FACTORY[name](num_classes=n_classes, cfg=cfg)
    else:
        estimator = MODEL_FACTORY[name](cfg=cfg)

    logger.info("Training %s on X=%s y=%s (%d classes)…",
                name, X_train.shape, y_train.shape, n_classes)
    t0 = time.perf_counter()
    metrics: Dict[str, Any] = {}
    if name == "xgboost" and X_val is not None and y_val is not None:
        y_val_enc = le.transform(y_val.values)
        estimator.set_params(early_stopping_rounds=20)
        estimator.fit(
            X_train,
            y_enc,
            eval_set=[(X_val, y_val_enc)],
            verbose=False,
        )
        ev = estimator.evals_result()
        mlog = ev["validation_0"]["mlogloss"]
        metrics["xgb_val_mlogloss_best"] = float(min(mlog))
        metrics["xgb_val_mlogloss_final"] = float(mlog[-1])
        if getattr(estimator, "best_iteration", None) is not None:
            metrics["xgb_best_iteration"] = int(estimator.best_iteration)
    else:
        estimator.fit(X_train, y_enc)
    elapsed = time.perf_counter() - t0
    logger.info("Trained %s in %.1fs", name, elapsed)

    return TrainedModel(
        name=name,
        estimator=estimator,
        label_encoder=le,
        preprocessor=preprocessor,
        feature_columns=preprocessor.feature_columns,
        classes_=le.classes_,
        train_time_s=elapsed,
        metrics=metrics,
    )


def train_all(
    model_names: Iterable[str],
    X_train: pd.DataFrame,
    y_train: pd.Series,
    preprocessor: PreprocessingArtifacts,
    cfg: config.ModelConfig = config.DEFAULT_MODEL,
    X_val: Optional[pd.DataFrame] = None,
    y_val: Optional[pd.Series] = None,
) -> Dict[str, TrainedModel]:
    return {
        n: train_model(n, X_train, y_train, preprocessor, cfg, X_val, y_val)
        for n in model_names
    }
