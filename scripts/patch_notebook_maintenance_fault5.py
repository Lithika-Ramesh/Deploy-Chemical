"""Patch tep_notebook_dashboard.json maintenance[] from curated Fault 5 metrics."""
from __future__ import annotations

import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BUNDLE = PROJECT_ROOT / "dashboard" / "public" / "data" / "tep_notebook_dashboard.json"
METRICS = PROJECT_ROOT / "outputs" / "figures" / "fault5" / "curated_run_metrics.csv"

F5_ACTION = "Recover condensing duty"
F5_DETAIL = [
    "Check CW flow to condenser",
    "confirm ΔT across bundle",
    "review tower pressure",
]

CASES = [
    ("f5-pm-78",  "LOW", "P4", 95, "MEDIUM", [
        "Use as default Fault 5 simulation replay",
        "Compare XMEAS_13 and XMV_11 to historian",
    ]),
    ("f5-pm-171", "Nuisance alarms", "HIGH", "P1", 35, "HIGH", [
        "Review alarm rationalization on binary score (threshold 0.35)",
        "Pair briefing with clean run 78",
    ]),
    ("f5-pm-148", "HIGH", "P2", 55, "HIGH", [
        "Prioritize separator PIT and condenser duty",
    ]),
    ("f5-pm-429", "Strong step (+)", "HIGH", "P2", 58, "HIGH", [
        "Compare with run 148 for run-to-run variability",
    ]),
    ("f5-pm-377", "Subtle physics", "MEDIUM", "P3", 70, "MEDIUM", [
        "Contrast with Fault 13 slow-drift narrative",
    ]),
]


def main() -> None:
    import pandas as pd

    m = pd.read_csv(METRICS)
    with BUNDLE.open(encoding="utf-8") as f:
        bundle = json.load(f)

    maintenance = []
    for row in m.itertuples(index=False):
        run = int(row.simulationRun)
        meta = next((c for c in CASES if c[0] == f"f5-pm-{run}"), None)
        if meta is None:
            continue
        _id, tag, risk, urgency, progress, _eq, extra_steps = meta
        delay = int(row.delay) if row.delay == row.delay else None
        first = int(row.first_alert) if row.first_alert == row.first_alert else None
        pre_fa = int(row.pre_false_alarms)
        issue_map = {
            78: "IDV(5) step — instant alert at injection, zero pre-fault alarms",
            171: "90 binary alerts before sample 161 — false-alarm review",
            148: "Large negative XMEAS_13 step after condenser CW upset",
            429: "Large positive XMEAS_13 step — mirror holdout run",
            377: "Subtle ΔXMEAS_13 (+0.12) with strong model response at onset",
        }
        maintenance.append(
            {
                "id": _id,
                "equipment": f"tep_test run {run}",
                "issue": issue_map.get(run, row.description),
                "risk": risk,
                "impact": (
                    f"pre-FA {pre_fa} · 1st alert {first} · delay {delay} · "
                    f"max P(fault) {float(row.max_p_fault)*100:.3f}% · "
                    f"IDV(5) {float(row.multiclass_pct):.1f}% · "
                    f"ΔXMEAS_13 {float(row.xmeas_13_delta):+.2f}"
                ),
                "steps": [F5_ACTION, *F5_DETAIL, *extra_steps],
                "urgency": urgency,
                "failureWindowMinutes": max(3, 11 + (delay or 0) * 3)
                if delay is not None and delay >= 0
                else 45,
                "progressPct": progress,
                "faultId": 5,
                "tepCase": {
                    "simulationRun": run,
                    "preFalseAlarms": pre_fa,
                    "firstAlertSample": first,
                    "detectionDelaySamples": delay,
                    "maxPFault": float(row.max_p_fault),
                    "multiclassIdv5Pct": float(row.multiclass_pct),
                    "xmeas13Delta": float(row.xmeas_13_delta),
                    "caseTag": "",
                },
            }
        )

    maintenance.sort(key=lambda x: x["tepCase"]["simulationRun"])
    bundle["maintenance"] = maintenance
    bundle["sourceNote"] = (
        (bundle.get("sourceNote") or "")
        + " · Maintenance: Fault 5 curated tep_test runs (see outputs/figures/fault5)"
    ).strip()

    with BUNDLE.open("w", encoding="utf-8") as f:
        json.dump(bundle, f, indent=2)
        f.write("\n")
    print(f"Patched {len(maintenance)} maintenance items in {BUNDLE}")


if __name__ == "__main__":
    main()
