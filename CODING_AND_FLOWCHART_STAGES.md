# Coding work summary: ML pipeline vs. your reference flowchart

This document describes what the **codebase actually implements** for the Tennessee Eastman (TEP) fault project, and how that lines up with the layered flowchart (physical plant → data → AI classification → operator UI).

---

## What you implemented in code (high level)


| Area                   | What exists in the repo                                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data**               | Load TEP training/testing data from `.RData`, optional parquet cache, subsample runs per fault, respect fault-injection time so pre-fault rows are not mislabeled (`src/data_loader.py`, `src/config.py`).                  |
| **Features**           | 52 columns: 41 `XMEAS` + 11 `XMV`, aligned to `config.FEATURE_COLUMNS`; target is `faultNumber` (`src/config.py`).                                                                                                          |
| **Preprocessing**      | Imputation (median), `StandardScaler` fit on train only, feature alignment for missing/extra tags, missing/outlier audit CSVs (`src/preprocessing.py`).                                                                     |
| **EDA**                | Class distribution and related plots via `src/eda.py`, orchestrated from `src/pipeline.py`.                                                                                                                                 |
| **Models**             | **Random Forest** and **XGBoost** trained as **one multi-class classifier** each (`src/models.py`). XGBoost uses `multi:softprob` with `num_class` = number of distinct fault labels in the training slice.                 |
| **Evaluation**         | Accuracy, macro/weighted F1, per-class report, confusion matrices, model comparison figure (`src/evaluation.py`).                                                                                                           |
| **Explainability**     | Feature importance plots and optional SHAP summaries (`src/explainability.py`).                                                                                                                                             |
| **Inference / alerts** | `predict_proba` → argmax class → human-readable fault name, severity, recommended action from `FAULT_CATALOG`, plus confidence (`src/simulation.py` → `FactoryAlert`).                                                      |
| **Orchestration**      | CLI pipeline: load → preprocess → EDA → train → evaluate → explainability → demo JSON streams (`src/pipeline.py`).                                                                                                          |
| **API**                | FastAPI: `/predict`, `/simulate/{fault_id}`, `/demo`, metrics, fault catalog (`api/main.py`).                                                                                                                               |
| **Notebook**           | `notebooks/tep_pipeline.ipynb` walks through the same `src/` modules end-to-end.                                                                                                                                            |
| **Dashboard**          | Next.js operator UI with simulation, charts, and AI copy; much of the **live animation and “health” styling** is driven by **mock telemetry** (`dashboard/src/lib/mockTelemetry`*) unless you wire the UI fully to the API. |


---

---

## Multi-class classification (flowchart Stage 2a) — did you solve it?

**Yes — this is the core of what you coded.**

- Target: **fault type ID** (`faultNumber`), including normal as one class.
- Models: Random Forest + XGBoost multi-class (`src/models.py`).
- Evaluation and confusion matrices are **multi-class** (predicted vs. true fault ID).
- Alerts and API responses expose **predicted fault id**, name, severity, and confidence from the winning class probability (`src/simulation.py`, `api/main.py`).

Relative to the flowchart: you are primarily solving **Stage 2a (multi-class fault type identification)**. The same models also predict “normal,” so they cover both healthy and faulty regimes in one head.

---

## Health score (flowchart Stage 2b)

The flowchart describes something like **health = (1 − P(fault)) × 100%** with amber/red thresholds.

**In the Python ML path:**

- The service computes **full class probabilities** (`predict_proba`), but the main alert builder picks **argmax** and reports **confidence** for that class — it does **not** currently define a dedicated **P(fault) = 1 − P(class 0)** health metric in code.
- **Plant status** on alerts comes from the **catalog severity** of the *predicted* fault, mapped through `SEVERITY_TO_STATUS` (`src/config.py`, `src/simulation.py`), not from the Stage‑2b formula above.

**In the dashboard:**

- **System health %** and related UI thresholds are part of the **front-end simulation layer** (e.g. `buildSnapshot` / nav coloring), which is **not guaranteed** to be the same as a rigorous `(1 − P(fault))` definition from the backend.

So: **Stage 2b is only partially aligned** — useful for demos/UI, but **not fully specified as the flowchart’s P(fault) health score** in the training/inference Python core.

---

## Risk score (flowchart Stage 3)

The flowchart suggests **risk = model confidence × fault severity weighting** (high/med/low).

**Now implemented in code:**

- Backend alerts now compute a fused **`risk_score`** in `src/simulation.py`:
  - `risk_score = confidence × severity_weight`
- Severity weighting is explicit in config (`src/config.py` via `RISK_SEVERITY_WEIGHT`):
  - `NONE=0.00, LOW=0.35, MEDIUM=0.60, HIGH=0.85, CRITICAL=1.00`
- Alerts also include **`risk_level`** (`LOW`/`MEDIUM`/`HIGH`) via threshold mapping in config (`get_risk_level`).
- API responses from `/predict` and `/simulate/{fault_id}` include these fields automatically because they return `FactoryAlert` dictionaries.

So: **Stage 3 is complete in the Python backend path** (explicit fusion + output fields).

---

## Mapping: which flowchart stage does your coding solve?


| Flowchart block                          | Implemented in code?           | Notes                                                                                                       |
| ---------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Physical plant / sensors / controllers   | **No** (benchmark data only)   | You consume TEP data, not a live DCS.                                                                       |
| 52 TEP variables combined                | **Yes**                        | `FEATURE_COLUMNS` in `src/config.py`.                                                                       |
| Preprocessing (normalisation, etc.)      | **Yes**                        | Impute + scale; no sliding window in the cited `preprocessing` module (time context would be an extension). |
| **Stage 1: Binary fault / no fault**     | **Implicit only**              | Same multi-class model; no separate binary classifier.                                                      |
| **Stage 2a: Multi-class fault type**     | **Yes (main ML contribution)** | RF + XGBoost, evaluation, API, alerts.                                                                      |
| **Stage 2b: Health score from P(fault)** | **Partial / UI-leaning**       | Not the central definition in Python; dashboard uses mock-driven health display.                            |
| **Stage 3: Risk score fusion**           | **Yes**                        | `risk_score = confidence × severity_weight` with derived `risk_level` in `FactoryAlert`.                   |
| Operator output (Streamlit)              | **Different stack**            | **FastAPI + Next.js dashboard** instead of Streamlit; same *role* in the architecture.                      |


**One-line summary:** Your coding work implements the data layer and preprocessing plus **Stage 2a (multi-class fault identification)**, with **Stage 1 merged into the same multi-class model**, **Stage 3 now explicitly implemented as fused risk scoring in backend alerts**, and **Stage 2b still partially aligned** (dashboard health remains mostly mock/UI-driven unless separately wired to a backend `P(fault)` definition).

---

## Files to cite for reviewers

- Pipeline entry: `src/pipeline.py`
- Models: `src/models.py`
- Preprocessing: `src/preprocessing.py`
- Data + labels: `src/data_loader.py`, `src/config.py`
- Alerts / streaming JSON: `src/simulation.py`
- API: `api/main.py`
- Notebook demo: `notebooks/tep_pipeline.ipynb`

