"""Model evaluation, plotting and side-by-side comparison."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from . import config
from .models import TrainedModel

logger = logging.getLogger(__name__)
sns.set_theme(style="whitegrid", context="talk")


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------
@dataclass
class EvaluationResult:
    name: str
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    f1_weighted: float
    train_time_s: float
    classification_report: Dict[str, Dict[str, float]] = field(default_factory=dict)
    confusion_matrix_path: str = ""

    def to_summary(self) -> Dict[str, float]:
        return {
            "model": self.name,
            "accuracy": round(self.accuracy, 4),
            "precision_macro": round(self.precision_macro, 4),
            "recall_macro": round(self.recall_macro, 4),
            "f1_macro": round(self.f1_macro, 4),
            "f1_weighted": round(self.f1_weighted, 4),
            "train_time_s": round(self.train_time_s, 2),
        }


# ---------------------------------------------------------------------------
# Plot helpers
# ---------------------------------------------------------------------------
def plot_confusion_matrix(
    y_true: np.ndarray, y_pred: np.ndarray,
    classes: Iterable[int], model_name: str,
) -> Path:
    cm = confusion_matrix(y_true, y_pred, labels=list(classes))
    cm_norm = cm / cm.sum(axis=1, keepdims=True).clip(min=1)
    fig, ax = plt.subplots(figsize=(13, 11))
    sns.heatmap(cm_norm, annot=cm, fmt="d", cmap="Blues",
                xticklabels=list(classes), yticklabels=list(classes),
                cbar_kws={"label": "Row-normalised fraction"}, ax=ax)
    ax.set_title(f"Confusion matrix - {model_name}")
    ax.set_xlabel("Predicted fault")
    ax.set_ylabel("True fault")
    out = config.FIGURE_DIR / f"cm_{model_name}.png"
    fig.tight_layout(); fig.savefig(out, dpi=140, bbox_inches="tight"); plt.close(fig)
    return out


def plot_model_comparison(results: List[EvaluationResult]) -> Path:
    df = pd.DataFrame([r.to_summary() for r in results]).set_index("model")
    metric_cols = [
        "accuracy",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "f1_weighted",
    ]
    fig, ax = plt.subplots(figsize=(11, 6))
    df[metric_cols].plot(kind="bar", ax=ax, colormap="tab10", edgecolor="black")
    ax.set_ylim(0, 1.0)
    ax.set_title("Model comparison on TEP fault classification")
    ax.set_ylabel("Score")
    ax.set_xlabel("")
    ax.tick_params(axis="x", rotation=0)
    ax.legend(loc="lower right", fontsize=9, frameon=True)
    out = config.FIGURE_DIR / "model_comparison.png"
    fig.tight_layout(); fig.savefig(out, dpi=140, bbox_inches="tight"); plt.close(fig)
    return out


# ---------------------------------------------------------------------------
# Core evaluation
# ---------------------------------------------------------------------------
def evaluate_model(
    model: TrainedModel,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> EvaluationResult:
    """Run a model on the test set, persist its confusion matrix, return metrics."""
    y_pred = model.predict(X_test)
    y_true = y_test.values

    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
    rec = recall_score(y_true, y_pred, average="macro", zero_division=0)
    f1m = f1_score(y_true, y_pred, average="macro", zero_division=0)
    f1w = f1_score(y_true, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)

    classes = sorted(set(y_true) | set(y_pred))
    cm_path = plot_confusion_matrix(y_true, y_pred, classes, model.name)

    result = EvaluationResult(
        name=model.name,
        accuracy=acc,
        precision_macro=prec,
        recall_macro=rec,
        f1_macro=f1m,
        f1_weighted=f1w,
        train_time_s=model.train_time_s,
        classification_report=report,
        confusion_matrix_path=str(cm_path),
    )

    logger.info(
        "[%s] acc=%.4f prec_macro=%.4f rec_macro=%.4f f1_macro=%.4f f1_weighted=%.4f",
        model.name, acc, prec, rec, f1m, f1w,
    )
    return result


# ---------------------------------------------------------------------------
# Persist the report
# ---------------------------------------------------------------------------
def save_evaluation_report(results: List[EvaluationResult],
                           filename: str = "model_metrics.json") -> Path:
    payload = {
        "summary": [r.to_summary() for r in results],
        "per_class": {
            r.name: {
                cls: {k: round(v, 4) for k, v in metrics.items()}
                for cls, metrics in r.classification_report.items()
                if isinstance(metrics, dict)
            }
            for r in results
        },
        "confusion_matrices": {r.name: r.confusion_matrix_path for r in results},
    }
    out = config.REPORT_DIR / filename
    out.write_text(json.dumps(payload, indent=2))
    logger.info("Saved metrics report -> %s", out)
    return out


def pick_best_model(results: List[EvaluationResult],
                    metric: str = "f1_macro") -> EvaluationResult:
    return max(results, key=lambda r: getattr(r, metric))
