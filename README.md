# AIFI - Tennessee Eastman Smart Factory Predictive Engine

An end-to-end **Industry 4.0 predictive-maintenance prototype** for a smart
chemical plant, built on top of the Tennessee Eastman Process (TEP)
benchmark dataset.

The pipeline ingests raw industrial sensor data, trains tree-based
classifiers (Random Forest + XGBoost) to recognise 20 documented process
faults, evaluates them against a held-out test set, explains the model
with feature importances and SHAP, and finally streams structured
**plant-status alerts** that a Next.js dashboard can render live.

```
Plant Status:        ALERT
Predicted Fault:     Reactor Cooling Inlet Temperature Step
Confidence:          96.4%
Severity:            HIGH
Recommended Action:  Inspect reactor cooling water supply, heat-exchanger fouling, cooling tower.
```

---

## 1. Architecture

```
                        ┌──────────────────────┐
                        │  Tennessee Eastman   │
                        │  .RData (raw)        │
                        └──────────┬───────────┘
                                   │ pyreadr → parquet (one-off cache)
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ src/data_loader.py    balanced sub-sampling per fault class     │
│ src/preprocessing.py  schema check + impute + scale + audit     │
│ src/eda.py            class dist, correlation, trends, PCA      │
│ src/models.py         RandomForest + XGBoost factories          │
│ src/evaluation.py     metrics + confusion matrices + ranking    │
│ src/explainability.py feature importance + SHAP                 │
│ src/simulation.py     Industry 4.0 alerts (status / severity /  │
│                       recommended action) + dashboard JSON      │
│ src/pipeline.py       end-to-end CLI orchestrator               │
└────────────────┬────────────────────────────────────────────────┘
                 │  joblib model + JSON manifest + JSON alerts
                 ▼
       ┌────────────────────────┐         ┌──────────────────────┐
       │ api/main.py (FastAPI)  │ ──────▶ │ Next.js dashboard    │
       │ /predict /simulate /…  │         │ (animated reactor)   │
       └────────────────────────┘         └──────────────────────┘
```

Each module is independently importable - so the FastAPI service, the
notebook walkthrough and any future LSTM extension can all reuse the
same `TrainedModel` and preprocessing artifacts.

## 2. Project layout

```
AIFI-group_project/
├── dataset/                       # raw .RData files (TEP)
├── notebooks/
│   └── tep_pipeline.ipynb         # interactive walkthrough
├── src/
│   ├── config.py                  # paths + fault catalog + severity
│   ├── data_loader.py             # parquet cache + sub-sampling
│   ├── preprocessing.py           # impute / scale / audit
│   ├── eda.py                     # plots
│   ├── models.py                  # RF + XGBoost factories
│   ├── evaluation.py              # metrics + comparison
│   ├── explainability.py          # importance + SHAP
│   ├── simulation.py              # smart-factory alert formatter
│   └── pipeline.py                # CLI orchestrator
├── api/
│   └── main.py                    # FastAPI service for the dashboard
├── outputs/                       # generated artifacts (gitignored)
│   ├── cache/                     # parquet copies of the .RData files
│   ├── figures/                   # EDA + evaluation PNGs
│   ├── models/                    # joblib-serialised TrainedModel(s)
│   ├── reports/                   # JSON metrics + CSV importances
│   └── predictions/               # demo alert streams (one JSON / fault)
├── requirements.txt
└── README.md
```

## 3. Tennessee Eastman dataset

The TEP files shipped under `dataset/` come from the Rieth/Mestl release:

| File                              | Rows       | Description                          |
|-----------------------------------|------------|--------------------------------------|
| `TEP_FaultFree_Training.RData`    | 250 000    | 500 sims × 500 samples, fault 0      |
| `TEP_FaultFree_Testing.RData`     | 480 000    | 500 sims × 960 samples, fault 0      |
| `TEP_Faulty_Training.RData`       | 5 000 000  | 500 sims × 500 samples × 20 faults   |
| `TEP_Faulty_Testing.RData`        | 9 600 000  | 500 sims × 960 samples × 20 faults   |

Each row carries the **52 process variables**:

* `xmeas_1..41` — 41 sensor measurements (temperatures, pressures,
  flows, levels, compositions),
* `xmv_1..11` — 11 manipulated variables (valve positions).

In faulty simulations the disturbance is only injected after sample 20
(training) or 160 (testing); `data_loader.py` strips those genuinely
fault-free leading samples so the labels stay clean.

The 21 plant states are catalogued in `src/config.py:FAULT_CATALOG`
together with a **type, severity, description and recommended
maintenance action** — this is the domain knowledge the dashboard uses
to colour-code alerts and recommend interventions.

## 4. Setup

```powershell
# Python 3.11+ recommended
pip install -r requirements.txt
```

The first time you run the pipeline it converts each `.RData` file to a
parquet twin under `outputs/cache/` (~2 minutes, ~1.4 GB). Every
subsequent run loads the cache in seconds.

## 5. Run the full pipeline

```powershell
# Full run (all 21 fault classes, both models, EDA + SHAP + dashboard demos)
python -m src.pipeline --train-runs 30 --test-runs 15 \
    --models random_forest xgboost

# Faster smoke run
python -m src.pipeline --train-runs 5 --test-runs 3 \
    --only-faults 0 1 4 6 --models random_forest --skip-shap
```

Useful flags (`python -m src.pipeline --help`):

| Flag                    | Effect                                          |
|-------------------------|-------------------------------------------------|
| `--train-runs N`        | sims per fault class for training (default 30)  |
| `--test-runs N`         | sims per fault class for testing  (default 15)  |
| `--models …`            | one or both of `random_forest xgboost`          |
| `--only-faults 0 1 4`   | restrict the dataset to specific fault numbers  |
| `--skip-eda / --skip-shap / --skip-simulation` | skip slow optional stages |
| `--force-rebuild-cache` | regenerate parquet cache from `.RData`          |

After a run, `outputs/` contains everything the dashboard needs:

| Path                                             | Contents                                |
|--------------------------------------------------|-----------------------------------------|
| `outputs/figures/`                               | EDA + confusion + importance plots      |
| `outputs/models/random_forest.joblib`            | serialised `TrainedModel`               |
| `outputs/models/xgboost.joblib`                  | serialised `TrainedModel`               |
| `outputs/reports/model_metrics.json`             | per-model metrics + per-class report    |
| `outputs/reports/manifest.json`                  | best-model pointer + fault catalog      |
| `outputs/reports/feature_importance_*.csv`       | global feature ranking                  |
| `outputs/reports/shap_importance_*.csv`          | SHAP-based ranking                      |
| `outputs/predictions/stream_fault_XX_run_YY.json`| dashboard-ready alert timelines         |

## 6. Notebook walkthrough

```powershell
jupyter notebook notebooks/tep_pipeline.ipynb
```

The notebook is intentionally thin - every section delegates to a
function in `src/`, so the lab story and the production code stay in
sync.

## 7. FastAPI service for the dashboard

```powershell
# Always works (does not depend on the Scripts/ folder being on PATH)
python -m uvicorn api.main:app --reload --port 8000

# Equivalent if `pip install`'s Scripts/ directory is on PATH
uvicorn api.main:app --reload --port 8000
```

If you see `uvicorn : The term 'uvicorn' is not recognized`, use the
`python -m uvicorn …` form above - this happens on Windows when pip
installs `uvicorn.exe` into a Scripts directory that is not on
`%PATH%` (pip prints a warning during install).

Endpoints:

| Method + path                    | Purpose                                       |
|----------------------------------|-----------------------------------------------|
| `GET  /`                         | API index (lists routes); open **`/docs`** for Swagger UI |
| `GET  /health`                   | liveness check                                |
| `GET  /faults`                   | the full TEP fault catalog                    |
| `GET  /metrics`                  | latest model evaluation manifest              |
| `POST /predict`                  | score a single telemetry vector               |
| `GET  /simulate/{fault_id}`      | replay one TEP simulation as alerts           |
| `GET  /demo`                     | list pre-generated demo streams               |
| `GET  /demo/{filename}`          | fetch a single demo stream                    |

Example `POST /predict` body:

```json
{
  "features": {
    "xmeas_1": 0.25, "xmeas_2": 3675.0, "xmeas_3": 4500.4, "...": 0.0,
    "xmv_1": 62.3, "xmv_2": 53.4, "xmv_11": 18.4
  }
}
```

Example response:

```json
{
  "timestamp": "2026-05-09T11:24:15.812000+00:00",
  "plant_status": "ALERT",
  "predicted_fault_id": 4,
  "predicted_fault": "Reactor Cooling Inlet Temperature Step",
  "fault_type": "Step",
  "confidence": 0.964,
  "confidence_pct": "96.4%",
  "severity": "HIGH",
  "severity_rank": 3,
  "recommended_action": "Inspect reactor cooling water supply, heat-exchanger fouling, cooling tower.",
  "description": "Reactor cooling water inlet temperature step disturbance.",
  "top_features": [
    {"feature": "xmeas_9",  "value": 121.5, "z_score":  3.42, "contribution": 0.21},
    {"feature": "xmv_10",   "value":  41.8, "z_score": -2.11, "contribution": 0.13}
  ]
}
```

## 8. Smart-factory output schema

Each alert produced by `src/simulation.py:build_alert` is a single
JSON-serialisable object with the fields the Industry 4.0 dashboard
expects:

| Field                  | Meaning                                                 |
|------------------------|---------------------------------------------------------|
| `plant_status`         | `NORMAL` / `ADVISORY` / `WARNING` / `ALERT` / `EMERGENCY` |
| `predicted_fault_id`   | TEP fault number (0 = normal)                           |
| `predicted_fault`      | human-readable fault name                               |
| `confidence` / `_pct`  | classifier probability (0..1 and "%")                   |
| `severity`             | `NONE`/`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`                 |
| `severity_rank`        | 0..4 (for colour coding)                                |
| `recommended_action`   | written maintenance action                              |
| `top_features`         | top contributing sensors with z-score & contribution    |
| `timestamp`            | ISO-8601 UTC timestamp                                  |
| `simulation_run`       | TEP simulation index (for traceability)                 |
| `ground_truth_fault_id`| only present for replays - useful for evaluation overlays |

## 9. Roadmap

* Frontend: Next.js dashboard polling `/demo/{file}` for animated reactor schematics.
* Backend: this FastAPI app, deployable behind a reverse proxy.
* ML extension: an LSTM head for time-series fault onset prediction.
* MLOps: nightly retrain + model registry; alert log streamed to a SCADA historian.
