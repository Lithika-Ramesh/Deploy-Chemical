"""
Export Fault 13 / simulationRun 1 from tep_test.csv with real model scores
for the dashboard demo.

Uses the same rolling-feature contract as notebooks/04a_Binary_Classifier.ipynb:
run_key grouping, windows [10,20,30,50,100], column names *_roll_mean_* / *_roll_std_*.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "tep_test.csv"
OUT_PATH = PROJECT_ROOT / "dashboard" / "public" / "data" / "fault13_replay.json"

ROLLING_WINDOWS = [10, 20, 30, 50, 100]
BINARY_THRESHOLD = 0.35

# Repo-local champion paths (override with env if needed)
DEFAULT_BINARY = PROJECT_ROOT / "binary_champion_xgboost_balanced_50_50.joblib"
DEFAULT_MULTICLASS = PROJECT_ROOT / "multiclass_hist_gradient_boosting_w10_20_30_50_100.joblib"


def add_run_key(df: pd.DataFrame, source_name: str, fault_col: str) -> pd.DataFrame:
    df = df.copy()
    df["source_file"] = source_name
    df["run_key"] = (
        df["source_file"].astype(str)
        + "_fault_"
        + df[fault_col].astype(str)
        + "_run_"
        + df["simulationRun"].astype(str)
    )
    return df


def add_rolling_features_by_run(
    df: pd.DataFrame,
    base_feature_cols: list[str],
    windows: list[int],
    run_col: str = "run_key",
    time_col: str = "sample",
    min_periods: int = 1,
) -> pd.DataFrame:
    for col in [run_col, *base_feature_cols]:
        if col not in df.columns:
            raise KeyError(f"Required column missing: {col}")
    df_out = df.copy()
    df_out = df_out.sort_values([run_col, time_col]).reset_index(drop=True)
    grouped = df_out.groupby(run_col, sort=False)
    new_cols = []
    for window in windows:
        roll_mean = (
            grouped[base_feature_cols]
            .rolling(window=window, min_periods=min_periods)
            .mean()
            .reset_index(level=0, drop=True)
        )
        roll_mean.columns = [f"{c}_roll_mean_{window}" for c in base_feature_cols]
        new_cols.append(roll_mean.astype("float32"))
        roll_std = (
            grouped[base_feature_cols]
            .rolling(window=window, min_periods=min_periods)
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


def main() -> None:
    import os

    binary_path = Path(os.environ.get("BINARY_MODEL_PATH", DEFAULT_BINARY))
    multi_path = Path(os.environ.get("MULTICLASS_MODEL_PATH", DEFAULT_MULTICLASS))

    test_full = pd.read_csv(DATA_PATH)
    if "faultNumber" in test_full.columns:
        fault_col = "faultNumber"
    elif "label" in test_full.columns:
        fault_col = "label"
    else:
        raise KeyError("Expected 'faultNumber' or 'label' in tep_test.csv")

    base_features = [
        c for c in test_full.columns if c.startswith("xmeas_") or c.startswith("xmv_")
    ]
    model_cols = get_model_feature_cols(base_features, ROLLING_WINDOWS)

    fault13 = test_full[
        (test_full[fault_col] == 13) & (test_full["simulationRun"] == 1)
    ].copy()
    fault13 = fault13.sort_values("sample").reset_index(drop=True)
    if len(fault13) == 0:
        raise RuntimeError("No rows for label==13 and simulationRun==1")

    fault13 = add_run_key(fault13, "TEP_Test", fault_col)
    fault13_fe = add_rolling_features_by_run(fault13, base_features, ROLLING_WINDOWS)

    missing = [c for c in model_cols if c not in fault13_fe.columns]
    if missing:
        raise KeyError(f"Missing engineered columns: {missing[:5]}… ({len(missing)} total)")

    X = fault13_fe[model_cols].to_numpy(dtype=np.float32)

    binary_model = joblib.load(binary_path)
    multi_model = joblib.load(multi_path)

    p_fault = binary_model.predict_proba(X)[:, 1].astype(float)
    health_score = ((1.0 - p_fault) * 100.0).astype(float)
    is_fault = (p_fault >= BINARY_THRESHOLD).astype(int)
    fault_type = multi_model.predict(X).astype(int)

    first_alert_idx = int(np.argmax(is_fault)) if is_fault.max() > 0 else -1
    first_alert_sample = (
        int(fault13["sample"].iloc[first_alert_idx]) if first_alert_idx >= 0 else None
    )

    output = {
        "generated_at": pd.Timestamp.now("UTC").strftime("%Y-%m-%d"),
        "binary_threshold": BINARY_THRESHOLD,
        "binary_model": binary_path.name,
        "multiclass_model": multi_path.name,
        "samples": fault13["sample"].astype(int).tolist(),
        "p_fault": p_fault.tolist(),
        "health_score": health_score.tolist(),
        "is_fault": is_fault.tolist(),
        "fault_type": fault_type.tolist(),
        "xmeas_9": fault13["xmeas_9"].astype(float).tolist(),
        "xmv_10": fault13["xmv_10"].astype(float).tolist(),
        "xmeas_22": fault13["xmeas_22"].astype(float).tolist(),
        "xmv_11": fault13["xmv_11"].astype(float).tolist(),
        "meta": {
            "n_rows": len(fault13),
            "first_alert_sample": first_alert_sample,
            "max_p_fault": float(p_fault.max()),
            "min_health_score": float(health_score.min()),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f)

    print(f"Wrote {OUT_PATH} ({len(fault13)} samples)")
    print(
        f"first_alert_sample={first_alert_sample} max_p_fault={p_fault.max():.4f} "
        f"min_health={health_score.min():.2f}%"
    )


if __name__ == "__main__":
    main()
