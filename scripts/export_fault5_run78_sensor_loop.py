"""Export Fault 5 / tep_test run 78 for dashboard Live plant sensors loop."""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "tep_test.csv"
OUT_PATH = (
    PROJECT_ROOT / "dashboard" / "public" / "data" / "sensor_loops" / "fault5_run78.json"
)
BINARY_PATH = PROJECT_ROOT / "binary_champion_xgboost_balanced_50_50.joblib"

RUN_ID = 78
FAULT_ID = 5
FAULT_ONSET_SAMPLE = 161
ROLLING_WINDOWS = [10, 20, 30, 50, 100]
BINARY_THRESHOLD = 0.35
LOOP_TICKS = 240


def load_run() -> pd.DataFrame:
    chunks: list[pd.DataFrame] = []
    for ch in pd.read_csv(DATA_PATH, chunksize=400_000):
        m = (ch["faultNumber"] == FAULT_ID) & (ch["simulationRun"] == RUN_ID)
        if m.any():
            chunks.append(ch.loc[m])
    if not chunks:
        raise RuntimeError(f"No fault {FAULT_ID} run {RUN_ID} in {DATA_PATH}")
    return pd.concat(chunks, ignore_index=True).sort_values("sample")


def score_p_fault(df: pd.DataFrame) -> list[float]:
    base_features = [
        c for c in df.columns if c.startswith("xmeas_") or c.startswith("xmv_")
    ]
    df = df.copy()
    df["run_key"] = f"TEP_Test_fault_{FAULT_ID}_run_{RUN_ID}"
    fe = df.sort_values(["run_key", "sample"]).reset_index(drop=True)
    grouped = fe.groupby("run_key", sort=False)
    for window in ROLLING_WINDOWS:
        roll_mean = (
            grouped[base_features]
            .rolling(window=window, min_periods=1)
            .mean()
            .reset_index(level=0, drop=True)
        )
        roll_mean.columns = [f"{c}_roll_mean_{window}" for c in base_features]
        fe = pd.concat([fe, roll_mean.astype("float32")], axis=1)
        roll_std = (
            grouped[base_features]
            .rolling(window=window, min_periods=1)
            .std()
            .reset_index(level=0, drop=True)
            .fillna(0.0)
        )
        roll_std.columns = [f"{c}_roll_std_{window}" for c in base_features]
        fe = pd.concat([fe, roll_std.astype("float32")], axis=1)
    model_cols: list[str] = list(base_features)
    for window in ROLLING_WINDOWS:
        for col in base_features:
            model_cols.append(f"{col}_roll_mean_{window}")
            model_cols.append(f"{col}_roll_std_{window}")
    X = fe[model_cols].to_numpy(dtype="float32")
    model = joblib.load(BINARY_PATH)
    return model.predict_proba(X)[:, 1].tolist()


def main() -> None:
    df = load_run()
    p_fault = score_p_fault(df)
    n = min(LOOP_TICKS, len(df))
    onset_idx = min(FAULT_ONSET_SAMPLE - 1, n - 1)

    payload = {
        "scenario": "fault5_run78",
        "label": "Fault 5 · tep_test run 78 (clean hero)",
        "duration_ticks": n,
        "fault_onset_tick": onset_idx,
        "sensors": {
            "separator_pressure": df["xmeas_13"].iloc[:n].round(4).tolist(),
            "condenser_cw_flow": df["xmv_11"].iloc[:n].round(6).tolist(),
            "comp_cw_outlet_temp": df["xmeas_22"].iloc[:n].round(4).tolist(),
        },
        "anomaly_score": [round(float(x), 4) for x in p_fault[:n]],
        "plain_fault_hint": "Condenser cooling water inlet temperature step (IDV-5)",
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    pre = payload["anomaly_score"][:onset_idx]
    pre_fa = sum(1 for x in pre if x >= BINARY_THRESHOLD)
    print(f"Wrote {OUT_PATH} ({n} ticks, onset index {onset_idx})")
    print(f"Pre-fault false alarms (P>={BINARY_THRESHOLD}): {pre_fa}")
    print(f"Max P(fault): {max(payload['anomaly_score']):.3f}")


if __name__ == "__main__":
    main()
