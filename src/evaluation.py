"""Model evaluation, plotting and side-by-side comparison."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    log_loss,
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
    log_loss: float = 0.0
    accuracy_train: float = 0.0
    log_loss_train: float = 0.0
    accuracy_val: float = 0.0
    log_loss_val: float = 0.0
    classification_report: Dict[str, Dict[str, float]] = field(default_factory=dict)
    confusion_matrix_path: str = ""

    def to_summary(self) -> Dict[str, float]:
        return {
            "model": self.name,
            "accuracy_train": round(self.accuracy_train, 4),
            "log_loss_train": round(self.log_loss_train, 4),
            "accuracy_val": round(self.accuracy_val, 4),
            "log_loss_val": round(self.log_loss_val, 4),
            "accuracy_test": round(self.accuracy, 4),
            "log_loss_test": round(self.log_loss, 4),
            # Held-out test accuracy (alias for dashboards expecting `accuracy`)
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
        "accuracy_test",
        "accuracy_val",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "f1_weighted",
    ]
    fig, ax = plt.subplots(figsize=(11, 6))
    df[metric_cols].plot(kind="bar", ax=ax, colormap="tab10", edgecolor="black")
    ax.set_ylim(0, 1.05)
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
def _accuracy_log_loss(
    model: TrainedModel,
    X: pd.DataFrame,
    y: pd.Series,
) -> Tuple[float, float]:
    y_true = y.values
    y_pred = model.predict(X)
    acc = accuracy_score(y_true, y_pred)
    proba = model.predict_proba(X)
    ll = float(log_loss(y_true, proba, labels=model.classes_))
    return acc, ll


def evaluate_model(
    model: TrainedModel,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    X_train: pd.DataFrame | None = None,
    y_train: pd.Series | None = None,
    X_val: pd.DataFrame | None = None,
    y_val: pd.Series | None = None,
) -> EvaluationResult:
    """Evaluate on test (primary metrics); optionally report train/val acc + log-loss."""
    y_pred = model.predict(X_test)
    y_true = y_test.values

    acc, ll_test = _accuracy_log_loss(model, X_test, y_test)
    prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
    rec = recall_score(y_true, y_pred, average="macro", zero_division=0)
    f1m = f1_score(y_true, y_pred, average="macro", zero_division=0)
    f1w = f1_score(y_true, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)

    classes = sorted(set(y_true) | set(y_pred))
    cm_path = plot_confusion_matrix(y_true, y_pred, classes, model.name)

    acc_tr, ll_tr = (0.0, 0.0)
    acc_va, ll_va = (0.0, 0.0)
    if X_train is not None and y_train is not None:
        acc_tr, ll_tr = _accuracy_log_loss(model, X_train, y_train)
    if X_val is not None and y_val is not None:
        acc_va, ll_va = _accuracy_log_loss(model, X_val, y_val)

    result = EvaluationResult(
        name=model.name,
        accuracy=acc,
        precision_macro=prec,
        recall_macro=rec,
        f1_macro=f1m,
        f1_weighted=f1w,
        train_time_s=model.train_time_s,
        log_loss=ll_test,
        accuracy_train=acc_tr,
        log_loss_train=ll_tr,
        accuracy_val=acc_va,
        log_loss_val=ll_va,
        classification_report=report,
        confusion_matrix_path=str(cm_path),
    )

    logger.info(
        "[%s] train acc=%.4f ll=%.4f | val acc=%.4f ll=%.4f | test acc=%.4f ll=%.4f | "
        "f1_macro=%.4f",
        model.name, acc_tr, ll_tr, acc_va, ll_va, acc, ll_test, f1m,
    )
    return result


# ---------------------------------------------------------------------------
# Persist the report
# ---------------------------------------------------------------------------
def write_training_summary(
    dataset_summary: Dict[str, object],
    results: List[EvaluationResult],
    model_training_metrics: Dict[str, Dict[str, object]] | None = None,
    path: Path | None = None,
) -> Path:
    """Write a short Markdown report: data regime, split sizes, metrics table."""
    path = path or (config.REPORT_DIR / "training_summary.md")
    lines = [
        "# AIFI training summary",
        "",
        "## Dataset",
        "",
        "- **Source:** Tennessee Eastman faulty archives only (`TEP_Faulty_Training`, "
        "`TEP_Faulty_Testing`). Fault-free baselines are **not** included.",
        "- **Labels:** `faultNumber > 0` (20 fault classes). Pre-injection samples "
        "are removed per the Rieth benchmark (training cutoff sample 20, testing 160).",
        "- **Split:** stratified **70% / 15% / 15%** train / validation / test at row level.",
        "",
        "### Split sizes",
        "",
    ]
    for k, v in sorted(dataset_summary.items()):
        lines.append(f"- **{k}:** {v}")
    lines.extend(["", "## Metrics", ""])

    rows = []
    for r in results:
        row = r.to_summary()
        extra = (model_training_metrics or {}).get(r.name, {})
        xgb_ll = extra.get("xgb_val_mlogloss_best")
        xgb_cell = f"{float(xgb_ll):.4f}" if isinstance(xgb_ll, (int, float)) else "—"
        rows.append(
            f"| {r.name} | {row['accuracy_train']:.4f} | {row['log_loss_train']:.4f} | "
            f"{row['accuracy_val']:.4f} | {row['log_loss_val']:.4f} | "
            f"{row['accuracy_test']:.4f} | {row['log_loss_test']:.4f} | "
            f"{row['f1_macro']:.4f} | {xgb_cell} |"
        )
    header = (
        "| Model | Train acc | Train log-loss | Val acc | Val log-loss | "
        "Test acc | Test log-loss | F1 (macro) | XGB val mlogloss (best) |"
    )
    sep = "|" + "|".join(["---"] * 9) + "|"
    lines.extend([header, sep] + rows)
    lines.append("")
    lines.append(
        "*Log-loss* is multiclass log-loss (natural log) from `predict_proba`, "
        "using the model's class list. XGBoost also logs validation mlogloss "
        "during training when a validation set is provided."
    )
    path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Wrote training summary -> %s", path)
    return path


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
