# Fault Simulation — Dashboard Guide

**Route:** `/simulation`  
**Nav label:** Fault simulation  
**Source:** `dashboard/src/components/pages/SimulationPage.tsx`

---

## Purpose

The Fault simulation page is the **control room** for the in-browser digital twin. Operators (or demo presenters) can:

1. Select any **TEP benchmark fault** (IDs 0–20)
2. Stage **severity** (1–5)
3. **Start / pause / resume / reset** the simulation
4. Watch **live sensor charts** and AI anomaly scores update in real time

Global plant state (`PlantSimulationProvider`) updates immediately — other pages (Overview top bar, Alerts) reflect the same twin.

---

## Page layout

```text
┌──────────────────────────┬──────────────────────────────────┐
│  Scenario builder        │  Live sensor analytics             │
│  · Fault dropdown        │  (Recharts — 4 traces + anomaly)   │
│  · Severity slider       │                                  │
│  · Start/Pause/Reset     │                                  │
│  · Affected systems      │                                  │
└──────────────────────────┴──────────────────────────────────┘
         (fixed “Live simulation” badge when running — desktop)
```

On smaller screens the layout stacks vertically.

---

## Scenario builder

### Fault type dropdown

All faults come from `lib/faultCatalog.ts` — canonical Tennessee Eastman definitions (Lyman & Georgakis / Downs & Vogel).

| ID | Example label | Type |
|----|----------------|------|
| 0 | Normal behavior | None |
| 1 | A/C feed ratio | Step |
| 5 | Condenser CW inlet T | Step |
| 13 | Reactor kinetics | Slow drift |
| … | … | … |

Each entry includes **affected systems** (e.g. feed header, separator, compressor) shown in a summary box below the controls.

### Severity stage (1–5)

Slider scales how aggressively the twin perturbs sensors and raises risk scores. Higher severity → faster anomaly index growth and more critical plant status.

### Transport controls

| Button | Behavior |
|--------|----------|
| **Start** | Begins simulation tick loop |
| **Pause** | Freezes state; **Resume** appears |
| **Reset** | Clears history, returns to nominal |

While running (and not paused), fault selection is disabled.

### Fault 13 special mode — real data replay

When `public/data/fault13_replay.json` exists:

- Select **Fault 13** and press **Start**
- Dashboard replays **tep_test run 1** with real **binary/multiclass scores** (~5 samples/s)
- Progress shown: `Sample current/total`
- Charts switch to **XMEAS_9** (reactor temp), **XMV_10** (reactor CW), **P(fault)** anomaly line

**Export script:** `scripts/export_fault13_replay.py`  
If the file is missing, a yellow hint appears in the page header.

---

## Live sensor analytics

**Component:** `SensorCharts` (client-only dynamic import)

### Data sources (priority order)

1. **Fault 13 replay** — when active, uses `fault13ReplayPayload` arrays
2. **Notebook telemetry** — if `tep_notebook_dashboard.json` includes `telemetry[]`
3. **Mock twin** — `PlantSimulationContext` history buffer (default)

### Chart traces

| Series | Typical meaning (mock mode) |
|--------|-----------------------------|
| Reactor temperature | Exotherm / reactor health |
| Separator pressure | Level & pressure coupling |
| Flow rate | Throughput |
| Vibration | Mechanical stress proxy |
| Anomaly score (shaded) | AI fault probability or risk proxy |

Subtitle under the panel changes to describe the active mode (simulated historian vs notebook vs Fault 13 replay).

---

## Commented / hidden UI (code present, not shown)

The following blocks exist in source but are **commented out** for a slimmer demo:

- **AI prediction stream** — confidence, anomaly index, latency, plant status, TTF
- **+Severity** and **Emergency mode** buttons
- **Notebook benchmark** table — multiclass comparison + binary AUC

Re-enable in `SimulationPage.tsx` if the presentation needs model metrics on this page.

---

## Global integration

| Consumer | What updates |
|----------|----------------|
| `TopNav` | Plant status, health %, “Sim active” badge |
| `/alerts` | New incidents generated from simulation config |
| `/maintenance` | Work orders tied to twin health (non–Fault-5 mode) |

**Digital twin tick:** Shown in page subtitle (seconds counter from context).

---

## Key files

| Path | Role |
|------|------|
| `src/context/PlantSimulationContext.tsx` | Twin state machine |
| `src/lib/faultCatalog.ts` | Fault definitions |
| `src/lib/mockTelemetry.ts` | Synthetic sensor physics |
| `src/lib/fault13Replay.ts` | Replay payload types |
| `public/data/fault13_replay.json` | Optional real replay |

---

## Related pages

- [overview_dash.md](./overview_dash.md) — KPI entry point  
- [alerts_dash.md](./alerts_dash.md) — incidents from simulation  
- [alarm_xmeas13_dash.md](./alarm_xmeas13_dash.md) — dedicated xmeas_13 alarm engineering view  
- [maintenance_dash.md](./maintenance_dash.md) — Fault 5 case studies (link from maintenance header)

---

## Presentation walkthrough script (spoken)

*~2–3 minutes. Sidebar → **Fault simulation**. Optional: run Fault 13 if `fault13_replay.json` is present.*

---

**[Click Fault simulation — point to ‘Sim active’ badge when it appears]**

“This is our **control room** — **Fault simulation**. Everything on the left is ‘what if’; everything on the right is ‘what do I see in the historian.’

**[Left panel — Scenario builder]**

In the **scenario builder** we pick a **fault type** from the Tennessee Eastman catalog — faults zero through twenty, same definitions you’ll see in papers and in our notebooks. Zero is normal; five is the condenser cooling water temperature step; thirteen is reactor kinetics — and so on.

When I change the fault, this box updates: **affected systems**. That’s not decoration — it’s tied to our fault catalog so the UI speaks in process language, not just ‘class ID 5.’

**[Drag severity slider]**

**Severity** is one to five. Think of it as how hard we push the twin — higher severity, faster drift on the charts, angrier plant status in the top bar.

**[Select Fault 5 or 13, severity 3]**

I’ll pick **Fault 5** for something the team knows from Maintenance — or **Fault 13** if we exported the replay file.

**[Click Start — point to top bar and charts]**

Hit **Start**…

Notice **Sim active** in the header, plant status shifting, health percentage moving. The twin tick counter in the subtitle is advancing — it’s a discrete-time simulation in the browser, no server required for the demo.

**[Right panel — Live sensor analytics]**

On the right, **live sensor analytics**: reactor temperature, separator pressure, flow, vibration, and the shaded **anomaly** trace. In mock mode this is synthetic but physically plausible. If we’re on **Fault 13 replay**, these lines are **real test data** — reactor temp and CW valve from **tep_test**, and the anomaly line is our model’s **P(fault)** stepping through the run sample by sample. You’ll see a sample counter in the header when that’s live.

**[Pause, then Resume — optional Reset]**

We can **pause** without losing state — useful if you’re explaining a spike — **resume**, or **reset** back to nominal.

**[Gesture to bottom-right ‘Live simulation’ pill on desktop]**

When it’s running, this little badge reminds the audience we’re not looking at yesterday’s batch — it’s ‘live’ relative to the twin.

**[Transition line]**

The important design point: this state is **global**. If I switch to **Alerts** now, I’ll see incidents that match what we just injected. Overview’s health chips update too. One twin, many views — that’s how we’d wire a real deployment.

**[Close — optional next step]**

Who wants to see me run Fault 13 on real scores, or jump to **Alerts** and walk an incident checklist?”
