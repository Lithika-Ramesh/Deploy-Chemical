# TEP Command Dashboard — Menu Documentation Index

Presentation and onboarding docs for each sidebar menu in the **AIFI · TEP Command** dashboard (`dashboard/`).

## Run the app

```bash
cd dashboard
npm install
npm run dev
```

Open **http://localhost:3000**

## Menu documentation

| Nav label | Route | Doc file | Spoken script |
|-----------|-------|----------|----------------|
| Overview | `/` | [overview_dash.md](./overview_dash.md) | ~2–3 min |
| Architecture | `/architecture` | [architecture_dash.md](./architecture_dash.md) | ~1–2 min |
| Fault simulation | `/simulation` | [simulation_dash.md](./simulation_dash.md) | ~2–3 min |
| Alarm lab (xmeas_13) | `/alarm-xmeas13` | [alarm_xmeas13_dash.md](./alarm_xmeas13_dash.md) | ~3–4 min |
| Alerts & incidents | `/alerts` | [alerts_dash.md](./alerts_dash.md) | ~2–3 min |
| Maintenance | `/maintenance` | [maintenance_dash.md](./maintenance_dash.md) | ~3 min |

Each doc ends with **Presentation walkthrough script (spoken)** — first-person narration with `[stage directions]` for clicks and scrolling.

## Suggested presentation flow

1. **Overview** — KPIs + Fault 5 sensor story  
2. **Architecture** — P&ID → click through to alarm lab  
3. **Alarm lab** — EWMA / deadband engineering depth  
4. **Fault simulation** — live twin + Fault 13 replay (if JSON present)  
5. **Alerts** — SOC checklist workflow  
6. **Maintenance** — work orders + run 78 vs 171 figures  

## Other docs in this folder

- [NAVIGATION_AND_FLOW.md](./NAVIGATION_AND_FLOW.md) — site map, global context, first-day onboarding  
- [FROM_NOTEBOOK_TO_NEXTJS_DASHBOARD.md](./FROM_NOTEBOOK_TO_NEXTJS_DASHBOARD.md) — export pipeline from notebooks to `public/data/`

## Global UI (all pages)

- **Side nav** — `dashboard/src/components/layout/SideNav.tsx`  
- **Top bar** — plant status, AI online, system health, notifications (`TopNav.tsx`)  
- **Shared state** — `PlantSimulationProvider` (mock twin); optional `NotebookDashboardContext` (JSON bundle)
