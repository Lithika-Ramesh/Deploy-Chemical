"""Industrial preprocessing utilities for TEP sensor data.

In a real chemical plant the raw telemetry that lands in the historian is
rarely model-ready: sensors drop out, valves get re-tagged, scales are
inconsistent. This module wraps a small but production-shaped pipeline:

* feature consistency check (no missing/extra tags vs the schema),
* missing-value imputation (median - robust to sensor spikes),
* StandardScaler normalisation (fit on training data only),
* an outlier audit that reports - but never silently drops - extreme
  readings so the operator can decide what to do.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

from . import config

logger = logging.getLogger(__name__)


@dataclass
class PreprocessingArtifacts:
    """Everything the pipeline needs at inference time."""
    scaler: StandardScaler
    imputer: SimpleImputer
    feature_columns: List[str]

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        X_aligned = check_feature_consistency(X, self.feature_columns)
        X_imp = self.imputer.transform(X_aligned)
        X_scl = self.scaler.transform(X_imp)
        return pd.DataFrame(X_scl, columns=self.feature_columns, index=X.index)


# ---------------------------------------------------------------------------
# Schema / consistency checks
# ---------------------------------------------------------------------------
def check_feature_consistency(X: pd.DataFrame, expected: Iterable[str]) -> pd.DataFrame:
    """Ensure incoming telemetry has exactly the expected sensor tags.

    Missing columns are filled with NaN (so the imputer can recover them)
    and unknown tags are dropped with a warning - the very behaviour you
    want when a plant adds or renames a tag without warning the AI team.
    """
    expected = list(expected)
    extras = [c for c in X.columns if c not in expected]
    missing = [c for c in expected if c not in X.columns]
    if extras:
        logger.warning("Dropping %d unknown tag(s): %s", len(extras), extras[:5])
    if missing:
        logger.warning("Filling %d missing tag(s) with NaN: %s", len(missing), missing[:5])
    aligned = X.drop(columns=extras, errors="ignore").copy()
    for col in missing:
        aligned[col] = np.nan
    return aligned[expected]


def audit_missing(X: pd.DataFrame) -> pd.Series:
    """Return per-feature missing rate (handy for the EDA report)."""
    return X.isna().mean().sort_values(ascending=False)


def audit_outliers(X: pd.DataFrame, z_threshold: float = 6.0) -> pd.DataFrame:
    """Flag readings beyond ``z_threshold`` standard deviations.

    Returns one row per sensor with the count and percentage of extreme
    readings - an audit log, not an automatic delete.
    """
    mu = X.mean(numeric_only=True)
    sd = X.std(numeric_only=True).replace(0, np.nan)
    z = (X - mu).abs() / sd
    flagged = (z > z_threshold).sum()
    rate = flagged / len(X)
    out = pd.DataFrame({
        "outlier_count": flagged.astype(int),
        "outlier_rate":  rate.round(5),
    }).sort_values("outlier_count", ascending=False)
    return out


# ---------------------------------------------------------------------------
# Fit/transform pipeline
# ---------------------------------------------------------------------------
def fit_preprocessor(
    X_train: pd.DataFrame,
    feature_columns: List[str] | None = None,
) -> Tuple[pd.DataFrame, PreprocessingArtifacts]:
    """Fit imputer + scaler on the training set."""
    feature_columns = feature_columns or config.FEATURE_COLUMNS
    X_aligned = check_feature_consistency(X_train, feature_columns)

    imputer = SimpleImputer(strategy="median")
    X_imp = imputer.fit_transform(X_aligned)

    scaler = StandardScaler()
    X_scl = scaler.fit_transform(X_imp)

    artifacts = PreprocessingArtifacts(
        scaler=scaler, imputer=imputer, feature_columns=feature_columns,
    )
    X_out = pd.DataFrame(X_scl, columns=feature_columns, index=X_train.index)
    return X_out, artifacts


def transform(X: pd.DataFrame, artifacts: PreprocessingArtifacts) -> pd.DataFrame:
    return artifacts.transform(X)


# ---------------------------------------------------------------------------
# Convenience: run the whole preprocessing block and produce a report
# ---------------------------------------------------------------------------
def preprocess_split(
    X_train: pd.DataFrame, X_test: pd.DataFrame,
    feature_columns: List[str] | None = None,
) -> Tuple[pd.DataFrame, pd.DataFrame, PreprocessingArtifacts, Dict[str, pd.DataFrame]]:
    """One-shot helper used by the orchestrator and the notebook."""
    feature_columns = feature_columns or config.FEATURE_COLUMNS

    report = {
        "missing_train":  audit_missing(X_train).to_frame("missing_rate"),
        "outliers_train": audit_outliers(X_train),
    }

    X_train_p, artifacts = fit_preprocessor(X_train, feature_columns)
    X_test_p = transform(X_test, artifacts)

    report["missing_test"]  = audit_missing(X_test).to_frame("missing_rate")
    report["outliers_test"] = audit_outliers(X_test)

    logger.info("Preprocessing complete: train=%s test=%s", X_train_p.shape, X_test_p.shape)
    return X_train_p, X_test_p, artifacts, report
