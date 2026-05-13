# Dashboard data sources & path to real data

This document combines (1) where each menu’s analytics come from today and (2) what data contracts you need to replace mocks with production sources.

**Primary mock pipeline:** `dashboard/src/context/PlantSimulationContext.tsx` drives timers and calls `buildSnapshot()`, `generateSensorRow()`, `seedFaultEvents()`, `buildIncidentLibrary()`, `buildMaintenanceRecommendations()`, `buildShapImportance()`, and `buildFaultProbabilities()` in `dashboard/src/lib/mockTelemetry.ts`, `dashboard/src/lib/incidents.ts`, and `dashboard/src/lib/maintenanceData.ts` (see imports in context). Catalog copy lives in `dashboard/src/lib/faultCatalog.ts`. UI types: `dashboard/src/lib/types.ts`.

**Optional API:** `NEXT_PUBLIC_AIFI_API_URL` → `dashboard/src/lib/api.ts`. On load, `PlantSimulationContext.tsx` calls **`GET /health`** (TopNav API chip) and **`GET /metrics`** (same JSON as `outputs/reports/manifest.json` from `python -m src.pipeline` / `tep_pipeline.ipynb`). Parsed manifest is exposed as **`pipelineManifest`** and powers **Overview “Data plane” hints**, **AI analytics** KPIs + evaluation table + AI health copy, and a **Fault simulation** banner when the API is reachable. It does **not** replace mock sensor time series or chart trends yet. **`fetchMetrics`** is used from context (not only an unused import).

### Changelog — pipeline manifest wiring (dashboard)

| Change | Files |
|--------|--------|
| Parse `/metrics` manifest | `dashboard/src/lib/pipelineManifest.ts` |
| Fetch `/health` + `/metrics` on mount when API URL set; expose `pipelineManifest` | `dashboard/src/context/PlantSimulationContext.tsx` |
| Real held-out accuracy + feature count + evaluation table + dynamic AI health text | `dashboard/src/components/pages/AnalyticsPage.tsx` |
| Data plane tile hint shows best model / F1 when manifest present | `dashboard/src/components/dashboard/OverviewStatTiles.tsx` |
| Banner when trained model manifest available | `dashboard/src/components/pages/SimulationPage.tsx` |
| **Unchanged** | **`AlarmXmeas13Page.tsx`** and alarm JSON/GIF flow |

---

## Part 1 — Current source map (by menu)

### Global (all routes): top bar & shell

| Location | Data / UI | Source today | Files / notes |
|----------|-------------|----------------|-----------------|
| **TopNav** | Plant status, system health % | Mock twin | `TopNav.tsx` ← `snapshot` ← `buildSnapshot()` in `mockTelemetry.ts` |
| **TopNav** | AI ONLINE | Constant | `buildSnapshot()` sets `aiOnline: true` |
| **TopNav** | API LINKED / LOCAL (chip if configured) | HTTP | `PlantSimulationContext.tsx` → `fetchApiHealth()` in `api.ts` |
| **TopNav** | Clock | Browser | `TopNav.tsx` (`useClock`) |
| **TopNav** | Bell badge count | Derived mock | `notificationCount` in `PlantSimulationContext.tsx` |
| **TopNav** | “Sim active” | UI state | `simulationRunning` |
| **DashboardShell** | Fault-sim top strip | UI + mock status | `DashboardShell.tsx` + `snapshot.insight.plantStatus` |

### Overview (`/`)

| Section | Data | Source today | Files / notes |
|---------|------|--------------|----------------|
| **OverviewStatTiles** | Fault count (7) | Static catalog | `OverviewStatTiles.tsx` → `FAULT_ORDER.length` in `faultCatalog.ts` |
| **OverviewStatTiles** | XMEAS channels (41) | Hard-coded | `OverviewStatTiles.tsx` (TEP convention) |
| **OverviewStatTiles** | Open incidents | Mock | `buildIncidentLibrary()` in `incidents.ts` |
| **OverviewStatTiles** | Plant status / hint | Mock | `snapshot.insight` from `buildSnapshot()` |
| **OverviewStatTiles** | Twin stream, tick, buffer % | Mock + UI | `PlantSimulationContext.tsx`; buffer uses `HISTORY_CAP` (48) in tiles |
| **OverviewStatTiles** | Data plane label + hint | Env + HTTP + **pipeline manifest** | `apiReachable` + `pipelineManifest` from `GET /metrics` via `PlantSimulationContext.tsx` / `fetchMetrics` in `api.ts` |
| **ProcessFlowVisual** | PFD colors / stress | Mock + catalog | `ProcessFlowVisual.tsx` + `FAULT_CATALOG[selectedFaultId].visual` |
| **AIMonitoringCenter** | Confidence, severity, risk, TTF, actions, systems | Mock | `snapshot.insight` (`NORMAL_INSIGHT` / `buildFaultInsight()` in `mockTelemetry.ts`) |
| **SensorCharts** | Temp, pressure, flow, vibration, anomaly series | Mock | `SensorCharts.tsx` ← `history` / `snapshot.sensors` ← `generateSensorRow()` |
| **MaintenanceEvents** | Event list | Mock | `seedFaultEvents()` in `mockTelemetry.ts` |

### Architecture (`/architecture`)

| Data / UI | Source today | Files / notes |
|-----------|----------------|----------------|
| P&ID image | Static asset | `dashboard/public/tep_architecture_pid.png`; `ArchitecturePage.tsx` |
| Hotspot / pulse | Hard-coded UI | `XMEAS_13_HOTSPOT` in `ArchitecturePage.tsx` |

### Fault simulation (`/simulation`)

| Data / UI | Source today | Files / notes |
|-----------|----------------|----------------|
| Fault labels | Catalog | `SimulationPage.tsx` → `faultCatalog.ts` |
| Controls (severity, emergency, start/pause/reset) | UI state | `PlantSimulationContext.tsx` |
| Twin tick | Mock clock | `advanceMockTick()` / `getSimulationTick()` in `mockTelemetry.ts` |
| **Pipeline model banner** | **`GET /metrics`** when best model present and API healthy | `SimulationPage.tsx` |
| AI prediction stream (confidence, anomaly index, risk, latency, TTF, status) | Mock | `snapshot` from `buildSnapshot()` |
| PFD + sensor charts | Mock | Same as overview |

### Alarm lab — xmeas_13 (`/alarm-xmeas13`)

| Data / UI | Source today | Files / notes |
|-----------|----------------|----------------|
| EWMA / alarm / series | JSON (if present) else in-code demo | `AlarmXmeas13Page.tsx` → `fetch("/data/alarm_xmeas13_series.json")` → `alarmXmeas13Model.ts`; fallback `buildDemoAlarmXmeas13Model()` |
| Tuning table | Code constants | `TUNING` in `alarmXmeas13Model.ts` |
| GIF (optional) | Static file | `dashboard/public/alarm_xmeas13_deadband.gif` |

### Alerts & incidents (`/alerts`)

| Data / UI | Source today | Files / notes |
|-----------|----------------|----------------|
| Incident rows | Mock library | `AlertsPage.tsx` → `buildIncidentLibrary()` in `incidents.ts` (+ live row when fault sim on) |
| Subsystem filter options | Static list | `INCIDENT_SUBSYSTEMS` in `incidents.ts` |

### Maintenance (`/maintenance`)

| Data / UI | Source today | Files / notes |
|-----------|----------------|----------------|
| Header health % | Mock | `snapshot.systemHealthPct` from `buildSnapshot()` |
| Work order cards | Mock | `buildMaintenanceRecommendations()` in `maintenanceData.ts` |

### AI analytics (`/analytics`)

| Data / UI | Source today | Files / notes |
|-----------|----------------|----------------|
| KPI “Test accuracy (held-out)” / feature count | **FastAPI `/metrics`** when manifest parses; else mock formula | `AnalyticsPage.tsx` + `pipelineManifest` from context |
| KPI prediction latency | Mock | `snapshot.predictionLatencyMs` (label notes twin estimate) |
| KPI high/critical incidents | Mock | `incidents` count |
| **Multiclass evaluation table** | **`GET /metrics`** `results[]` when present | `AnalyticsPage.tsx` |
| AI health panel copy | **Manifest** when present; else static placeholder | `AnalyticsPage.tsx` |
| Charts: confidence vs anomaly trend | Mock history | `AnalyticsChartsPanel.tsx` ← context histories |
| Charts: fault probabilities | Mock | `buildFaultProbabilities()` in `mockTelemetry.ts` |
| Charts: SHAP-style bars | Mock | `buildShapImportance()` in `mockTelemetry.ts` |

---

## Part 2 — What you need for “actual” data (summary)

Replace the mock twin with **real feeds** that satisfy the same (or explicitly updated) TypeScript contracts in `dashboard/src/lib/types.ts`.

### 1. Process / historian (`SensorPoint` + time series)

Per sample (or latest + history for charts):

| Field | Role |
|-------|------|
| `t` | Time index or timestamp |
| `reactorTemp` | Temperature (°C) |
| `separatorPressure` | Pressure (kPa); aligns with notebook `xmeas_13` family |
| `flowRate` | Flow (kg/s) |
| `vibration` | Vibration (g) |
| `anomalyScore` | Model / MV anomaly (0–1, consistent with your detector) |

**Also:** a **stream or query** (poll, SSE, WebSocket, or historian API) for last *N* points — charts are not useful with only `setInterval` + `generateSensorRow`.

### 2. Inference / twin (`AIInsight` + extra snapshot fields)

Each cycle (or paired with each process sample):

| Group | Fields |
|-------|--------|
| **Insight** | `plantStatus`, `detectedFault`, `faultId`, `confidencePct`, `severity`, `maintenanceRisk`, `riskScore`, `riskLevel`, `failureWindowMinutes`, `recommendedAction`, `actionDetail`, `affectedSystems` |
| **Snapshot extras** | `systemHealthPct`, `aiOnline`, `anomalyIndex`, `predictionLatencyMs` |

**Note:** `faultId` today is `FaultId` from `faultCatalog.ts`; real systems often need a **mapping** from your fault codes to UI/catalog.

### 3. Events (`PlantEvent[]`)

| Field | Role |
|-------|------|
| `id`, `ts`, `kind`, `title`, `detail`, `severity` | Alarm journal, SOE, tickets, ML alerts, logs |

### 4. Incidents (`IncidentRecord[]`)

| Field | Role |
|-------|------|
| `id`, `ts`, `severity`, `subsystem`, `title`, `diagnosis`, `recommendedAction`, `faultId`, `acknowledged` | SOC / DCS history / incident management |

### 5. Maintenance (`MaintenanceRecommendation[]`)

| Field | Role |
|-------|------|
| `id`, `equipment`, `issue`, `risk`, `impact`, `steps[]`, `urgency`, `failureWindowMinutes`, `progressPct`, `faultId` | CMMS / EAM |

### 6. Explainability charts

| Type | Fields | Role |
|------|--------|------|
| `ShapFeature` | `tag`, `value` | Feature attribution from model service |
| `FaultClassProbability` | `fault`, `pct` | Softmax / calibrated class probabilities |

### 7. Analytics histories

Aligned time series for:

- Model **confidence** (or your chosen metric),
- **Anomaly** (same definition as chart anomaly or a dedicated series),

so `confidenceHistory` / `anomalyHistory` can be filled from a TSDB or batch job instead of the context tick loop.

### 8. Alarm lab (already file-friendly)

- Keep or serve **`alarm_xmeas13_series.json`** (shape expected by `alarmModelFromSeriesJson` in `alarmXmeas13Model.ts`) and optional GIF.
- Optionally move **tuning** (`TUNING`) to a config API/DB if operators change deadbands.

### 9. Architecture

- **Tag registry** (e.g. which measurement = `xmeas_13`) and optional **live value** next to the P&ID.
- Hotspot coordinates can stay static or be driven by config.

### 10. Hardcoded KPIs / copy to replace

| Item | Replace with |
|------|----------------|
| “41 XMEAS” / default **52** feature KPI | Already overridden when **`pipelineManifest.featureCount`** is present (`GET /metrics`); fully custom counts still need config if schema changes. |
| Analytics accuracy KPI | **Done when API + manifest:** held-out test accuracy from best model row; else mock formula. |
| “SHAP stability 0.87” text | **Replaced when manifest present** with dataset / best-model summary; optional future: real drift index. |

### 11. Fault simulation (optional “real” mode)

- **Replay** of recorded runs, or **live OPC / simulator** with a documented **scenario ↔ fault** map (may extend beyond current `FaultId`).

### 12. Minimal backend surface (conceptual)

Five streams (one gateway or multiple services):

1. **Historian / tags** → process + anomaly inputs.  
2. **Inference** → `AIInsight` + latency + online + `anomalyIndex`.  
3. **Events** → `PlantEvent[]`.  
4. **Incidents + CMMS** → `IncidentRecord[]` + `MaintenanceRecommendation[]`.  
5. **Attribution** → `ShapFeature[]` + `FaultClassProbability[]` (+ histories for analytics).

**Contract reference:** `PlantSnapshot`, `SensorPoint`, `AIInsight`, `PlantEvent`, `IncidentRecord`, `MaintenanceRecommendation`, `ShapFeature`, `FaultClassProbability` in `dashboard/src/lib/types.ts`; alarm JSON in `dashboard/src/lib/alarmXmeas13Model.ts` + `scripts/export_alarm_xmeas13_dashboard.py`.

---

## Quick reference: mock vs real vs static

| Kind | Examples |
|------|-----------|
| **Mock twin** | Most numbers on Overview, Simulation, Analytics charts, TopNav plant/health (from `mockTelemetry.ts` + context). |
| **Mock libraries** | Incidents (`incidents.ts`), maintenance cards (`maintenanceData.ts`), events (`seedFaultEvents`). |
| **Static / catalog** | `faultCatalog.ts`, architecture image + hotspot, overview “41”; analytics default **52** only when manifest has no `feature_columns`. |
| **Static copy** | Analytics AI health placeholder only when **`pipelineManifest`** is null. |
| **Optional HTTP** | **`/health`** (chip) + **`/metrics`** (multiclass manifest → context `pipelineManifest`). **`/predict`**, **`/simulate`**, **`/demo`** not yet consumed by Next.js pages. |
| **File-backed (alarm lab)** | `public/data/alarm_xmeas13_series.json` + optional GIF. |

---

*Last aligned with dashboard layout and libs in the AIFI-group_project repo. Update this file when you add new routes or change `types.ts` contracts.*
