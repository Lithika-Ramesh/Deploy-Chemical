"""Explainability layer - feature importance + SHAP for the AIFI engine.

Operators and reliability engineers will not trust a black-box predictor
running their reactor. This module produces:

* a global feature-importance ranking (from the tree estimator itself);
* a SHAP summary plot computed on a small random subset of the test set;
* the importances persisted as a CSV so the dashboard can render them.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from . import config
from .models import TrainedModel

logger = logging.getLogger(__name__)
sns.set_theme(style="whitegrid", context="talk")


# ---------------------------------------------------------------------------
# Native feature importances (cheap & always available)
# ---------------------------------------------------------------------------
def feature_importance_table(model: TrainedModel) -> pd.DataFrame:
    est = model.estimator
    if not hasattr(est, "feature_importances_"):
        raise AttributeError(
            f"Estimator {est.__class__.__name__} has no native feature_importances_."
        )
    df = pd.DataFrame({
        "feature": model.feature_columns,
        "importance": est.feature_importances_,
    }).sort_values("importance", ascending=False).reset_index(drop=True)
    return df


def plot_feature_importance(model: TrainedModel, top_n: int = 25) -> Path:
    df = feature_importance_table(model).head(top_n)
    fig, ax = plt.subplots(figsize=(10, max(6, 0.3 * top_n)))
    sns.barplot(data=df, y="feature", x="importance",
                hue="feature", palette="viridis", legend=False, ax=ax)
    ax.set_title(f"Top {top_n} feature importances - {model.name}")
    ax.set_xlabel("Importance")
    ax.set_ylabel("")
    out = config.FIGURE_DIR / f"feature_importance_{model.name}.png"
    fig.tight_layout(); fig.savefig(out, dpi=140, bbox_inches="tight"); plt.close(fig)

    csv_path = config.REPORT_DIR / f"feature_importance_{model.name}.csv"
    feature_importance_table(model).to_csv(csv_path, index=False)
    logger.info("Saved feature-importance plot %s and table %s", out, csv_path)
    return out


# ---------------------------------------------------------------------------
# SHAP - model-agnostic but slow; we sample a subset
# ---------------------------------------------------------------------------
def compute_shap_summary(
    model: TrainedModel,
    X_test: pd.DataFrame,
    sample_size: int = config.DEFAULT_MODEL.shap_sample_size,
    random_state: int = 0,
) -> Optional[Path]:
    """Compute a SHAP summary plot on a random subset of the test set."""
    try:
        import shap  # local import - heavy
    except ImportError:
        logger.warning("SHAP not installed - skipping SHAP analysis.")
        return None

    rng = np.random.default_rng(random_state)
    n = min(sample_size, len(X_test))
    idx = rng.choice(len(X_test), size=n, replace=False)
    X_sample = X_test.iloc[idx]
    X_proc = model.preprocessor.transform(X_sample)

    logger.info("Computing SHAP values on %d samples (this can take a minute)…", n)
    try:
        explainer = shap.TreeExplainer(model.estimator)
        shap_values = explainer.shap_values(X_proc.values)
    except Exception as exc:
        logger.warning("TreeExplainer failed (%s); skipping SHAP.", exc)
        return None

    if isinstance(shap_values, list):
        sv = np.mean([np.abs(v) for v in shap_values], axis=0)
    elif np.ndim(shap_values) == 3:
        sv = np.mean(np.abs(shap_values), axis=2)
    else:
        sv = np.abs(shap_values)

    mean_abs = pd.DataFrame({
        "feature": model.feature_columns,
        "mean_abs_shap": sv.mean(axis=0),
    }).sort_values("mean_abs_shap", ascending=False)

    csv_path = config.REPORT_DIR / f"shap_importance_{model.name}.csv"
    mean_abs.to_csv(csv_path, index=False)

    top = mean_abs.head(20)
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.barplot(data=top, y="feature", x="mean_abs_shap",
                hue="feature", palette="magma", legend=False, ax=ax)
    ax.set_title(f"SHAP global importance - {model.name}")
    ax.set_xlabel("Mean |SHAP value|  (averaged across classes)")
    ax.set_ylabel("")
    out = config.FIGURE_DIR / f"shap_summary_{model.name}.png"
    fig.tight_layout(); fig.savefig(out, dpi=140, bbox_inches="tight"); plt.close(fig)
    logger.info("Saved SHAP summary plot %s and table %s", out, csv_path)
    return out
