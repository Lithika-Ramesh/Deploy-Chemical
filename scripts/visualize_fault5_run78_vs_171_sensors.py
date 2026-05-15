"""
Fault 5 Run 78 vs Run 171 — XMEAS_13, XMV_11, and P(fault) (tep_test.csv).

Clean hero (78) vs pre-fault nuisance alarms (171). Outputs PNGs under
outputs/figures/fault5/ with the same dark theme as visualize_fault5_runs.py.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "tep_test.csv"
OUT_DIR = PROJECT_ROOT / "outputs" / "figures" / "fault5"

FAULT_ID = 5
RUN_CLEAN = 78
RUN_NOISY = 171
FAULT_ONSET_SAMPLE = 161
SAMPLE_MINUTES = 3
ROLL_WINDOW = 10
FIG_FACE = "#0f172a"
COLOR_CLEAN = "#22d3ee"
COLOR_NOISY = "#f43f5e"
COLOR_ONSET = "#f97316"

SENSORS: list[tuple[str, str, str]] = [
    ("xmeas_13", "XMEAS_13 — separator pressure", "11_xmeas_13_run78_vs_171.png"),
    ("xmv_11", "XMV_11 — condenser CW flow", "12_xmv_11_run78_vs_171.png"),
]

P_FAULT_OUT = "13_p_fault_run78_vs_171.png"


def _viz_fault5_module():
    path = PROJECT_ROOT / "scripts" / "visualize_fault5_runs.py"
    spec = importlib.util.spec_from_file_location("viz_fault5_runs", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_run(simulation_run: int) -> pd.DataFrame:
    chunks: list[pd.DataFrame] = []
    for ch in pd.read_csv(DATA_PATH, chunksize=400_000):
        m = (ch["faultNumber"] == FAULT_ID) & (ch["simulationRun"] == simulation_run)
        if m.any():
            chunks.append(ch.loc[m])
    if not chunks:
        raise RuntimeError(
            f"No Fault {FAULT_ID} rows for simulationRun={simulation_run} in {DATA_PATH}"
        )
    return pd.concat(chunks, ignore_index=True).sort_values("sample").reset_index(drop=True)


def shade_onset_time(ax: plt.Axes, t_max: float) -> None:
    onset_t = FAULT_ONSET_SAMPLE * SAMPLE_MINUTES
    t0 = SAMPLE_MINUTES
    ax.axvline(onset_t, color=COLOR_ONSET, linestyle="--", linewidth=0.8, alpha=0.7)
    ax.axvspan(t0, onset_t - SAMPLE_MINUTES * 0.5, color=COLOR_CLEAN, alpha=0.06)
    ax.axvspan(onset_t, t_max, color=COLOR_NOISY, alpha=0.06)


def plot_run_pair(
    *,
    col: str,
    subtitle: str,
    time_clean: np.ndarray,
    time_noisy: np.ndarray,
    clean_df: pd.DataFrame,
    noisy_df: pd.DataFrame,
    out_path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor(FIG_FACE)
    ax.set_facecolor(FIG_FACE)
    t_max = float(max(time_clean.max(), time_noisy.max()))

    y_clean = clean_df[col].rolling(ROLL_WINDOW, min_periods=1).mean()
    y_noisy = noisy_df[col].rolling(ROLL_WINDOW, min_periods=1).mean()
    ax.plot(
        time_clean,
        y_clean,
        color=COLOR_CLEAN,
        linewidth=1.8,
        alpha=0.9,
        label=f"Run {RUN_CLEAN} — clean hero",
    )
    ax.plot(
        time_noisy,
        y_noisy,
        color=COLOR_NOISY,
        linewidth=1.8,
        alpha=0.9,
        label=f"Run {RUN_NOISY} — nuisance pre-fault alarms",
    )
    shade_onset_time(ax, t_max)

    ax.set_title(
        f"Fault 5 Run {RUN_CLEAN} vs {RUN_NOISY} — {subtitle}\n"
        f"{ROLL_WINDOW}-sample rolling mean · injection at sample {FAULT_ONSET_SAMPLE}",
        fontsize=12,
        fontweight="bold",
        color="#e2e8f0",
    )
    ax.set_xlabel("Time (min)", fontsize=10, color="#94a3b8")
    ax.set_ylabel(col, fontsize=10, color="#94a3b8")
    ax.tick_params(labelsize=9, colors="#94a3b8")
    for spine in ax.spines.values():
        spine.set_color("#334155")
    ax.grid(True, alpha=0.25, color="#475569")
    ax.legend(fontsize=9, framealpha=0.9, loc="best")

    fig.tight_layout()
    fig.savefig(out_path, dpi=150, facecolor=FIG_FACE)
    plt.close(fig)
    print(f"Wrote {out_path}")


def plot_p_fault_pair(
    *,
    clean_df: pd.DataFrame,
    noisy_df: pd.DataFrame,
    threshold: float,
    out_path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor(FIG_FACE)
    ax.set_facecolor(FIG_FACE)

    t_clean = clean_df["sample"].to_numpy(dtype=float) * SAMPLE_MINUTES
    t_noisy = noisy_df["sample"].to_numpy(dtype=float) * SAMPLE_MINUTES
    t_max = float(max(t_clean.max(), t_noisy.max()))

    ax.plot(
        t_clean,
        clean_df["p_fault"].to_numpy(),
        color=COLOR_CLEAN,
        linewidth=1.8,
        alpha=0.9,
        label=f"Run {RUN_CLEAN} — clean hero",
    )
    ax.plot(
        t_noisy,
        noisy_df["p_fault"].to_numpy(),
        color=COLOR_NOISY,
        linewidth=1.8,
        alpha=0.9,
        label=f"Run {RUN_NOISY} — nuisance pre-fault alarms",
    )
    ax.axhline(threshold, color="#94a3b8", linestyle=":", linewidth=1, label=f"Threshold {threshold}")
    shade_onset_time(ax, t_max)

    ax.set_title(
        f"Fault 5 Run {RUN_CLEAN} vs {RUN_NOISY} — P(fault) champion binary\n"
        f"tep_test.csv · injection at sample {FAULT_ONSET_SAMPLE}",
        fontsize=12,
        fontweight="bold",
        color="#e2e8f0",
    )
    ax.set_xlabel("Time (min)", fontsize=10, color="#94a3b8")
    ax.set_ylabel("P(fault)", fontsize=10, color="#94a3b8")
    ax.set_ylim(-0.02, 1.05)
    ax.tick_params(labelsize=9, colors="#94a3b8")
    for spine in ax.spines.values():
        spine.set_color("#334155")
    ax.grid(True, alpha=0.25, color="#475569")
    ax.legend(fontsize=9, framealpha=0.9, loc="best")

    fig.tight_layout()
    fig.savefig(out_path, dpi=150, facecolor=FIG_FACE)
    plt.close(fig)
    print(f"Wrote {out_path}")


def main() -> None:
    plt.style.use("dark_background")

    print(f"Loading Fault {FAULT_ID} runs {RUN_CLEAN} and {RUN_NOISY} from {DATA_PATH}...")
    clean = load_run(RUN_CLEAN)
    noisy = load_run(RUN_NOISY)

    time_clean = clean["sample"].to_numpy(dtype=float) * SAMPLE_MINUTES
    time_noisy = noisy["sample"].to_numpy(dtype=float) * SAMPLE_MINUTES

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for col, subtitle, filename in SENSORS:
        plot_run_pair(
            col=col,
            subtitle=subtitle,
            time_clean=time_clean,
            time_noisy=time_noisy,
            clean_df=clean,
            noisy_df=noisy,
            out_path=OUT_DIR / filename,
        )

    viz = _viz_fault5_module()
    print("Scoring runs with champion binary model...")
    fe = viz.score_runs(pd.concat([clean, noisy], ignore_index=True))
    g_clean = fe[fe["simulationRun"] == RUN_CLEAN].sort_values("sample")
    g_noisy = fe[fe["simulationRun"] == RUN_NOISY].sort_values("sample")
    plot_p_fault_pair(
        clean_df=g_clean,
        noisy_df=g_noisy,
        threshold=viz.BINARY_THRESHOLD,
        out_path=OUT_DIR / P_FAULT_OUT,
    )

    print(f"\nDone — open folder: {OUT_DIR}")


if __name__ == "__main__":
    main()
