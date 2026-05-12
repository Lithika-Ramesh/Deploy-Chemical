"""Exploratory data analysis for the TEP smart-factory prototype.

Every chart is saved as a PNG inside ``outputs/figures`` so it can be
embedded in a notebook, a slide deck or the Industry 4.0 dashboard.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.decomposition import PCA

from . import config

logger = logging.getLogger(__name__)
sns.set_theme(style="whitegrid", context="talk")


def _save(fig: plt.Figure, name: str) -> Path:
    out = config.FIGURE_DIR / name
    fig.tight_layout()
    fig.savefig(out, dpi=140, bbox_inches="tight")
    plt.close(fig)
    logger.info("Saved figure %s", out)
    return out


# ---------------------------------------------------------------------------
# 1. Class distribution
# ---------------------------------------------------------------------------
def plot_class_distribution(
    y_train: pd.Series,
    y_test: pd.Series,
    y_val: Optional[pd.Series] = None,
    filename: str = "01_class_distribution.png",
) -> Path:
    parts = {
        "Train": y_train.value_counts().sort_index(),
        "Test": y_test.value_counts().sort_index(),
    }
    if y_val is not None:
        parts["Val"] = y_val.value_counts().sort_index()
    counts = pd.DataFrame(parts).fillna(0).astype(int)
    counts.index = [f"{i}\n{config.get_fault_label(i).split()[0]}" for i in counts.index]

    colors = ["#2563eb", "#f97316", "#22c55e"][: counts.shape[1]]
    fig, ax = plt.subplots(figsize=(14, 6))
    counts.plot(kind="bar", ax=ax, color=colors, edgecolor="black")
    ax.set_title("Sample distribution per fault class (train / val / test)")
    ax.set_xlabel("Fault number")
    ax.set_ylabel("Number of samples")
    ax.tick_params(axis="x", rotation=45)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 2. Correlation heatmap
# ---------------------------------------------------------------------------
def plot_correlation_heatmap(X: pd.DataFrame,
                             filename: str = "02_correlation_heatmap.png") -> Path:
    corr = X.corr(numeric_only=True)
    fig, ax = plt.subplots(figsize=(14, 12))
    sns.heatmap(corr, cmap="coolwarm", center=0, vmin=-1, vmax=1,
                square=True, cbar_kws={"shrink": 0.7}, ax=ax)
    ax.set_title("Sensor & manipulated-variable correlation matrix")
    ax.set_xticklabels(ax.get_xticklabels(), rotation=90, fontsize=7)
    ax.set_yticklabels(ax.get_yticklabels(), rotation=0, fontsize=7)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 3. Sensor trends per fault
# ---------------------------------------------------------------------------
def plot_sensor_trends(
    X: pd.DataFrame, meta: pd.DataFrame, y: pd.Series,
    sensors: Optional[Iterable[str]] = None,
    fault_ids: Optional[Iterable[int]] = None,
    filename: str = "03_sensor_trends.png",
) -> Path:
    """Median trajectory of selected sensors for selected fault classes."""
    sensors = list(sensors) if sensors else ["xmeas_7", "xmeas_9", "xmeas_21", "xmv_10"]
    fault_ids = list(fault_ids) if fault_ids else [0, 1, 4, 6, 11, 14]
    df = X.copy()
    df["sample"] = meta["sample"].values
    df["fault"] = y.values

    fig, axes = plt.subplots(len(sensors), 1, figsize=(13, 3.2 * len(sensors)),
                             sharex=True)
    if len(sensors) == 1:
        axes = [axes]
    palette = sns.color_palette("tab10", n_colors=len(fault_ids))

    for ax, sensor in zip(axes, sensors):
        for color, fid in zip(palette, fault_ids):
            sub = df[df["fault"] == fid]
            if sub.empty:
                continue
            agg = sub.groupby("sample")[sensor].median()
            ax.plot(agg.index, agg.values, label=f"F{fid}: {config.get_fault_label(fid)}",
                    color=color, linewidth=2)
        ax.set_ylabel(sensor)
        ax.grid(True, alpha=0.3)
    axes[0].set_title("Median sensor trajectory per fault class")
    axes[-1].set_xlabel("Sample (3-min intervals)")
    axes[0].legend(loc="upper center", bbox_to_anchor=(0.5, 1.4),
                   ncol=2, fontsize=9, frameon=False)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 4. PCA scatter (2D projection)
# ---------------------------------------------------------------------------
def plot_pca(
    X: pd.DataFrame, y: pd.Series,
    sample_size: int = 8000,
    fault_ids: Optional[Iterable[int]] = None,
    filename: str = "04_pca_scatter.png",
    random_state: int = 0,
) -> Path:
    rng = np.random.default_rng(random_state)
    if fault_ids is not None:
        mask = y.isin(list(fault_ids))
        X = X[mask]; y = y[mask]
    if len(X) > sample_size:
        idx = rng.choice(len(X), size=sample_size, replace=False)
        X = X.iloc[idx]; y = y.iloc[idx]

    pca = PCA(n_components=2, random_state=random_state)
    Z = pca.fit_transform(X.values)
    df = pd.DataFrame({"PC1": Z[:, 0], "PC2": Z[:, 1], "fault": y.values})

    fig, ax = plt.subplots(figsize=(11, 8))
    sns.scatterplot(data=df, x="PC1", y="PC2", hue="fault",
                    palette="tab20", s=14, alpha=0.7, ax=ax,
                    edgecolor="none", legend="full")
    ax.set_title(
        f"PCA projection of TEP sensors "
        f"(explained var: PC1={pca.explained_variance_ratio_[0]:.1%}, "
        f"PC2={pca.explained_variance_ratio_[1]:.1%})"
    )
    ax.legend(bbox_to_anchor=(1.02, 1), loc="upper left",
              fontsize=8, title="Fault", frameon=False)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 5. Feature variance summary (used as a sanity check on scaling)
# ---------------------------------------------------------------------------
def plot_feature_variance(
    X: pd.DataFrame, filename: str = "05_feature_variance.png",
) -> Path:
    var = X.var(numeric_only=True).sort_values(ascending=False)
    fig, ax = plt.subplots(figsize=(13, 6))
    var.plot(kind="bar", ax=ax, color="#0ea5e9", edgecolor="black")
    ax.set_title("Per-sensor variance (post-scaling)")
    ax.set_ylabel("Variance")
    ax.tick_params(axis="x", rotation=90, labelsize=7)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# Orchestrator: run the whole EDA suite in one call
# ---------------------------------------------------------------------------
def run_full_eda(
    X_train: pd.DataFrame, y_train: pd.Series, meta_train: pd.DataFrame,
    X_test: pd.DataFrame, y_test: pd.Series,
    y_val: Optional[pd.Series] = None,
) -> List[Path]:
    figures = []
    figures.append(plot_class_distribution(y_train, y_test, y_val))
    figures.append(plot_correlation_heatmap(X_train))
    figures.append(plot_sensor_trends(X_train, meta_train, y_train))
    figures.append(plot_pca(X_train, y_train))
    figures.append(plot_feature_variance(X_train))
    return figures
