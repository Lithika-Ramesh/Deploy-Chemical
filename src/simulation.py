"""Smart-factory simulation layer.

Wraps a :class:`TrainedModel` and turns each row of incoming telemetry
into a structured Industry 4.0 alert that is ready for the dashboard:

.. code-block:: text

    Plant Status:        WARNING
    Predicted Fault:     Reactor Cooling Failure
    Confidence:          96%
    Severity:            HIGH
    Recommended Action:  Inspect cooling system

The :func:`simulate_live_stream` helper turns one TEP simulation run into
a JSON file that the FastAPI service can serve - exactly the artifact
the Next.js dashboard will eventually consume.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import numpy as np
import pandas as pd

from . import config
from .data_loader import stream_simulation_run
from .models import TrainedModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------
@dataclass
class FactoryAlert:
    timestamp: str
    plant_status: str
    predicted_fault_id: int
    predicted_fault: str
    fault_type: str
    confidence: float          # 0..1
    confidence_pct: str        # e.g. "96%"
    severity: str
    severity_rank: int
    recommended_action: str
    description: str
    top_features: List[Dict[str, float]]
    sample_index: Optional[int] = None
    simulation_run: Optional[int] = None
    ground_truth_fault_id: Optional[int] = None

    def to_dict(self) -> Dict:
        return asdict(self)

    def pretty(self) -> str:
        return (
            f"Plant Status:        {self.plant_status}\n"
            f"Predicted Fault:     {self.predicted_fault}\n"
            f"Confidence:          {self.confidence_pct}\n"
            f"Severity:            {self.severity}\n"
            f"Recommended Action:  {self.recommended_action}"
        )


# ---------------------------------------------------------------------------
# Per-row alert formatter
# ---------------------------------------------------------------------------
def _top_contributing_features(
    row: pd.Series, model: TrainedModel, k: int = 5,
) -> List[Dict[str, float]]:
    """Cheap proxy for SHAP at inference time.

    We multiply the standardised reading by the global feature importance
    so the dashboard can highlight which sensors are driving the alert.
    """
    if not hasattr(model.estimator, "feature_importances_"):
        return []
    raw_df = row.to_frame().T
    # Align to training schema so sparse API payloads (e.g. Swagger's
    # additionalProp keys) do not cause out-of-bounds indexing.
    raw_aligned = raw_df.reindex(columns=model.feature_columns)
    imputed = model.preprocessor.imputer.transform(raw_aligned)[0]
    standardised = model.preprocessor.transform(raw_df).iloc[0]
    contrib = standardised.values * model.estimator.feature_importances_
    order = np.argsort(np.abs(contrib))[::-1][:k]
    return [
        {
            "feature": model.feature_columns[i],
            "value": float(imputed[i]),
            "z_score": float(standardised.iloc[i]),
            "contribution": float(contrib[i]),
        }
        for i in order
    ]


def build_alert(
    features: pd.Series,
    model: TrainedModel,
    sample_index: Optional[int] = None,
    simulation_run: Optional[int] = None,
    ground_truth: Optional[int] = None,
    timestamp: Optional[datetime] = None,
) -> FactoryAlert:
    """Convert one row of telemetry into a factory alert."""
    Xrow = features.to_frame().T
    proba = model.predict_proba(Xrow)[0]
    cls_idx = int(np.argmax(proba))
    confidence = float(proba[cls_idx])
    fault_id = int(model.classes_[cls_idx])

    catalog = config.FAULT_CATALOG.get(fault_id, {
        "name": f"Unknown ({fault_id})", "type": "Unknown",
        "severity": "MEDIUM", "action": "Investigate.",
        "description": "Unrecognised fault pattern.",
    })

    return FactoryAlert(
        timestamp=(timestamp or datetime.now(timezone.utc)).isoformat(),
        plant_status=config.SEVERITY_TO_STATUS[catalog["severity"]],
        predicted_fault_id=fault_id,
        predicted_fault=catalog["name"],
        fault_type=catalog["type"],
        confidence=round(confidence, 4),
        confidence_pct=f"{confidence*100:.1f}%",
        severity=catalog["severity"],
        severity_rank=config.SEVERITY_RANK[catalog["severity"]],
        recommended_action=catalog["action"],
        description=catalog["description"],
        top_features=_top_contributing_features(features, model),
        sample_index=sample_index,
        simulation_run=simulation_run,
        ground_truth_fault_id=ground_truth,
    )


# ---------------------------------------------------------------------------
# Streaming simulation - writes a JSON timeline ready for the dashboard
# ---------------------------------------------------------------------------
def simulate_live_stream(
    model: TrainedModel,
    fault_number: int,
    split: str = "testing",
    simulation_run: Optional[int] = None,
    sample_every: int = 5,
    sample_interval_minutes: int = 3,
    output_path: Optional[Path] = None,
    random_state: int = 0,
) -> Path:
    """Stream a TEP simulation run through the model and persist alerts."""
    features, meta = stream_simulation_run(
        fault_number=fault_number, split=split,
        simulation_run=simulation_run, random_state=random_state,
    )
    sim_id = int(meta["simulationRun"].iloc[0])
    base_time = datetime.now(timezone.utc)

    alerts: List[Dict] = []
    for i in range(0, len(features), sample_every):
        ts = base_time + timedelta(minutes=i * sample_interval_minutes)
        alert = build_alert(
            features.iloc[i],
            model,
            sample_index=int(meta["sample"].iloc[i]),
            simulation_run=sim_id,
            ground_truth=int(meta["faultNumber"].iloc[i]),
            timestamp=ts,
        )
        alerts.append(alert.to_dict())

    out_dir = config.PREDICTION_DIR
    out = output_path or out_dir / f"stream_fault_{fault_number:02d}_run_{sim_id}.json"
    payload = {
        "metadata": {
            "fault_number_ground_truth": int(fault_number),
            "fault_label_ground_truth":  config.get_fault_label(fault_number),
            "simulation_run": sim_id,
            "split": split,
            "model": model.name,
            "sample_every": sample_every,
            "sample_interval_minutes": sample_interval_minutes,
            "n_alerts": len(alerts),
        },
        "alerts": alerts,
    }
    out.write_text(json.dumps(payload, indent=2))
    logger.info("Wrote %d alerts -> %s", len(alerts), out)
    return out


# ---------------------------------------------------------------------------
# Convenience: a small panel of demo streams for the dashboard
# ---------------------------------------------------------------------------
def generate_demo_alerts(
    model: TrainedModel,
    fault_ids: Iterable[int] = (0, 1, 4, 6, 11, 14),
    split: str = "testing",
    sample_every: int = 10,
) -> List[Path]:
    paths = []
    for fid in fault_ids:
        try:
            p = simulate_live_stream(
                model, fault_number=fid, split=split,
                sample_every=sample_every,
            )
            paths.append(p)
        except Exception as exc:  # noqa: BLE001 - demo helper
            logger.warning("Skipping demo for fault %s: %s", fid, exc)
    return paths
