# Overview — Dashboard Guide

**Route:** `/`  
**Nav label:** Overview  
**Source:** `dashboard/src/components/pages/OverviewPage.tsx`

---

## Purpose

The Overview is the **landing page** and operator-first summary of plant health. It answers: *How is the AI performing? What does Fault 5 look like on real test data? What should I do next?*

Use this page to open a demo: KPI tiles at the top, Fault 5 sensor figures in the middle, and a maintenance-events panel at the bottom.

---

## Page layout

```text
┌─────────────────────────────────────────────────────────────┐
│  Top bar (global): plant status · AI · health · clock       │
├─────────────────────────────────────────────────────────────┤
│  Operations overview (title + intro)                        │
├─────────────────────────────────────────────────────────────┤
│  KPI stat tiles (5 cards)                                   │
├─────────────────────────────────────────────────────────────┤
│  Fault 5 sensor traces (3 figure panels)                    │
├─────────────────────────────────────────────────────────────┤
│  Maintenance events (prototype panel)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Section 1 — KPI stat tiles

**Component:** `OverviewStatTiles`  
**Data:** Optional JSON under `dashboard/public/data/`; otherwise built-in demo values.

| Tile | What it shows | Notes |
|------|----------------|-------|
| **Missed alerts rate** | `9.9%` | Binary detector metric at threshold 0.42 |
| **Detection accuracy** | `92.5%` | Multiclass fault identifier on 21 fault types (test split) |
| **False alarms** | `3%` | How often the model alerts when the plant is healthy |
| **Fault types monitored** | `20` | Links to **Fault simulation** (`/simulation`) |
| **Open actions** | Dynamic count | Links to **Alerts** (`/alerts`). If incidents are loaded, counts unchecked checklist steps on unacknowledged incidents; otherwise shows demo count from `binary_results.json` |

**Publishing real metrics:** Export notebook results to:

- `public/data/binary_results.json` — binary champion metrics, recall, last alert time
- `public/data/multiclass_results.json` — multiclass champion metrics, per-class recall

Tiles show a badge like `Model data · last run <date>` when JSON is present; otherwise `Simulated · demo mode`.

---

## Section 2 — Fault 5 sensor traces

**Component:** `Fault5SensorFigures`  
**Fault:** IDV(5) — *condenser cooling water inlet temperature step* (TEP benchmark)  
**Injection sample:** `161` (`FAULT5_TEP_ONSET_SAMPLE`)

Three static charts (PNG) compare **tep_test run 78** (clean hero) vs **normal run 1**:

| Figure | Tag | Signal |
|--------|-----|--------|
| Compressor CW outlet | XMEAS_22 | Cooling-water side effect |
| Reactor feed flow | XMEAS_11 | Downstream process response |
| Condenser CW flow | XMV_11 | PID / manipulated variable |

Charts use a **10-sample rolling mean**. Assets live at `dashboard/public/data/fault5/` (e.g. `08_xmeas_22_run78_vs_normal.png`).

**Talking point:** Run 78 is the “best case” — alert at injection with no pre-fault false alarms. This ties directly to **Maintenance** work orders and **Fault simulation** when Fault 5 replay is enabled.

---

## Section 3 — Maintenance events

**Component:** `MaintenanceEvents`  
**Status:** Prototype placeholder — panel title only; event log rows are currently commented out in code.

When enabled, this panel would show a scrollable **event log** built from multiclass `per_class` recall (e.g. “hardest fault to detect” narrative). The logic exists in `lib/eventLog.ts` and `hardestFaultSentence()`.

---

## Global chrome (visible on every page)

**TopNav** shows:

- **Plant** status (NORMAL / WARNING / CRITICAL) from live simulation state
- **AI status** ONLINE vs STANDBY
- **System health** percentage (color-coded)
- Live clock, **Control room** link → `/simulation`
- Notification bell with count of unacknowledged incidents

When a simulation is running, an orange **Sim active** badge appears next to the title.

---

## Data & notebook links

| Artifact | Role |
|----------|------|
| `data/processed/tep_test.csv` | Source for Fault 5 figures and maintenance cases |
| `tep_notebook_dashboard.json` | Optional bundle: incidents, maintenance, telemetry (04a/04b export) |
| Notebooks `04a` / `04b` | Train/evaluate binary + multiclass champions |

---

## Related pages

- [simulation_dash.md](./simulation_dash.md) — inject faults and live charts  
- [maintenance_dash.md](./maintenance_dash.md) — Fault 5 work orders (runs 78, 148)  
- [alerts_dash.md](./alerts_dash.md) — incidents and operator checklists

---

## Presentation walkthrough script (spoken)

*~2–3 minutes. Start on Overview (`/`). Point at the screen as you go.*

---

**[Open the app — land on Overview]**

“Okay, so this is where we land when we open the dashboard — **Operations overview**. Think of it as the morning briefing screen for the plant: how healthy are we, how is the AI doing, and what should an operator look at first?

Up in the top bar you’ll see **plant status**, **AI online**, and **system health** — that’s shared across every page, so if we kick off a simulation later, you’ll see those numbers change everywhere.

**[Gesture to the five KPI tiles]**

These five tiles are our headline numbers.

First — **missed alerts rate**, about ten percent at our chosen threshold. That’s the cost of being conservative: some real faults slip through. Next — **detection accuracy**, ninety-two and a half percent across twenty-one fault types on the test set. That’s our multiclass ‘what fault is it?’ model.

**False alarms** — three percent. That’s the other side of the trade-off: how often we bother the operator when nothing’s actually wrong. In a real plant, that number is money and trust, so we show it explicitly.

**Fault types monitored** — twenty. If I click here, we jump to the control room where we can inject any of those benchmark faults.

And **open actions** — this ties to the Alerts page. It’s not just ‘how many alarms’; it’s how many checklist steps are still unchecked on live incidents. We’ll come back to that.

**[Scroll down to Fault 5 sensor traces]**

Below the KPIs we’re not showing generic placeholders — we pulled real traces from **tep_test**, Fault **5**: a step change on **condenser cooling water inlet temperature**.

See the vertical story at sample **161** — that’s when the fault is injected in the benchmark. Run **78** is our ‘clean hero’: the model fires right at injection with no nuisance alarms beforehand.

We’ve got three panels: compressor cooling water outlet, reactor feed flow, and the condenser CW valve — **XMEAS_22**, **XMEAS_11**, and **XMV_11**. Same fault, different parts of the plant reacting. This is what we mean by connecting ML to process knowledge, not just a single score.

**[Bottom panel — maintenance events]**

This bottom section is a prototype maintenance event log — the idea is a scrolling timeline of ‘hardest fault to catch’ and similar insights from the notebook export. Right now it’s a shell, but on **Maintenance** you’ll see the full work-order story for Fault 5.

**[Close]**

So Overview answers: *Are we okay? How good is the AI? What does a real fault look like on real data?* From here I usually go either to **Fault simulation** to show something live, or **Maintenance** to show what we’d actually send to the field. Questions on this page before we move on?”
