# Maintenance — Dashboard Guide

**Route:** `/maintenance`  
**Nav label:** Maintenance  
**Source:** `dashboard/src/components/pages/MaintenancePage.tsx`

---

## Purpose

The Maintenance page presents **AI-ranked predictive maintenance work orders** grounded in real TEP test runs — especially **Fault 5** (condenser cooling water inlet temperature step, IDV-5).

It connects model outputs (binary P(fault), multiclass IDV(5) probability, XMEAS_13 delta) to **actionable inspection steps** operators would execute in the field.

---

## Page layout

```text
┌─────────────────────────────────────────────────────────────┐
│  AI predictive maintenance (title + data source note)       │
├─────────────────────────────────────────────────────────────┤
│  [Fault 5 only] Figure grid: run 78 vs 171 comparison       │
├─────────────────────────────────────────────────────────────┤
│  Maintenance cards (grid, 2 columns on large screens)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Data sources (priority)

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | `tep_notebook_dashboard.json` → `maintenance[]` | Notebook export |
| 2 | `FAULT5_MAINTENANCE_CASES` | Curated runs from `tep_test.csv` + champion models |
| 3 | `PlantSimulationContext.maintenanceItems` | Live twin work orders |

**Visible Fault 5 runs:** Only simulation runs **78** and **148** are shown (filter in page code). Other runs exist in data but are hidden for a focused demo.

---

## Fault 5 context

| Concept | Value |
|---------|--------|
| **Benchmark fault** | IDV(5) — condenser CW inlet temperature **step** |
| **Injection sample** | `161` (`FAULT5_TEP_ONSET_SAMPLE`) |
| **Test data** | `data/processed/tep_test.csv` |
| **Figures source** | `outputs/figures/fault5/` → copied to `public/data/fault5/` |

Header copy links to **Fault simulation** (`/simulation`) to replay Fault 5 when replay JSON is available.

---

## Figure section — “Clean vs nuisance alarms”

**Component:** `Fault5Run78Vs171Figures`  
Shown when work orders include Fault 5 TEP cases.

Compares **run 78** (clean hero) vs **run 171** (pre-fault nuisance alarms):

| Figure | Signal | Story |
|--------|--------|-------|
| Separator pressure | XMEAS_13 | Physical manifestation at separator |
| Condenser CW flow | XMV_11 | PID response |
| P(fault) | Champion binary | When the AI fires relative to injection |

**Talking point:** Same fault class, different test runs → different false-alarm behavior before sample 161. Justifies threshold tuning and maintenance prioritization.

---

## Work order cards

Each card (`MaintenanceCard`) includes:

### Header

- **Equipment** line — affected systems + `tep_test run <N>`
- **Subtitle** — case tag (e.g. “Clean hero”, “Strong step (−)”)

### Metrics grid (TEP cases)

| Metric | Meaning |
|--------|---------|
| **1st alert** | Sample index of first binary alert |
| **IDV(5) Probability** | Multiclass champion confidence for fault 5 (%) |
| **Δ XMEAS_13** | Change in separator pressure signature |

### Body

- **Detected issue** — plain-language summary
- **Estimated impact** — holdout test metrics narrative (hidden on Fault 5 TEP cards for cleaner UI)
- **Work order progress** — bar at 0% for Fault 5 curated cards (not started)
- **Inspection steps** — bullet list from fault catalog + case-specific extras

### Curated cases (built-in)

| Run | Tag | Risk | Highlight |
|-----|-----|------|-------------|
| **78** | Clean hero | LOW | Alert at sample 161, 0 pre-FA, ΔXMEAS_13 +2.74 |
| **148** | Strong step (−) | HIGH | 1-sample delay, ΔXMEAS_13 −7.83, strong separator transient |

Run 171 appears in figures but is not a visible work-order card (filtered out).

---

## Non–Fault-5 mode

If no TEP Fault 5 bundle is active, the page shows generic twin maintenance items with:

- Risk / urgency badges
- Failure window estimate (minutes)
- Progress % from simulation health

System health % from snapshot appears in the header subtitle.

---

## Notebook bundle

When `tep_notebook_dashboard.json` is present, header shows:

> Data from `tep_notebook_dashboard.json` (generated &lt;date&gt;)

Use the same export pipeline as incidents and telemetry.

---

## Key files

| Path | Role |
|------|------|
| `src/lib/fault5MaintenanceCases.ts` | Curated cases + onset sample |
| `src/components/maintenance/Fault5Run78Vs171Figures.tsx` | Comparison PNGs |
| `public/data/fault5/*.png` | Static chart assets |
| `src/lib/faultCatalog.ts` | Fault 5 recommended actions |

---

## Related pages

- [overview_dash.md](./overview_dash.md) — Fault 5 traces (78 vs normal)  
- [simulation_dash.md](./simulation_dash.md) — replay control room  
- [architecture_dash.md](./architecture_dash.md) — where XMEAS_13 sits on P&ID  
- [alarm_xmeas13_dash.md](./alarm_xmeas13_dash.md) — alarm engineering on same sensor family

---

## Presentation walkthrough script (spoken)

*~3 minutes. Sidebar → **Maintenance**. Fault 5 curated data should be loaded.*

---

**[Open Maintenance]**

“Last stop for the operator story: **AI predictive maintenance**.

The header tells you what you’re looking at — for us that’s **Fault 5** on **`tep_test`**: a step on **condenser cooling water inlet temperature**, injected at sample **161**. Same fault we visualized on Overview, but here we’re asking: *what work would we actually schedule?*

**[Figure grid — 78 vs 171]**

Before the cards, these three figures are the ‘why.’ **Run 78** versus **run 171** — same fault class, different test realizations.

Separator pressure **XMEAS_13**, condenser valve **XMV_11**, and **P(fault)** from the binary champion. Seventy-eight is the clean case — alert at injection. One seventy-one is the painful one — **nuisance alarms before the fault**. That’s why we don’t only report accuracy on a slide; we show runs that hurt operators.

**[First work order card — run 78]**

This card is **tep_test run 78**, tagged **Clean hero**.

Metrics grid: **first alert** at **161** — zero delay. **IDV(5) probability** in the high nineties — multiclass is confident it’s Fault 5. **Delta XMEAS_13** positive — separator pressure moves the way we expect.

**Detected issue** is written for a human. **Inspection steps** pull from our fault catalog — verify cooling water path, check valve, compare historian to DCS — plus run-specific notes like ‘use this as the default demo replay.’

Progress bar at zero — we haven’t executed the work order; this is prioritization, not CMMS completion.

**[Second card — run 148]**

Run **148** is the **strong negative step** on separator pressure — **HIGH** urgency in the data story. One-sample detection delay, large negative **delta XMEAS_13**. Same fault ID, very different physical signature. The AI still catches it, but the field response is different — calibration, condenser duty, bigger mechanical stress.

**[Link to simulation in header]**

We link back to **Fault simulation** so you can replay Fault 5 live after seeing the static evidence.

**[Close — tie to team pipeline]**

Pipeline for the team: notebooks train models → **`tep_test`** holds out runs → figures land in **`public/data/fault5`** → this page turns numbers into **work orders**. Overview shows KPIs; Maintenance shows *who does what tomorrow morning*.

That’s the full loop. Happy to take questions on any run, or go back to simulation and trigger Fault 5 in real time.”
