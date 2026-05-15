"""
Visualize curated Fault 5 / tep_test.csv simulation runs (real data + champion models).

Outputs PNG figures under outputs/figures/fault5/
"""
from __future__ import annotations

import os
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "tep_test.csv"
OUT_DIR = PROJECT_ROOT / "outputs" / "figures" / "fault5"
BINARY_PATH = Path(os.environ.get("BINARY_MODEL_PATH", PROJECT_ROOT / "binary_champion_xgboost_balanced_50_50.joblib"))
MULTI_PATH = Path(os.environ.get("MULTICLASS_MODEL_PATH", PROJECT_ROOT / "multiclass_hist_gradient_boosting_w10_20_30_50_100.joblib"))

ROLLING_WINDOWS = [10, 20, 30, 50, 100]
BINARY_THRESHOLD = 0.35
FAULT_ONSET = 161
FAULT_ID = 5

# run, short label for plots
CURATED_RUNS: list[tuple[int, str]] = [
    (78, "Run 78 — clean hero"),
    (171, "Run 171 — pre-fault nuisance alarms"),
    (148, "Run 148 — strong separator step (−)"),
    (429, "Run 429 — strong separator step (+)"),
    (377, "Run 377 — subtle step, strong AI"),
]


def add_run_key(df: pd.DataFrame, source_name: str, fault_col: str) -> pd.DataFrame:
    df = df.copy()
    df["run_key"] = (
        f"{source_name}_fault_"
        + df[fault_col].astype(str)
        + "_run_"
        + df["simulationRun"].astype(str)
    )
    return df


def add_rolling_features_by_run(
    df: pd.DataFrame,
    base_feature_cols: list[str],
    windows: list[int],
) -> pd.DataFrame:
    df_out = df.sort_values(["run_key", "sample"]).reset_index(drop=True)
    grouped = df_out.groupby("run_key", sort=False)
    new_cols = []
    for window in windows:
        roll_mean = (
            grouped[base_feature_cols]
            .rolling(window=window, min_periods=1)
            .mean()
            .reset_index(level=0, drop=True)
        )
        roll_mean.columns = [f"{c}_roll_mean_{window}" for c in base_feature_cols]
        new_cols.append(roll_mean.astype("float32"))
        roll_std = (
            grouped[base_feature_cols]
            .rolling(window=window, min_periods=1)
            .std()
            .reset_index(level=0, drop=True)
            .fillna(0.0)
        )
        roll_std.columns = [f"{c}_roll_std_{window}" for c in base_feature_cols]
        new_cols.append(roll_std.astype("float32"))
    return pd.concat([df_out, *new_cols], axis=1)


def get_model_feature_cols(base_feature_cols: list[str], windows: list[int]) -> list[str]:
    rolling_cols: list[str] = []
    for window in windows:
        for col in base_feature_cols:
            rolling_cols.append(f"{col}_roll_mean_{window}")
            rolling_cols.append(f"{col}_roll_std_{window}")
    return list(base_feature_cols) + rolling_cols


def load_fault5_runs(run_ids: list[int]) -> pd.DataFrame:
    chunks: list[pd.DataFrame] = []
    usecols = None
    for ch in pd.read_csv(DATA_PATH, chunksize=400_000):
        m = (ch["faultNumber"] == FAULT_ID) & (ch["simulationRun"].isin(run_ids))
        if m.any():
            chunks.append(ch.loc[m])
    if not chunks:
        raise RuntimeError(f"No fault {FAULT_ID} rows for runs {run_ids}")
    return pd.concat(chunks, ignore_index=True)


def score_runs(df: pd.DataFrame) -> pd.DataFrame:
    base_features = [c for c in df.columns if c.startswith("xmeas_") or c.startswith("xmv_")]
    model_cols = get_model_feature_cols(base_features, ROLLING_WINDOWS)
    df = add_run_key(df, "TEP_Test", "faultNumber")
    fe = add_rolling_features_by_run(df, base_features, ROLLING_WINDOWS)
    X = fe[model_cols].to_numpy(dtype=np.float32)
    binary_model = joblib.load(BINARY_PATH)
    multi_model = joblib.load(MULTI_PATH)
    fe["p_fault"] = binary_model.predict_proba(X)[:, 1]
    fe["fault_type_pred"] = multi_model.predict(X)
    fe["is_fault"] = (fe["p_fault"] >= BINARY_THRESHOLD).astype(int)
    fe["health_score"] = (1.0 - fe["p_fault"]) * 100.0
    return fe


def run_metrics(g: pd.DataFrame) -> dict[str, float | int | None]:
    g = g.sort_values("sample")
    pre = g[g["sample"] < FAULT_ONSET]
    post = g[g["sample"] >= FAULT_ONSET]
    pre_fa = int(pre["is_fault"].sum())
    alert = g[g["is_fault"] == 1]
    first_alert = int(alert["sample"].iloc[0]) if len(alert) else None
    delay = (first_alert - FAULT_ONSET) if first_alert is not None else None
    mc = float((alert["fault_type_pred"] == FAULT_ID).mean() * 100) if len(alert) else 0.0
    return {
        "pre_false_alarms": pre_fa,
        "first_alert": first_alert,
        "delay": delay,
        "max_p_fault": float(g["p_fault"].max()),
        "multiclass_pct": mc,
        "xmeas_13_delta": float(post["xmeas_13"].mean() - pre["xmeas_13"].mean()),
    }


def shade_onset(ax: plt.Axes) -> None:
    ax.axvline(FAULT_ONSET, color="#f97316", linestyle="--", linewidth=1.2, alpha=0.85)
    ax.axvspan(1, FAULT_ONSET - 0.5, color="#22d3ee", alpha=0.06)
    ax.axvspan(FAULT_ONSET, 960, color="#ef4444", alpha=0.06)


def plot_pf_fault_panel(fe: pd.DataFrame, out_path: Path) -> None:
    n = len(CURATED_RUNS)
    fig, axes = plt.subplots(n, 1, figsize=(12, 2.6 * n), sharex=True)
    if n == 1:
        axes = [axes]
    fig.suptitle(
        f"Fault 5 (condenser CW inlet T step) — P(fault) from tep_test.csv + champion binary\n"
        f"Threshold {BINARY_THRESHOLD} · injection sample {FAULT_ONSET}",
        fontsize=11,
        fontweight="bold",
        y=0.995,
    )
    for ax, (run_id, label) in zip(axes, CURATED_RUNS):
        g = fe[fe["simulationRun"] == run_id].sort_values("sample")
        s = g["sample"].to_numpy()
        p = g["p_fault"].to_numpy()
        ax.fill_between(s, 0, p, color="#fb923c", alpha=0.25)
        ax.plot(s, p, color="#f97316", linewidth=1.2)
        ax.axhline(BINARY_THRESHOLD, color="#94a3b8", linestyle=":", linewidth=1)
        pre_mask = s < FAULT_ONSET
        if (g.loc[pre_mask, "is_fault"] == 1).any():
            fa_s = s[pre_mask][g.loc[pre_mask, "is_fault"].to_numpy() == 1]
            ax.scatter(fa_s, p[pre_mask][g.loc[pre_mask, "is_fault"].to_numpy() == 1],
                       s=8, c="#f43f5e", zorder=5, label="pre-fault alert")
        shade_onset(ax)
        m = run_metrics(g)
        ax.set_ylabel("P(fault)")
        ax.set_title(
            f"{label} · pre-FA={m['pre_false_alarms']} · 1st alert={m['first_alert']} · "
            f"IDV(5)={m['multiclass_pct']:.0f}%",
            fontsize=9,
            loc="left",
        )
        ax.set_ylim(-0.02, 1.05)
        ax.grid(True, alpha=0.25)
    axes[-1].set_xlabel("Sample (tep_test)")
    handles = [
        mpatches.Patch(color="#22d3ee", alpha=0.2, label="Pre-fault (nominal period)"),
        mpatches.Patch(color="#ef4444", alpha=0.2, label="Post-injection"),
        plt.Line2D([0], [0], color="#f97316", linestyle="--", label=f"Injection n={FAULT_ONSET}"),
    ]
    fig.legend(handles=handles, loc="upper right", fontsize=8, framealpha=0.9)
    fig.tight_layout(rect=[0, 0, 1, 0.98])
    fig.savefig(out_path, dpi=150, facecolor="#0f172a")
    plt.close(fig)


def plot_sensors_grid(fe: pd.DataFrame, out_path: Path) -> None:
    sensors = [
        ("xmeas_13", "XMEAS_13 — separator pressure"),
        ("xmv_11", "XMV_11 — condenser CW flow"),
        ("xmeas_22", "XMEAS_22 — comp. CW outlet temp"),
        ("xmeas_9", "XMEAS_9 — reactor temperature"),
    ]
    n_runs = len(CURATED_RUNS)
    fig, axes = plt.subplots(len(sensors), n_runs, figsize=(3.2 * n_runs, 2.4 * len(sensors)), sharex=True)
    fig.suptitle(
        "Fault 5 — raw tep_test.csv sensor traces (curated runs)",
        fontsize=11,
        fontweight="bold",
    )
    colors = ["#22d3ee", "#f43f5e", "#a78bfa", "#34d399", "#fbbf24"]
    for col_idx, (col, ylabel) in enumerate(sensors):
        for row_idx, (run_id, label) in enumerate(CURATED_RUNS):
            ax = axes[col_idx, row_idx]
            g = fe[fe["simulationRun"] == run_id].sort_values("sample")
            ax.plot(g["sample"], g[col], color=colors[row_idx], linewidth=1)
            shade_onset(ax)
            if col_idx == 0:
                ax.set_title(label.split("—")[0].strip(), fontsize=8)
            if row_idx == 0:
                ax.set_ylabel(ylabel, fontsize=7)
            ax.grid(True, alpha=0.2)
            if col_idx == len(sensors) - 1:
                ax.set_xlabel("Sample")
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(out_path, dpi=150, facecolor="#0f172a")
    plt.close(fig)


def plot_compare_clean_vs_noisy(fe: pd.DataFrame, out_path: Path) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(12, 7))
    fig.suptitle("Clean vs nuisance-alarm run (tep_test.csv only)", fontsize=11, fontweight="bold")
    pairs = [(78, 171), (78, 171)]
    for ax, (col, title) in zip(axes.flat, [
        ("p_fault", "P(fault) — Run 78 vs 171"),
        ("xmeas_13", "XMEAS_13 — separator pressure"),
        ("xmv_11", "XMV_11 — condenser CW"),
        ("health_score", "Health score (1 − P(fault)) × 100"),
    ]):
        for run_id, c, lw in [(78, "#22d3ee", 1.8), (171, "#f43f5e", 1.2)]:
            g = fe[fe["simulationRun"] == run_id].sort_values("sample")
            ax.plot(g["sample"], g[col], label=f"Run {run_id}", color=c, linewidth=lw)
        if col == "p_fault":
            ax.axhline(BINARY_THRESHOLD, color="#94a3b8", linestyle=":", linewidth=1)
        shade_onset(ax)
        ax.set_title(title, fontsize=9)
        ax.set_xlabel("Sample")
        ax.grid(True, alpha=0.25)
        ax.legend(fontsize=8)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(out_path, dpi=150, facecolor="#0f172a")
    plt.close(fig)


def plot_metrics_bars(fe: pd.DataFrame, out_path: Path) -> None:
    rows = []
    for run_id, label in CURATED_RUNS:
        g = fe[fe["simulationRun"] == run_id]
        m = run_metrics(g)
        m["run"] = run_id
        m["label"] = label.split("—")[0].strip()
        rows.append(m)
    M = pd.DataFrame(rows)
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    fig.suptitle("Run comparison — metrics from real CSV + models", fontsize=11, fontweight="bold")
    x = np.arange(len(M))
    axes[0].bar(x, M["pre_false_alarms"], color="#f43f5e", edgecolor="white")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(M["label"], rotation=25, ha="right", fontsize=7)
    axes[0].set_ylabel("Count")
    axes[0].set_title("Pre-fault false alarms (samples 1–160)")
    axes[1].bar(x, M["delay"].fillna(0), color="#fbbf24", edgecolor="white")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(M["label"], rotation=25, ha="right", fontsize=7)
    axes[1].set_ylabel("Samples after onset")
    axes[1].set_title("Detection delay (1st alert − 161)")
    axes[2].bar(x, M["xmeas_13_delta"], color="#22d3ee", edgecolor="white")
    axes[2].set_xticks(x)
    axes[2].set_xticklabels(M["label"], rotation=25, ha="right", fontsize=7)
    axes[2].set_ylabel("Δ mean (post − pre)")
    axes[2].set_title("XMEAS_13 step magnitude")
    axes[2].axhline(0, color="#64748b", linewidth=0.8)
    for ax in axes:
        ax.grid(True, axis="y", alpha=0.25)
    fig.tight_layout(rect=[0, 0, 1, 0.94])
    fig.savefig(out_path, dpi=150, facecolor="#0f172a")
    plt.close(fig)


def plot_onset_zoom(fe: pd.DataFrame, out_path: Path) -> None:
    fig, axes = plt.subplots(len(CURATED_RUNS), 1, figsize=(12, 2.2 * len(CURATED_RUNS)), sharex=True)
    lo, hi = FAULT_ONSET - 25, FAULT_ONSET + 80
    fig.suptitle(f"Zoom: samples {lo}–{hi} around fault injection", fontsize=11, fontweight="bold")
    for ax, (run_id, label) in zip(axes, CURATED_RUNS):
        g = fe[(fe["simulationRun"] == run_id) & (fe["sample"].between(lo, hi))].sort_values("sample")
        ax2 = ax.twinx()
        ax.plot(g["sample"], g["xmeas_13"], color="#22d3ee", linewidth=1.5, label="XMEAS_13")
        ax2.plot(g["sample"], g["p_fault"], color="#fb923c", linewidth=1.2, alpha=0.9, label="P(fault)")
        ax2.axhline(BINARY_THRESHOLD, color="#94a3b8", linestyle=":", linewidth=1)
        ax.axvline(FAULT_ONSET, color="#f97316", linestyle="--", linewidth=1)
        ax.set_ylabel("XMEAS_13", color="#22d3ee")
        ax2.set_ylabel("P(fault)", color="#fb923c")
        ax.set_title(label, fontsize=9, loc="left")
        ax.grid(True, alpha=0.25)
    axes[-1].set_xlabel("Sample")
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(out_path, dpi=150, facecolor="#0f172a")
    plt.close(fig)


def write_summary_csv(fe: pd.DataFrame, out_path: Path) -> None:
    rows = []
    for run_id, label in CURATED_RUNS:
        g = fe[fe["simulationRun"] == run_id]
        m = run_metrics(g)
        m["simulationRun"] = run_id
        m["description"] = label
        rows.append(m)
    pd.DataFrame(rows).to_csv(out_path, index=False)


def main() -> None:
    plt.style.use("dark_background")
    run_ids = [r for r, _ in CURATED_RUNS]
    print(f"Loading fault {FAULT_ID} runs {run_ids} from {DATA_PATH}...")
    df = load_fault5_runs(run_ids)
    print(f"Scoring {len(df)} rows...")
    fe = score_runs(df)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    paths = {
        "01_p_fault_timeline.png": plot_pf_fault_panel,
        "02_sensors_grid.png": plot_sensors_grid,
        "03_clean_vs_run171.png": plot_compare_clean_vs_noisy,
        "04_metrics_bars.png": plot_metrics_bars,
        "05_onset_zoom.png": plot_onset_zoom,
    }
    for name, fn in paths.items():
        p = OUT_DIR / name
        print(f"Writing {p}")
        fn(fe, p)

    csv_path = OUT_DIR / "curated_run_metrics.csv"
    write_summary_csv(fe, csv_path)
    print(f"Wrote {csv_path}")
    print(f"Done — open folder: {OUT_DIR}")


if __name__ == "__main__":
    main()
