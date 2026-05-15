"""
Build dashboard/public/data/tep_notebook_dashboard.json from notebook outputs.

Reads (when present):
  - models/final/multiclass_comparison_artifacts.json  (04b)
  - models/final/binary_artifacts_*.json             (04a, picks balanced hist_gradient first)
  - outputs/multiclass_risk_timeseries_*.csv         (04b optional cell)
  - data/processed/tep_test.csv                      (merge xmeas for charts)

Run from repo root:
  python scripts/export_tep_notebook_dashboard.py

If artifacts are missing, the script still writes a seed bundle using the same
schema (metrics placeholders) so the Next.js app loads.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DASH_DATA = ROOT / "dashboard" / "public" / "data" / "tep_notebook_dashboard.json"
MODEL_DIR = ROOT / "models" / "final"
OUTPUT_DIR = ROOT / "outputs"
DATA_PROCESSED = ROOT / "data" / "processed" / "tep_test.csv"

# TEP-ish display channels (same columns used for all runs in export).
XMEAS_CHART = {
    "reactorTemp": "xmeas_9",
    "separatorPressure": "xmeas_13",
    "flowRate": "xmeas_2",
    "vibration": "xmeas_17",
}


def _find_project_root() -> Path:
    return ROOT


def _default_bundle_metrics() -> dict[str, Any]:
    """Fallback metrics aligned with checked-in 04b notebook output (validation/test table)."""
    return {
        "multiclass": {
            "champion": "hist_gradient_boosting",
            "comparison": [
                {
                    "model": "hist_gradient_boosting",
                    "split": "validation",
                    "train_time_s": 695.4,
                    "accuracy": 0.922115,
                    "macro_recall": 0.922115,
                    "macro_f1": 0.924249,
                    "weighted_f1": 0.924249,
                },
                {
                    "model": "xgboost",
                    "split": "validation",
                    "train_time_s": 960.0,
                    "accuracy": 0.920516,
                    "macro_recall": 0.920516,
                    "macro_f1": 0.922725,
                    "weighted_f1": 0.922725,
                },
                {
                    "model": "hist_gradient_boosting",
                    "split": "test",
                    "train_time_s": None,
                    "accuracy": 0.924881,
                    "macro_recall": 0.924881,
                    "macro_f1": 0.929302,
                    "weighted_f1": 0.929302,
                },
                {
                    "model": "xgboost",
                    "split": "test",
                    "train_time_s": None,
                    "accuracy": 0.923378,
                    "macro_recall": 0.923378,
                    "macro_f1": 0.927977,
                    "weighted_f1": 0.927977,
                },
            ],
            "featureCount": 572,
            "xmeasCount": 41,
        },
        "binary": {
            "defaultModelKey": "hist_gradient_boosting_balanced_50_50",
            "models": {
                "hist_gradient_boosting_balanced_50_50": {
                    "configLabel": "Balanced train/val · run-level split",
                    "auc": 0.982,
                    "threshold": 0.32,
                    "accuracy": 0.941,
                    "macroF1": 0.93,
                    "macroRecall": 0.91,
                },
                "xgboost_balanced_50_50": {
                    "configLabel": "Balanced train/val · run-level split",
                    "auc": 0.979,
                    "threshold": 0.35,
                    "accuracy": 0.938,
                    "macroF1": 0.928,
                    "macroRecall": 0.905,
                },
            },
        },
    }


def _fault_id_for_class(n: int) -> str | None:
    order = [
        "reactor_cooling",
        "feed_loss",
        "pressure_instability",
        "sensor_drift",
        "valve_failure",
        "separator_fault",
        "compressor_failure",
    ]
    if n <= 0:
        return None
    return order[(n - 1) % len(order)]


def _build_incidents_from_report(report: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    base = datetime(2026, 3, 1, tzinfo=timezone.utc)
    idx = 0
    for key, block in report.items():
        if not key.isdigit():
            continue
        if not isinstance(block, dict):
            continue
        rec = block.get("recall")
        if rec is None or float(rec) >= 0.88:
            continue
        idx += 1
        fid = _fault_id_for_class(int(key))
        sev = "HIGH" if float(rec) < 0.75 else "MEDIUM"
        out.append(
            {
                "id": f"nb-fault-{key}-{idx}",
                "ts": (base.replace(day=min(28, 1 + idx))).isoformat(),
                "severity": sev,
                "subsystem": "DCS / Analytics",
                "title": f"Holdout recall watch · TEP fault class {key}",
                "diagnosis": (
                    f"Multiclass champion test recall {float(rec):.3f} for fault {key} "
                    "(04b fault-period evaluation)."
                ),
                "recommendedAction": (
                    "Review confusion tail for that class · consider more fault-period runs "
                    "or thresholding with the binary gatekeeper."
                ),
                "faultId": fid,
                "acknowledged": idx > 2,
            }
        )
    return out[:12]


def _default_incidents() -> list[dict[str, Any]]:
    return [
        {
            "id": "nb-seed-1",
            "ts": "2026-03-15T14:22:00+00:00",
            "severity": "MEDIUM",
            "subsystem": "DCS / Analytics",
            "title": "CONDENSER IDV(5) Cooling water temperature elevated",
            "diagnosis": (
                "Static export from 04b (hist_gradient_boosting): test accuracy ≈ 0.925 "
                "on leakage-safe fault-period rows."
            ),
            "recommendedAction": "maintenance tab for run 78 should not include risk",
            "faultId": "sensor_drift",
            "acknowledged": False,
        },
        {
            "id": "nb-seed-2",
            "ts": "2026-03-12T09:05:00+00:00",
            "severity": "LOW",
            "subsystem": "DCS / Analytics",
            "title": "Binary gatekeeper calibration",
            "diagnosis": "04a exports ROC/threshold grids — operator UI shows summary metrics from the selected champion.",
            "recommendedAction": "Inspect binary_artifacts_*.json for FAR vs missed-fault trade-offs.",
            "faultId": None,
            "acknowledged": True,
        },
    ]


def _default_maintenance() -> list[dict[str, Any]]:
    return [
        {
            "id": "nb-pm-1",
            "equipment": "Field analytics · multiclass head",
            "issue": "Per-class recall spread on holdout test (04b)",
            "risk": "MEDIUM",
            "impact": "Mis-routed diagnoses increase response time until binary gate confirms fault.",
            "steps": [
                "Open notebooks/04b_Multiclass_Classifier.ipynb confusion matrices",
                "Compare hist_gradient_boosting vs xgboost on tail faults",
                "Refresh dashboard JSON after retrain",
            ],
            "urgency": "P3",
            "failureWindowMinutes": None,
            "progressPct": 40,
            "faultId": "separator_fault",
        },
        {
            "id": "nb-pm-2",
            "equipment": "Leakage-safe feature pipeline",
            "issue": "Rolling windows [10,20,30,50,100] · 52 base + roll stats",
            "risk": "LOW",
            "impact": "Training-serving skew if window order or masking changes.",
            "steps": [
                "Verify tep_train/tep_test preprocessing matches notebook cells",
                "Confirm run_key stratification still holds after new runs",
            ],
            "urgency": "P4",
            "failureWindowMinutes": 240,
            "progressPct": 72,
            "faultId": None,
        },
    ]


def _synthetic_telemetry(n: int = 180, onset: int = 130) -> tuple[list[dict[str, Any]], int | None]:
    rows: list[dict[str, Any]] = []
    for i in range(n):
        phase = (i - onset) / max(1, n - onset)
        ramp = max(0.0, min(1.0, phase))
        risk = 0.08 + 0.82 * (1.0 - math.exp(-3.5 * ramp))
        rows.append(
            {
                "t": float(i),
                "reactorTemp": 118.0 + 6.0 * math.sin(i / 14.0) + 4.0 * ramp,
                "separatorPressure": 2650 + 120 * math.sin(i / 19.0) + 80 * ramp,
                "flowRate": 42.0 + 3.5 * math.cos(i / 11.0) - 2.0 * ramp,
                "vibration": 0.31 + 0.04 * math.sin(i / 9.0) + 0.08 * ramp,
                "anomalyScore": float(round(risk, 4)),
                "sample": i + 1,
                "trueFaultLabel": 0 if i < onset else 6,
                "predFault": 0 if i < onset + 5 else 6,
                "maxProb": float(round(1.0 - risk * 0.85, 4)),
            }
        )
    return rows, onset


def _load_multiclass_artifacts(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _load_binary_artifact() -> dict[str, Any] | None:
    if not MODEL_DIR.is_dir():
        return None
    candidates = sorted(MODEL_DIR.glob("binary_artifacts_*.json"))
    for p in candidates:
        if "balanced" in p.name and "hist" in p.name:
            with p.open(encoding="utf-8") as f:
                return json.load(f)
    if candidates:
        with candidates[0].open(encoding="utf-8") as f:
            return json.load(f)
    return None


def _telemetry_from_csv(risk_csv: Path) -> tuple[list[dict[str, Any]], int | None]:
    risk = pd.read_csv(risk_csv)
    required = ["sample", "max_prob", "risk_proxy", "target_fault_label", "pred_fault"]
    for c in required:
        if c not in risk.columns:
            raise ValueError(f"Missing column {c} in {risk_csv}")

    if not DATA_PROCESSED.is_file():
        rows: list[dict[str, Any]] = []
        onset_idx: int | None = None
        for i, r in risk.iterrows():
            if onset_idx is None and int(r.get("target_fault_label", 0) or 0) > 0:
                onset_idx = len(rows)
            rp = float(r["risk_proxy"])
            rows.append(
                {
                    "t": float(len(rows)),
                    "reactorTemp": 118.0 + 6.0 * math.sin(len(rows) / 14.0) + 4.0 * rp,
                    "separatorPressure": 2650 + 120 * math.sin(len(rows) / 19.0) + 80 * rp,
                    "flowRate": 42.0 + 3.5 * math.cos(len(rows) / 11.0) - 2.0 * rp,
                    "vibration": 0.31 + 0.04 * math.sin(len(rows) / 9.0) + 0.08 * rp,
                    "anomalyScore": float(round(rp, 4)),
                    "sample": int(r["sample"]),
                    "trueFaultLabel": int(r["target_fault_label"]),
                    "predFault": int(r["pred_fault"]),
                    "maxProb": float(r["max_prob"]),
                }
            )
        return rows, onset_idx

    head = pd.read_csv(DATA_PROCESSED, nrows=1)
    xcols = [v for v in XMEAS_CHART.values() if v in head.columns]
    usecols = ["simulationRun", "sample", *xcols]
    test = pd.read_csv(DATA_PROCESSED, usecols=usecols)
    merged = risk.merge(test, on=["simulationRun", "sample"], how="left")
    onset_idx = None
    rows = []
    for _, r in merged.iterrows():
        if onset_idx is None and int(r.get("target_fault_label", 0) or 0) > 0:
            onset_idx = len(rows)
        rp = float(r["risk_proxy"])
        row = {
            "t": float(len(rows)),
            "reactorTemp": float(r.get(XMEAS_CHART["reactorTemp"], 120.0)),
            "separatorPressure": float(r.get(XMEAS_CHART["separatorPressure"], 2700.0)),
            "flowRate": float(r.get(XMEAS_CHART["flowRate"], 45.0)),
            "vibration": float(r.get(XMEAS_CHART["vibration"], 0.32)),
            "anomalyScore": float(round(rp, 4)),
            "sample": int(r["sample"]),
            "trueFaultLabel": int(r["target_fault_label"]),
            "predFault": int(r["pred_fault"]),
            "maxProb": float(r["max_prob"]),
        }
        rows.append(row)
    return rows, onset_idx


def build_bundle() -> dict[str, Any]:
    defaults = _default_bundle_metrics()
    multiclass = defaults["multiclass"]
    binary = defaults["binary"]

    art = _load_multiclass_artifacts(MODEL_DIR / "multiclass_comparison_artifacts.json")
    incidents = _default_incidents()
    maintenance = _default_maintenance()
    telemetry, fault_onset = _synthetic_telemetry()

    if art:
        multiclass = {
            "champion": art.get("champion", multiclass["champion"]),
            "comparison": art.get("comparison", multiclass["comparison"]),
            "featureCount": len(art.get("features", [])) or multiclass["featureCount"],
            "xmeasCount": 41,
        }
        champ = multiclass["champion"]
        rep = (art.get("reports") or {}).get(champ)
        if isinstance(rep, dict):
            inc = _build_incidents_from_report(rep)
            if inc:
                incidents = inc

    b_art = _load_binary_artifact()
    if b_art:
        key = str(b_art.get("model_name", "exported_binary")).replace("binary_champion_", "")
        binary = {
            "defaultModelKey": key,
            "models": {
                key: {
                    "configLabel": str(b_art.get("config", "")),
                    "auc": float((b_art.get("roc") or {}).get("auc", 0) or 0) or None,
                    "threshold": float(b_art.get("threshold", 0) or 0) or None,
                    "accuracy": float(
                        (b_art.get("classification_report") or {}).get("accuracy", 0) or 0
                    )
                    or None,
                    "macroF1": float(
                        ((b_art.get("classification_report") or {}).get("macro avg") or {}).get(
                            "f1-score", 0
                        )
                        or 0
                    )
                    or None,
                    "macroRecall": float(
                        ((b_art.get("classification_report") or {}).get("macro avg") or {}).get(
                            "recall", 0
                        )
                        or 0
                    )
                    or None,
                }
            },
        }

    risk_files = sorted(OUTPUT_DIR.glob("multiclass_risk_timeseries_*.csv")) if OUTPUT_DIR.is_dir() else []
    if risk_files:
        try:
            telemetry, fault_onset = _telemetry_from_csv(risk_files[-1])
        except Exception:
            telemetry, fault_onset = _synthetic_telemetry()

    champ = multiclass["champion"]
    test_rows = [r for r in multiclass["comparison"] if r.get("split") == "test"]
    champ_row = next((r for r in test_rows if r.get("model") == champ), test_rows[0] if test_rows else {})

    bundle: dict[str, Any] = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceNote": "Generated by scripts/export_tep_notebook_dashboard.py from 04a/04b artifacts when present.",
        "binary": binary,
        "multiclass": multiclass,
        "incidents": incidents,
        "maintenance": maintenance,
        "telemetry": telemetry,
        "faultOnsetIndex": fault_onset,
        "architecture": {
            "headline": f"Notebook champion: {champ}",
            "detail": (
                f"Holdout fault-period test · accuracy {float(champ_row.get('accuracy', 0)):.4f} · "
                f"macro-F1 {float(champ_row.get('macro_f1', 0)):.4f} — see notebooks/04b_Multiclass_Classifier.ipynb."
            ),
        },
    }
    return bundle


def main() -> None:
    _find_project_root()
    bundle = build_bundle()
    DASH_DATA.parent.mkdir(parents=True, exist_ok=True)
    with DASH_DATA.open("w", encoding="utf-8") as f:
        json.dump(bundle, f, indent=2)
    print(f"Wrote {DASH_DATA}")


if __name__ == "__main__":
    main()
