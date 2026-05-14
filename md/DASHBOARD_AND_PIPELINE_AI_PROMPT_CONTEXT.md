# AI prompt context: TEP dashboard, data sources, flowchart stages, and evolution goals

Use this document as **system or user context** when asking an AI to extend the AIFI Tennessee Eastman Process (TEP) dashboard, wire notebooks and the Python pipeline to the UI, or replace mock telemetry with real outputs. The canonical, file-level source map lives in `datasources.md`; this file distills it for prompting.

---

## Product intent (for the AI)

- **Today:** The Next.js dashboard (`dashboard/`) provides an operator-style shell: overview, architecture, fault simulation, alarm lab, alerts, maintenance, and AI analytics. **Motion, time series, KPIs, and charts** are **mock-driven** via `PlantSimulationContext` and `mockTelemetry.ts` unless you add new wiring (e.g. static JSON under `public/data/`). The app does **not** call the Python FastAPI service.
- **Near-term user goals:** Add more notebooks (e.g. **binary classifier**, **multiclass** variants, alarm / xmeas work) and **feed their artifacts and metrics into the dashboard** so the UI reflects **real training outputs, evaluation, and inference** rather than placeholders.
- **Ask of the AI:** Propose concrete UI panels, API contracts, export scripts, and wiring steps so **findings from notebooks and `src/` code** (figures, tables, confusion matrices, per-class metrics, SHAP, calibration, drift) are **first-class** in the dashboard—not only mock charts.

---

## Dashboard structure (routes and layout)

**Stack:** Next.js app under `dashboard/src/app/(shell)/` with shared layout, `DashboardShell`, `TopNav`, `SideNav` / `MobileNav`.

**Primary routes** (from `dashboard/src/components/layout/SideNav.tsx`):

| Route | Page component | Role |
|-------|----------------|------|
| `/` | `OverviewPage` | Operations overview: stat tiles, PFD (`ProcessFlowVisual`), AI monitoring (`AIMonitoringCenter`), sensor charts (`SensorCharts`), maintenance event strip (`MaintenanceEvents`). |
| `/architecture` | `ArchitecturePage` | Static P&ID image (`public/tep_architecture_pid.png`), hotspot for xmeas_13. |
| `/simulation` | `SimulationPage` | Fault catalog, sim controls, twin tick, AI prediction stream (mock). |
| `/alarm-xmeas13` | `AlarmXmeas13Page` | EWMA / alarm logic; prefers `public/data/alarm_xmeas13_series.json`, else in-code demo model. |
| `/alerts` | `AlertsPage` | Incident list from mock library + live-style row when fault sim active. |
| `/maintenance` | `MaintenancePage` | System health % from snapshot; work-order style cards from mock recommendations. |
| `/analytics` | `AnalyticsPage` | **AI analytics & explainability:** KPIs (mock estimates), AI health copy, `AnalyticsChartsPanel` (trends, SHAP-style bars, fault probabilities — mock). |

**Global shell:** `TopNav` shows plant status, system health, AI online, notifications, sim state. Context: `dashboard/src/context/PlantSimulationContext.tsx`.

**Core types / contracts:** `dashboard/src/lib/types.ts` (`PlantSnapshot`, `SensorPoint`, `AIInsight`, events, incidents, maintenance, SHAP, fault probabilities).

---

## What “analytics” and “findings” mean in the UI today

### `/analytics` — explicit analytics surface

- **KPIs:** **Mock-derived** “model accuracy (est.)”, default **52** monitored features (TEP convention), **prediction latency** from mock snapshot (“twin estimate”), **high/critical incidents** from **mock** `incidents`.
- **AI health panel:** Static-style placeholder (SHAP stability `0.87` called out as illustrative).
- **Charts (`AnalyticsChartsPanel`):** Confidence vs anomaly **trend** from context histories; **SHAP-style** bars from `buildShapImportance()`; **fault family probabilities** from `buildFaultProbabilities()` — all mock unless you replace the data source.

### Other pages — operator “findings” (mostly mock or static)

- **Overview:** `snapshot.insight` drives plant status, confidence, severity, risk, TTF, recommended actions (`buildSnapshot` / `buildFaultInsight` in `mockTelemetry.ts`). Sensor series from `generateSensorRow()`. Tiles: fault count from catalog length, XMEAS count hard-coded, open incidents from `buildIncidentLibrary()`, **Data plane** tile describes the in-browser twin.
- **Simulation:** Same twin + catalog (no external pipeline banner).
- **Alarm lab:** File-backed series when JSON present — closest to **real exported notebook / script** path for that route.
- **Alerts / maintenance:** Mock libraries (`incidents.ts`, `maintenanceData.ts`).

**Gap (important for prompts):** There is **no built-in bridge** to Python Uvicorn/FastAPI; add **static exports** or your own fetch layer when you want real metrics and series on these pages.

---

## `datasources.md` — distilled contents (full detail in repo file)

### Primary mock pipeline

- **`PlantSimulationContext.tsx`** drives timers and calls: `buildSnapshot()`, `generateSensorRow()`, `seedFaultEvents()`, `buildIncidentLibrary()`, `buildMaintenanceRecommendations()`, `buildShapImportance()`, `buildFaultProbabilities()` from `mockTelemetry.ts`, `incidents.ts`, `maintenanceData.ts`. Catalog: `faultCatalog.ts`. Types: `types.ts`.

### Per-menu source (abbreviated)

| Area | Mostly |
|------|--------|
| TopNav plant/health, Overview AI block, Simulation AI stream, Analytics charts | Mock twin |
| Alarm xmeas_13 | JSON `public/data/alarm_xmeas13_series.json` or demo |
| Architecture | Static image + hotspot |
| Alerts, maintenance lists | Mock libraries |

### Data contracts for “real” replacement (from `datasources.md` Part 2)

Replace mocks with streams or APIs that satisfy (or extend) `types.ts`:

1. **Historian:** `SensorPoint` fields (`t`, reactor temp, pressure, flow, vibration, `anomalyScore`) + last-N history for charts.
2. **Inference:** `AIInsight` + snapshot extras (`systemHealthPct`, `aiOnline`, `anomalyIndex`, `predictionLatencyMs`).
3. **Events:** `PlantEvent[]`.
4. **Incidents:** `IncidentRecord[]`.
5. **Maintenance:** `MaintenanceRecommendation[]`.
6. **Explainability:** `ShapFeature[]`, `FaultClassProbability[]`.
7. **Analytics histories:** aligned `confidenceHistory` / `anomalyHistory` from TSDB or batch jobs.
8. **Alarm lab:** keep or serve JSON shape expected by `alarmXmeas13Model.ts` (see `scripts/export_alarm_xmeas13_dashboard.py` in doc).
9. **Conceptual backend:** historian, inference, events, incidents/CMMS, attribution (+ histories).

### Quick reference: mock vs real vs static

| Kind | Examples |
|------|-----------|
| Mock twin | Most live numbers and charts on Overview, Simulation, Analytics trends |
| Mock libraries | Incidents, maintenance, seeded events |
| Static / catalog | `faultCatalog.ts`, architecture asset, some copy |
| Future wiring | Your own HTTP service or static JSON under `public/data/` (dashboard does not ship FastAPI client code). |
| File-backed | `alarm_xmeas13_series.json` (+ optional GIF) |

---

## Flowchart stages vs codebase (`CODING_AND_FLOWCHART_STAGES.md`)

Reference flowchart layers: physical plant → data → AI classification → operator UI.

### What the repo implements (summary table)

| Area | Implementation |
|------|----------------|
| Data | TEP from `.RData`, parquet cache, subsample per fault, fault-injection time respected (`src/data_loader.py`, `src/config.py`). |
| Features | 52 columns: 41 XMEAS + 11 XMV; target `faultNumber`. |
| Preprocessing | Median impute, `StandardScaler` on train, alignment, audit CSVs (`src/preprocessing.py`). |
| EDA | `src/eda.py`, `src/pipeline.py`. |
| Models | Random Forest + XGBoost **multiclass** (`src/models.py`). |
| Evaluation | Accuracy, macro/weighted F1, per-class report, confusion matrices (`src/evaluation.py`). |
| Explainability | Feature importance, optional SHAP (`src/explainability.py`). |
| Inference / alerts | `predict_proba` → class → `FactoryAlert` (`src/simulation.py`). |
| Orchestration | `python -m src.pipeline` (`src/pipeline.py`). |
| API | FastAPI `api/main.py`. |
| Notebook | `notebooks/tep_pipeline.ipynb`. |
| Dashboard | Next.js; **live feel** is **mock** in-repo; extend with static exports or your own data layer. |

### Flowchart block mapping

| Flowchart block | In code? | Notes |
|-----------------|----------|--------|
| Physical plant / sensors | No (benchmark only) | TEP data, not live DCS. |
| 52 TEP variables | Yes | `FEATURE_COLUMNS` in `src/config.py`. |
| Preprocessing | Yes | No sliding window in cited module (extension possible). |
| **Stage 1: Binary fault / no fault** | Implicit only | Same multiclass head; **no separate binary classifier** in core pipeline. |
| **Stage 2a: Multiclass fault type** | **Yes (main ML)** | RF + XGBoost, eval, API, alerts. |
| **Stage 2b: Health from P(fault)** | Partial | Python alerts use catalog severity → status; dedicated `(1 − P(fault))` health not central; dashboard health largely mock. |
| **Stage 3: Risk score fusion** | Yes | `risk_score = confidence × severity_weight`, `risk_level` in `FactoryAlert` (`src/simulation.py`, `src/config.py`). |
| Operator UI | FastAPI + Next.js | Role analogous to Streamlit in diagram. |

**One-line summary:** Data + preprocessing + **Stage 2a** + **Stage 3** are implemented in Python; **Stage 1** is folded into multiclass; **Stage 2b** is only partially aligned; dashboard twin is mostly mock.

### Files reviewers / AI should cite

`src/pipeline.py`, `src/models.py`, `src/preprocessing.py`, `src/data_loader.py`, `src/config.py`, `src/simulation.py`, `api/main.py`, `notebooks/tep_pipeline.ipynb`.

---

## Instructions to the AI (copy-paste block)

When helping extend this project, please:

1. **Respect existing contracts** in `dashboard/src/lib/types.ts` and `datasources.md`; prefer **versioned JSON under `public/data/`** or explicit new data hooks over breaking the UI silently.
2. **Distinguish mock vs real** in any new UI (labels, tooltips, empty states) so operators know whether a panel shows **notebook exports**, **API live inference**, or **simulation**.
3. For **new notebooks** (binary classifier, separate multiclass experiments, calibration, drift): propose **export artifacts** (paths, schemas) and **minimal dashboard surfaces** (e.g. new route `/analytics/binary`, confusion matrix component, PR curves, reliability diagrams, per-class F1 from JSON).
4. Suggest how to load **run-scoped** results via **static files under `public/data/`** (or a small Next.js route handler / external gateway you add) without requiring the twin loop to fake metrics.
5. Call out **security and ops** briefly if adding file upload or arbitrary JSON: validation, size limits, CORS.
6. **Give prioritized suggestions** (quick wins vs larger refactors) for displaying **notebook findings and code outputs** instead of relying entirely on **mock data**—including export formats from notebooks, optional Python-side services if desired, and which dashboard components to add or refactor.

---

## Suggestion seeds (optional; AI should expand)

The AI may consider: embedding **confusion matrix heatmaps** and **per-class metrics** from `outputs/reports/` copied into `public/data/`; a **run selector** when multiple pipeline runs exist; **binary vs multiclass** model tabs driven by JSON metadata; driving `confidenceHistory` / fault probabilities from **replay JSON** or your own inference client; **SHAP** PNG or JSON from `explainability` into Analytics; **notebook 04a_Binary_Classifier** outputs as a dedicated data source mirroring the alarm-lab JSON pattern; drift and **data quality** panels from preprocessing audit CSVs; **latency** samples if you add a real predict path.

---

*Generated for use as LLM context. Update when routes, `types.ts`, or `datasources.md` change. Canonical path map: `datasources.md`. Flowchart alignment: `CODING_AND_FLOWCHART_STAGES.md`.*
