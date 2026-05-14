# Dashboard Brief — TEP Digital Twin
## For: Lithika
## From: Dawood
## Date: 14 May 2025

---

## TL;DR

The dashboard looks fantastic — genuinely impressive work. The architecture is right. The main thing we need for the presentation demo is **real model outputs replacing the dummy values**, and a **clean replay of Fault 13 from the test dataset**.

---

## What We Are Showing in the Presentation

**One fault, one simulation run, replayed as if it were live.**

- **Fault:** IDV(13) — Reaction Kinetics Slow Drift
- **Dataset:** `tep_test.csv` — the held-out test set (model has never seen this)
- **Simulation run:** Run 1
- **Why Fault 13:** Slow-developing fault, reactor temperature stays flat (operator sees nothing), but the PID controller output drifts from 41% → 78%. This is our core narrative — PID masks the fault, AI catches it.

**The demo scenario:**
```
Samples 1–20:    Pre-fault period — everything normal
Sample 21+:      Fault active — slow drift begins
~Sample 200+:    Model confidence rising
~Sample 300+:    Alert fires — IDV(13) detected
~Sample 400+:    High risk badge appears
```

Each sample = 3 minutes of plant time. 960 samples total = ~48 hours.

---

## Where the Real Data Comes From

### Model outputs
The binary and multiclass classifiers are trained and saved as `.joblib` files. To get probability scores:

```python
import joblib
import pandas as pd
import numpy as np

# Load model and feature list
binary_model = joblib.load('models/binary_clf_rolling.joblib')
multi_model   = joblib.load('models/multiclass_clf_rolling.joblib')
feature_list  = joblib.load('models/feature_list.joblib')

# Load Fault 13 Run 1 from test set
df = pd.read_csv('data/processed/tep_test.csv')
fault13 = df[
    (df['label'] == 13) &
    (df['simulationRun'] == 1)
].sort_values('sample').reset_index(drop=True)

# Add rolling features — MUST match training windows exactly
# Windows: [10, 20, 30, 50, 100]
def add_rolling(df, cols, windows):
    df = df.copy()
    for col in cols:
        for w in windows:
            df[f'{col}_rmean{w}'] = df[col].rolling(w, min_periods=1).mean()
            df[f'{col}_rstd{w}']  = df[col].rolling(w, min_periods=1).std().fillna(0)
    return df

BASE_COLS = [c for c in fault13.columns if c.startswith('xmeas_') or c.startswith('xmv_')]
fault13_eng = add_rolling(fault13, BASE_COLS, [10, 20, 30, 50, 100])

X = fault13_eng[feature_list].values

# Get probability scores
p_fault      = binary_model.predict_proba(X)[:, 1]   # P(fault) per timestep
health_score = (1 - p_fault) * 100                    # Health score 0-100%
is_fault     = (p_fault >= 0.35).astype(int)          # Binary alert (threshold = 0.35)

# Multiclass — only run when binary triggers
fault_type = multi_model.predict(X)  # IDV label 1-20

# Export to JSON for dashboard
import json
output = {
    'samples':       fault13['sample'].tolist(),
    'p_fault':       p_fault.tolist(),
    'health_score':  health_score.tolist(),
    'is_fault':      is_fault.tolist(),
    'fault_type':    fault_type.tolist(),
    # Key sensor variables for the charts
    'xmeas_9':       fault13['xmeas_9'].tolist(),   # Reactor temperature
    'xmv_10':        fault13['xmv_10'].tolist(),    # Reactor CW flow (PID output)
    'xmeas_22':      fault13['xmeas_22'].tolist(),  # Separator CW outlet temp
    'xmv_11':        fault13['xmv_11'].tolist(),    # Condenser CW flow
}
with open('dashboard/public/data/fault13_replay.json', 'w') as f:
    json.dump(output, f)

print(f"Exported {len(fault13)} samples")
print(f"Alert fires at sample: {fault13['sample'].iloc[np.argmax(is_fault)]}")
print(f"Max p_fault: {p_fault.max():.3f}")
print(f"Min health_score: {health_score.min():.1f}%")
```

> ⚠️ **Critical:** Rolling features must use the **same windows as training** — [10, 20, 30, 50, 100]. If they don't match, model outputs will be wrong.

---

## What the Dashboard Should Show During the Demo

### The replay sequence (Fault Simulation page is perfect for this)

The demo should play through the 960 samples of Fault 13 at a readable speed — suggest **1 sample per second** = ~16 minutes total, or **5 samples per second** = ~3 minutes. We want it to feel real but not too slow for a 15-minute presentation.

### Panel 1 — Plant Status (top bar, already exists)
- **PLANT: NORMAL** → changes to **PLANT: FAULT DETECTED** when binary threshold crossed
- **SYSTEM HEALTH: 97%** → counts down as p_fault rises
- **AI STATUS: ONLINE** — keep this always green

### Panel 2 — AI Watch Summary (middle, already exists)
- Confidence score: show `p_fault × 100` as percentage
- When fault detected: change message from "Plant running normally" to "⚠ Fault IDV(13) detected — Reaction Kinetics Drift"
- Risk level: LOW → MEDIUM → HIGH as confidence rises

### Panel 3 — Live Sensor Charts (right, already exists)
Show these two specifically — they tell the story:
- **xmeas_9** — Reactor Temperature (°C) — stays flat → operator sees nothing
- **xmv_10** — Reactor CW Flow / PID Output (%) — drifts upward → AI catches this

### Panel 4 — Alert Log (when fault fires)
```
[14:32]  ⚠ IDV(13) DETECTED — HIGH RISK
         Fault: Reaction Kinetics Slow Drift
         Confidence: 84.8%
         Recommended action: Monitor catalyst activity.
         Schedule inspection of reactor kinetics.
         Contact process engineer.
```

---

## Risk Score Logic

Use this lookup after multiclass classifier identifies the fault type:

| Fault | Description | Risk Level |
|---|---|---|
| IDV(1) | A/C feed ratio step | MEDIUM |
| IDV(2) | B composition step | MEDIUM |
| IDV(3) | D feed temperature step | LOW |
| IDV(4) | Reactor CW inlet temp step | HIGH |
| IDV(5) | Condenser CW inlet temp step | HIGH |
| IDV(6) | A feed loss | HIGH |
| IDV(7) | C header pressure loss | HIGH |
| IDV(8) | A,B,C feed composition variation | MEDIUM |
| IDV(9) | D feed temperature variation | LOW |
| IDV(10) | C feed temperature variation | LOW |
| IDV(11) | Reactor CW inlet temp variation | HIGH |
| IDV(12) | Condenser CW inlet temp variation | MEDIUM |
| IDV(13) | Reaction kinetics slow drift | MEDIUM → HIGH |
| IDV(14) | Reactor CW valve sticking | HIGH |
| IDV(15) | Condenser CW valve sticking | HIGH |
| IDV(16–20) | Unknown/unclassified | LOW |

> For IDV(13) specifically — start as MEDIUM when first detected, escalate to HIGH if confidence > 80%

---

## Recommended Action Strings (for alert log)

```javascript
const RECOMMENDED_ACTIONS = {
  1:  "Check A/C feed ratio — verify stream 4 composition analysis",
  2:  "Check B composition in stream 4 — request lab sample",
  3:  "Monitor D feed temperature — check stream 2 heat exchanger",
  4:  "CHECK REACTOR COOLING WATER — inspect CW inlet temperature and flow",
  5:  "Check condenser cooling water — inspect CV-31 valve position",
  6:  "EMERGENCY: A feed loss detected — check stream 1 valve and upstream supply",
  7:  "Check C header pressure — inspect stream 4 supply pressure",
  8:  "Monitor feed composition — request stream 4 analysis",
  9:  "Monitor D feed temperature — within normal variation",
  10: "Monitor C feed temperature — within normal variation",
  11: "Check reactor cooling water temperature — inspect CW system",
  12: "Monitor condenser cooling water temperature",
  13: "Monitor reaction kinetics — check catalyst activity. Schedule inspection.",
  14: "INSPECT REACTOR CW VALVE — stiction detected. Manual check required.",
  15: "INSPECT CONDENSER CW VALVE — stiction detected. Manual check required.",
}
```

---

## Decision Threshold

**Binary classifier threshold: 0.35**

- Below 0.35 → NORMAL (show health score)
- Above 0.35 → FAULT DETECTED (show fault type + risk)

This was chosen from our overnight threshold analysis to balance missed faults (20.3%) vs false alarms (12.4%). It's the best operational tradeoff for a safety-critical environment.

---

## Key Variables — Verified Against Downs & Vogel (1993)

| Column | Description | Units | Base Case |
|---|---|---|---|
| xmeas_9 | Reactor temperature | °C | 120.40 |
| xmeas_22 | Separator CW outlet temperature | °C | 77.297 |
| xmv_10 | Reactor cooling water flow (PID output) | % | 41.106 |
| xmv_11 | Condenser cooling water flow (PID output) | % | 18.114 |

Show xmeas_9 and xmv_10 for Fault 13 — they tell the best story.

---

## What's Already Great (Don't Change)

- Dark SCADA-style UI — looks professional and operator-facing ✅
- Process topology diagram — visually impressive ✅
- Fault simulation page with scenario builder ✅
- Alarm lab page with EWMA animation ✅
- Header bar with plant status, AI status, system health ✅
- Overall layout and navigation ✅

---

## Priority Order for the Presentation

1. **Feed real probability scores** from Fault 13 test run into the JSON
2. **Connect JSON to the replay** — health score counting down, alert firing
3. **Show xmeas_9 and xmv_10** as the two sensor charts during replay
4. **Alert log** populates when fault fires with recommended action
5. **Risk badge** changes LOW → MEDIUM → HIGH

Everything else is bonus — the core demo needs those five things working.

---

## Questions

Ping Dawood on anything chemically specific (what the variables mean, why certain faults are HIGH risk, recommended actions wording).

Ping the modelling team for the saved `.joblib` files if not already shared.

---

*Presentation: 19 May 2pm — 5 days away*
