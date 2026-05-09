"""FastAPI service exposing the AIFI predictive engine to the dashboard.

Run from the project root with:

.. code-block:: bash

    python -m uvicorn api.main:app --reload --port 8000

(``uvicorn api.main:app …`` also works when pip's ``Scripts/`` directory
is on the user's ``PATH`` - on Windows it often isn't, hence the
``python -m`` form above.)

Endpoints
---------
``GET  /``                                - API index + link to ``/docs``.
``GET  /health``                          - service liveness check.
``GET  /faults``                          - the full TEP fault catalog.
``GET  /metrics``                         - latest model evaluation metrics.
``POST /predict``                         - score a single telemetry vector.
``GET  /simulate/{fault_id}``             - replay one TEP simulation as alerts.
``GET  /demo``                            - list pre-generated demo streams.
``GET  /demo/{filename}``                 - fetch a single demo stream.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

# Make sure the ``src`` package is importable when launched via uvicorn
import sys
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src import config  # noqa: E402
from src.models import TrainedModel  # noqa: E402
from src.simulation import build_alert, simulate_live_stream  # noqa: E402

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
except ImportError as e:  # pragma: no cover
    raise RuntimeError(
        "FastAPI is required for the API service. Install with "
        "`pip install fastapi uvicorn pydantic`."
    ) from e

logger = logging.getLogger("aifi.api")
logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------------------------
# App + CORS (Next.js dashboard will live on a different origin)
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AIFI - Tennessee Eastman Predictive Maintenance API",
    description=(
        "Industry 4.0 prototype: serves real-time fault predictions, "
        "severity, confidence and recommended maintenance actions to "
        "the smart-factory dashboard."
    ),
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Lazy model loading
# ---------------------------------------------------------------------------
_MODEL: Optional[TrainedModel] = None
_MANIFEST: Optional[Dict] = None


def _load_manifest() -> Dict:
    global _MANIFEST
    if _MANIFEST is None:
        manifest_path = config.REPORT_DIR / "manifest.json"
        if not manifest_path.exists():
            raise HTTPException(503, "Pipeline has not been run yet. "
                                     "Run `python -m src.pipeline` first.")
        _MANIFEST = json.loads(manifest_path.read_text())
    return _MANIFEST


def _load_model() -> TrainedModel:
    global _MODEL
    if _MODEL is None:
        manifest = _load_manifest()
        path = Path(manifest["best_model_path"])
        if not path.exists():
            raise HTTPException(503, f"Trained model not found at {path}.")
        _MODEL = TrainedModel.load(path)
        logger.info("Loaded model %s from %s", _MODEL.name, path)
    return _MODEL


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class TelemetryRequest(BaseModel):
    features: Dict[str, float] = Field(
        ..., description="Map of TEP sensor tag -> value, e.g. {'xmeas_1': 0.25, ...}",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def root() -> Dict:
    """Browser-friendly entry point - ``/`` had no route before (404)."""
    return {
        "service": app.title,
        "version": app.version,
        "docs": "/docs",
        "openapi": "/openapi.json",
        "endpoints": {
            "GET /health": "Liveness check",
            "GET /faults": "TEP fault catalog",
            "GET /metrics": "Latest pipeline manifest + metrics",
            "POST /predict": "Score one telemetry vector (JSON body)",
            "GET /simulate/{fault_id}": "Replay one simulation as alerts",
            "GET /demo": "List pre-generated demo JSON streams",
            "GET /demo/{filename}": "Fetch one demo stream",
        },
        "hint": "Open /docs for interactive Swagger UI.",
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/faults")
def list_faults() -> Dict[int, Dict]:
    return config.FAULT_CATALOG


@app.get("/metrics")
def metrics() -> Dict:
    return _load_manifest()


@app.post("/predict")
def predict(payload: TelemetryRequest) -> Dict:
    model = _load_model()
    series = pd.Series(payload.features, dtype="float64")
    alert = build_alert(series, model)
    return alert.to_dict()


@app.get("/simulate/{fault_id}")
def simulate(fault_id: int, sample_every: int = 5,
             split: str = "testing") -> Dict:
    """Replay one TEP simulation run as a stream of alerts."""
    model = _load_model()
    out = simulate_live_stream(
        model, fault_number=fault_id, split=split, sample_every=sample_every,
    )
    return json.loads(Path(out).read_text())


@app.get("/demo")
def list_demo_streams() -> List[str]:
    return sorted(p.name for p in config.PREDICTION_DIR.glob("stream_*.json"))


@app.get("/demo/{filename}")
def get_demo_stream(filename: str) -> Dict:
    path = config.PREDICTION_DIR / filename
    if not path.exists():
        raise HTTPException(404, f"No such demo stream: {filename}")
    return json.loads(path.read_text())
