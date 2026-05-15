"""
Fault 5 Run 78 vs Normal Run 1 — all XMEAS / XMV traces (tep_test.csv).

Outputs PNG figures under outputs/figures/fault5/ with the same dark theme as
visualize_fault5_runs.py.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "tep_test.csv"
OUT_DIR = PROJECT_ROOT / "outputs" / "figures" / "fault5"

FAULT_ID = 5
FAULT_RUN = 78
NORMAL_FAULT = 0
NORMAL_RUN = 1
FAULT_ONSET_SAMPLE = 161
SAMPLE_MINUTES = 3
ROLL_WINDOW = 10
FIG_FACE = "#0f172a"
COLOR_NORMAL = "#22d3ee"
COLOR_FAULT = "#f43f5e"
COLOR_ONSET = "#f97316"

HIGHLIGHT_SENSORS: list[tuple[str, str, str]] = [
    ("xmeas_22", "XMEAS_22 — compressor CW outlet temperature", "08_xmeas_22_run78_vs_normal.png"),
    ("xmeas_11", "XMEAS_11 — reactor feed flow", "09_xmeas_11_run78_vs_normal.png"),
    ("xmv_11", "XMV_11 — condenser CW flow", "10_xmv_11_run78_vs_normal.png"),
]


def load_run(fault_number: int, simulation_run: int) -> pd.DataFrame:
    chunks: list[pd.DataFrame] = []
    for ch in pd.read_csv(DATA_PATH, chunksize=400_000):
        m = (ch["faultNumber"] == fault_number) & (ch["simulationRun"] == simulation_run)
        if m.any():
            chunks.append(ch.loc[m])
    if not chunks:
        raise RuntimeError(
            f"No rows for faultNumber={fault_number}, simulationRun={simulation_run} in {DATA_PATH}"
        )
    return pd.concat(chunks, ignore_index=True).sort_values("sample").reset_index(drop=True)


def shade_onset_time(ax: plt.Axes, t_max: float) -> None:
    onset_t = FAULT_ONSET_SAMPLE * SAMPLE_MINUTES
    t0 = SAMPLE_MINUTES
    ax.axvline(onset_t, color=COLOR_ONSET, linestyle="--", linewidth=0.8, alpha=0.7)
    ax.axvspan(t0, onset_t - SAMPLE_MINUTES * 0.5, color=COLOR_NORMAL, alpha=0.06)
    ax.axvspan(onset_t, t_max, color=COLOR_FAULT, alpha=0.06)


def plot_variable_grid(
    *,
    cols: list[str],
    time_fault: np.ndarray,
    time_normal: np.ndarray,
    fault_df: pd.DataFrame,
    normal_df: pd.DataFrame,
    ncols: int,
    figsize_width: float,
    row_height: float,
    suptitle: str,
    title_fontsize: float,
    label_fontsize: float,
    tick_fontsize: float,
    out_path: Path,
) -> None:
    n = len(cols)
    nrows = int(np.ceil(n / ncols))
    fig, axes = plt.subplots(nrows, ncols, figsize=(figsize_width, nrows * row_height))
    fig.patch.set_facecolor(FIG_FACE)
    fig.suptitle(suptitle, fontsize=14, fontweight="bold", color="#e2e8f0")
    axes_flat = np.atleast_1d(axes).flatten()
    t_max = float(max(time_fault.max(), time_normal.max()))

    for i, col in enumerate(cols):
        ax = axes_flat[i]
        ax.set_facecolor(FIG_FACE)
        nf = normal_df[col].rolling(ROLL_WINDOW, min_periods=1).mean()
        ff = fault_df[col].rolling(ROLL_WINDOW, min_periods=1).mean()
        ax.plot(time_normal, nf, color=COLOR_NORMAL, linewidth=1, alpha=0.8, label="Normal")
        ax.plot(time_fault, ff, color=COLOR_FAULT, linewidth=1, alpha=0.8, label="Fault 5")
        shade_onset_time(ax, t_max)
        ax.set_title(col, fontsize=title_fontsize, fontweight="bold", color="#e2e8f0")
        ax.set_xlabel("Time (min)", fontsize=label_fontsize, color="#94a3b8")
        ax.tick_params(labelsize=tick_fontsize, colors="#94a3b8")
        for spine in ax.spines.values():
            spine.set_color("#334155")
        ax.grid(True, alpha=0.2, color="#475569")

    for j in range(i + 1, len(axes_flat)):
        axes_flat[j].set_visible(False)

    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(out_path, dpi=150, facecolor=FIG_FACE)
    plt.close(fig)
    print(f"Wrote {out_path}")


def plot_single_variable(
    *,
    col: str,
    subtitle: str,
    time_fault: np.ndarray,
    time_normal: np.ndarray,
    fault_df: pd.DataFrame,
    normal_df: pd.DataFrame,
    out_path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor(FIG_FACE)
    ax.set_facecolor(FIG_FACE)
    t_max = float(max(time_fault.max(), time_normal.max()))

    nf = normal_df[col].rolling(ROLL_WINDOW, min_periods=1).mean()
    ff = fault_df[col].rolling(ROLL_WINDOW, min_periods=1).mean()
    ax.plot(time_normal, nf, color=COLOR_NORMAL, linewidth=1.8, alpha=0.9, label=f"Normal (Run {NORMAL_RUN})")
    ax.plot(time_fault, ff, color=COLOR_FAULT, linewidth=1.8, alpha=0.9, label=f"Fault 5 (Run {FAULT_RUN})")
    shade_onset_time(ax, t_max)

    ax.set_title(
        f"Fault 5 Run 78 vs Normal — {subtitle}\n"
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


def deviation_summary(
    fault_df: pd.DataFrame,
    normal_df: pd.DataFrame,
    cols: list[str],
) -> pd.DataFrame:
    rows: list[dict[str, float | str]] = []
    post = fault_df.iloc[FAULT_ONSET_SAMPLE - 1 :]
    for col in cols:
        normal_mean = float(normal_df[col].mean())
        fault_mean = float(post[col].mean())
        if normal_mean != 0:
            pct_dev = (fault_mean - normal_mean) / abs(normal_mean) * 100
        else:
            pct_dev = 0.0
        rows.append(
            {
                "variable": col,
                "normal_mean": normal_mean,
                "fault_mean": fault_mean,
                "pct_deviation": pct_dev,
            }
        )
    return pd.DataFrame(rows).sort_values("pct_deviation", key=abs, ascending=False)


def main() -> None:
    plt.style.use("dark_background")

    print(f"Loading runs from {DATA_PATH}...")
    fault5_r78 = load_run(FAULT_ID, FAULT_RUN)
    normal_r1 = load_run(NORMAL_FAULT, NORMAL_RUN)

    time = fault5_r78["sample"].to_numpy(dtype=float) * SAMPLE_MINUTES
    time_nf = normal_r1["sample"].to_numpy(dtype=float) * SAMPLE_MINUTES

    xmeas_cols = [c for c in fault5_r78.columns if c.startswith("xmeas_")]
    xmv_cols = [c for c in fault5_r78.columns if c.startswith("xmv_")]

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    plot_variable_grid(
        cols=xmeas_cols,
        time_fault=time,
        time_normal=time_nf,
        fault_df=fault5_r78,
        normal_df=normal_r1,
        ncols=6,
        figsize_width=24,
        row_height=3,
        suptitle=(
            "Fault 5 Run 78 vs Normal — All XMEAS Variables\n"
            f"Cyan = Normal (Run {NORMAL_RUN}) | Red = Fault 5 (Run {FAULT_RUN}) · "
            f"{ROLL_WINDOW}-sample rolling mean"
        ),
        title_fontsize=8,
        label_fontsize=6,
        tick_fontsize=6,
        out_path=OUT_DIR / "06_xmeas_all_run78_vs_normal.png",
    )

    plot_variable_grid(
        cols=xmv_cols,
        time_fault=time,
        time_normal=time_nf,
        fault_df=fault5_r78,
        normal_df=normal_r1,
        ncols=4,
        figsize_width=18,
        row_height=3,
        suptitle=(
            "Fault 5 Run 78 vs Normal — All XMV Variables (PID Outputs)\n"
            f"Cyan = Normal (Run {NORMAL_RUN}) | Red = Fault 5 (Run {FAULT_RUN}) · "
            f"{ROLL_WINDOW}-sample rolling mean"
        ),
        title_fontsize=9,
        label_fontsize=7,
        tick_fontsize=7,
        out_path=OUT_DIR / "07_xmv_all_run78_vs_normal.png",
    )

    for col, subtitle, filename in HIGHLIGHT_SENSORS:
        plot_single_variable(
            col=col,
            subtitle=subtitle,
            time_fault=time,
            time_normal=time_nf,
            fault_df=fault5_r78,
            normal_df=normal_r1,
            out_path=OUT_DIR / filename,
        )

    dev_df = deviation_summary(fault5_r78, normal_r1, xmeas_cols + xmv_cols)
    csv_path = OUT_DIR / "run78_vs_normal_deviations.csv"
    dev_df.to_csv(csv_path, index=False)
    print(f"Wrote {csv_path}")

    print("\n" + "=" * 55)
    print("VARIABLES WITH LARGEST DEVIATION FROM NORMAL")
    print(f"(after fault injection — samples {FAULT_ONSET_SAMPLE} onwards)")
    print("=" * 55)
    print(dev_df.head(15).to_string(index=False))
    print(f"\nDone — open folder: {OUT_DIR}")


if __name__ == "__main__":
    main()
