# Alerts & Incidents — Dashboard Guide

**Route:** `/alerts`  
**Nav label:** Alerts & incidents  
**Source:** `dashboard/src/components/pages/AlertsPage.tsx`

---

## Purpose

This page is the **industrial SOC (security operations center) view** for the twin: active warnings, historical incidents, AI diagnoses, recommended actions, and **operator checklists**.

It supports filtering and search so presenters can focus on critical, unacknowledged events during a live demo.

---

## Page layout

```text
┌─────────────────────────────────────────────────────────────┐
│  Alerts & incidents (title)                                 │
├─────────────────────────────────────────────────────────────┤
│  Incident filters: severity · subsystem · search            │
├─────────────────────────────────────────────────────────────┤
│  Summary line: count · unacked · checklist steps remaining  │
├─────────────────────────────────────────────────────────────┤
│  Incident cards (expandable) × N                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Incident data sources

| Priority | Source | When |
|----------|--------|------|
| 1 | `tep_notebook_dashboard.json` | Notebook export (04a/04b) — green banner in header |
| 2 | `PlantSimulationContext` | Built-in library + incidents created during simulation |

Notebook incidents override mock/sim incidents when the bundle is loaded.

---

## Filters panel

| Filter | Options |
|--------|---------|
| **Severity** | ALL, CRITICAL, HIGH, MEDIUM, LOW |
| **Subsystem** | All, or one of: Reactor train, Separator V-204, Feed header, Compressor K-101, Utilities / CW, DCS / Analytics |
| **Search** | Free text across title, diagnosis, recommended action |

List is sorted **newest first** by timestamp.

---

## Summary line

Shows:

- Number of incidents in the filtered view
- **Unacknowledged** count in view
- **Checklist steps left** in view vs **fleet-wide** (all incidents, ignoring filters)

Checklist progress is stored in browser `localStorage` via `IncidentChecklistContext` (persists across refresh for demo continuity).

---

## Incident card anatomy

Each card is a collapsible article:

### Header (always visible)

- **Severity badge** — CRITICAL pulses with red glow animation
- **Title** — Orbitron font, operator-facing headline
- **Timestamp** + **subsystem**
- Chevron to expand/collapse

### Operator checklist (unacknowledged only)

Shown when `acknowledged === false`:

- Default steps from `lib/incidentChecklist.ts` (e.g. check CW inlet temperature, inspect CWS line, monitor separator pressure)
- Per-incident custom `checklist[]` if provided in data
- Checkboxes ticked in UI — progress `done/total`
- Acknowledged incidents show: *“Record marked acknowledged — no operator checklist.”*

### Expanded details

| Field | Content |
|-------|---------|
| **AI diagnosis** | Model/ rules narrative |
| **Recommended action** | Highlighted amber call-to-action text |
| **Fault class ID** | TEP fault number when linked |

---

## Link to Overview KPI

The **Open actions** tile on Overview (`/`) counts:

- Unacknowledged incidents, and
- Remaining unchecked checklist items

…then links here. Keep a few incidents **unacknowledged** for a compelling demo number.

---

## Simulation integration

Starting a fault on **Fault simulation** can append or emphasize incidents matching `buildIncidentLibrary()` in `lib/incidents.ts` — severity and fault IDs align with `faultCatalog`.

**Demo flow:** Start Fault 5 or 13 on Simulation → navigate to Alerts → show new HIGH/CRITICAL card and walk the checklist.

---

## Exporting notebook incidents

Include an `incidents[]` array in `tep_notebook_dashboard.json` (from notebooks 04a/04b dashboard export). Fields match `IncidentRecord` in `lib/types.ts`:

- `id`, `ts`, `severity`, `subsystem`, `title`, `diagnosis`, `recommendedAction`, `faultId`, `acknowledged`, optional `checklist`

---

## Related pages

- [overview_dash.md](./overview_dash.md) — Open actions KPI  
- [simulation_dash.md](./simulation_dash.md) — generate live incidents  
- [maintenance_dash.md](./maintenance_dash.md) — longer-horizon work orders

---

## Presentation walkthrough script (spoken)

*~2–3 minutes. Best after running a simulation, or with notebook incidents loaded. Have one unacknowledged incident ready.*

---

**[Open Alerts & incidents]**

“This is our **SOC view** — **Alerts and incidents**. Not just a log file: each row is something an operator would actually respond to.

**[Point to green banner if notebook data loaded]**

If you see the green line about **`tep_notebook_dashboard.json`**, these incidents came from our notebook export — real structure, real fault IDs. Otherwise you’re seeing the built-in library plus anything the **simulation** just raised.

**[Filters panel]**

Three filters: **severity**, **subsystem**, and **search**. In a busy shift you might set severity to **HIGH**, subsystem to **Reactor train**, and search for ‘exotherm’ — the list shrinks immediately.

**[Change filters live]**

Watch the summary line update: how many incidents in view, how many **unacknowledged**, and how many **checklist steps** are still open — both in this view and fleet-wide.

**[Click an unacknowledged incident card]**

Each card opens with severity — **CRITICAL** even pulses so you can’t miss it — title, timestamp, subsystem.

For open incidents we show an **operator checklist**. These aren’t generic Lorem ipsum — check cooling water inlet temperature, inspect the supply line, watch separator pressure, schedule inspection. You tick boxes as you go; progress shows **done over total**.

That progress is **persisted in the browser** so if I refresh during a demo, our counts still make sense.

**[Expand the same card — chevron]**

Expand for the AI layer: **diagnosis** in plain language — what the model thinks is happening — and **recommended action** in amber, the thing we want a human to do next. Fault class ID links back to the Tennessee Eastman taxonomy.

Acknowledged incidents skip the checklist — the record is closed.

**[Check one box, optionally navigate to Overview]**

I’ll check one step… If we flip to **Overview**, the **Open actions** tile should reflect fewer remaining steps. That closes the loop between ‘headline KPI’ and ‘real work on the floor.’

**[Close]**

Alerts is where AI output becomes **procedure**. Maintenance is where we plan **work orders**; Alerts is ‘what do I do in the next fifteen minutes?’ Who wants to drive the filters with a fault ID from the simulation we just ran?”
