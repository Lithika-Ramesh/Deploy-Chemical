# Dashboard prototype: interpretations from binary and multiclass notebooks

This document lists **operator- and analytics-meaningful interpretations** you can surface in the TEP dashboard by **exporting or replaying** outputs from `notebooks/04a_Binary_Classifier.ipynb` and `notebooks/04b_Multiclass_Classifier.ipynb`. It complements `md/DASHBOARD_AND_PIPELINE_AI_PROMPT_CONTEXT.md` with a concrete “what to fetch and how to say it” map.

---

## Shared experimental context (both notebooks)

- **Leakage-safe splits:** Train, validation, and test are separated by a **run key** (source + fault identity + `simulationRun`), not by random rows, so metrics reflect generalization to **unseen runs**, not memorized trajectories.
- **52 base TEP signals:** `xmeas_*` and `xmv_*` columns; both notebooks extend these with **run-wise rolling** statistics over windows `[10, 20, 30, 50, 100]` (means and stds), computed **inside each run** before sampling.
- **Pre-fault masking:** Early samples in faulty runs are excluded from the **label** used for training/evaluation (train cutoff ≤ 20, test cutoff ≤ 160 sample index in the respective notebooks), so models are not rewarded for predicting “fault” on obviously normal startup rows in a fault file.

**Dashboard copy idea:** Label panels as “**off-line benchmark metrics** on TEP runs” so users do not confuse them with live DCS performance.

---

## 04a — Binary classifier (“gatekeeper”)

**Role in a two-stage story:** Answers **“Is there a fault (yes/no)?”** for normal vs faulty rows. This is the natural hook for **alarm-style KPIs**, **triage thresholds**, and **ROC / confusion** views.

### Interpretations to fetch and display

| Interpretation | Source in notebook | Prototype UI ideas |
|----------------|-------------------|--------------------|
| **Fault vs normal discrimination** | Test confusion matrix, classification report (`Normal (0)` vs `Faulty (1)`) | 2×2 heatmap; tiles for precision / recall / F1 on the **fault** class |
| **Discrimination strength (ranking)** | ROC curve, **AUC** (`artifacts["roc"]["auc"]` in JSON) | ROC plot; optional single KPI “AUC (test)” |
| **Operating point (threshold)** | Validation grid → chosen `threshold`; applied on test (`artifacts["threshold"]`) | Slider or preset buttons; show **live** precision/recall/FAR/missed if you replay `predict_proba` |
| **False alarm rate (FAR)** | `fp / (fp + tn)` on test | Tile or gauge: “normal hours disturbed per decision” narrative |
| **Missed fault rate** | `fn / (fn + tp)` on test | Tile: “faulty periods missed” — pairs with recall |
| **Threshold trade-off curves** | `artifacts["threshold_tuning"]`: rows with `threshold`, `recall`, `precision`, `f1`, `false_alarm_rate`, `missed_fault_rate` | Multi-line chart (threshold on x-axis); annotate chosen threshold |
| **Strategy used to pick threshold** | Code logic: prefer high threshold while `missed_fault_rate ≤ 0.10` and `false_alarm_rate ≤ 0.50`, else relax | Tooltip or footnote explaining **why** that threshold was chosen (operator trust) |
| **Class imbalance handling** | Two training configs: **balanced** 50/50 train/val vs **imbalanced** 90/10 train with balanced weights; val remains 50/50 | Tab or dropdown “Training recipe”; compare side-by-side result rows |
| **Model choice** | HistGradientBoosting vs XGBoost per config | Small leaderboard from summarized table (model × config × threshold × metrics) |
| **Feature transparency** | `artifacts["features"]`, `artifacts["windows"]` | Collapsible “Model inputs”: count of engineered features; list sample names |
| **Reproducibility** | Saved `joblib` models under `models/final/binary_champion_*_{cfg}.joblib` | “Run ID” / file timestamp in UI |

### Serialized artifacts (for static JSON under `public/data/`)

Per model and training config, the notebook writes:

- **Path pattern:** `models/final/binary_artifacts_{model_key}_{cfg_name}.json`  
  (`model_key`: `hist_gradient_boosting` | `xgboost`; `cfg_name` matches balanced vs imbalanced split keys.)

**Useful JSON keys for the dashboard:**

- `model`, `config`, `threshold`, `windows`, `features`
- `threshold_tuning` — full curve for interactive threshold UX
- `roc` — `fpr`, `tpr`, `thresholds`, `auc`
- `confusion_matrix` — 2×2 matrix for heatmap
- `classification_report` — sklearn dict (per-class precision/recall/F1/support + accuracy)

---

## 04b — Multiclass classifier (“diagnostician”)

**Role in a two-stage story:** Answers **“Which fault type?”** on rows where a fault is **already present** (fault-period labels). The notebook explicitly notes that **end-to-end** plant monitoring still depends on the **binary gatekeeper** for normal vs fault.

### Interpretations to fetch and display

| Interpretation | Source in notebook | Prototype UI ideas |
|----------------|-------------------|--------------------|
| **Per-fault-type recall** | `classification_report` per model on test; champion bar chart in notebook | Horizontal bar chart by fault ID; sort ascending to highlight weak classes |
| **Confusion of fault identities** | Normalized confusion matrix (`normalize="true"`) per model | Heatmap; row = true fault, column = predicted fault |
| **Overall multiclass accuracy** | `accuracy` in comparison tables | Single headline KPI (with caveat: **fault-conditioned**) |
| **Macro vs weighted F1** | `macro_f1`, `weighted_f1` (and macro recall) | Two tiles; tooltip explaining macro = “unweighted average across faults” |
| **Model comparison** | `outputs/multiclass_model_comparison.csv` + `artifacts["comparison"]` | Table or small-multiples of confusion / recall by model |
| **Champion model** | `artifacts["champion"]` chosen by **test macro recall** (then macro F1) | Badge on charts; “default diagnostician” in UI |
| **Calibration / confidence narrative (proxy)** | `multiclass_champion_probabilities.csv`: per-row `max_prob`, `pred_fault`, **`risk_proxy = 1 - max_prob`** | Sparkline or strip: “diagnostic uncertainty” over a replayed run |
| **Probability vector per class** | Columns `prob_fault_*` in champion CSV | Stacked area or donut for “fault hypothesis distribution” at a time index |
| **Single-run time series** | `outputs/multiclass_risk_timeseries_{champion}_run_{run_key}.csv` | Line chart: risk proxy vs time for demo “investigation” view |
| **Probability proxy summary** | `outputs/multiclass_probability_proxy_summary.csv` | Aggregate table: mean/median risk proxy by fault type (if notebook aggregates — confirm in notebook cells) |

### Serialized artifacts

- **`models/final/multiclass_comparison_artifacts.json`**
  - `champion`, `labels`, `windows`, `features`, `model_paths`
  - `comparison` — list of dicts (train time, accuracy, macro recall/F1, weighted F1, split, etc.)
  - `reports` — nested `classification_report` dicts **per model**
  - `confusion_matrices` — per model, for heatmaps

- **CSV exports under `outputs/`:** model comparison, probability proxy summary, champion probabilities, optional risk time series for one run.

---

## Wiring these into the dashboard (prototype-level)

1. **Copy or serve** the JSON/CSV artifacts into `dashboard/public/data/` (or add a small export script mirroring `scripts/export_alarm_xmeas13_dashboard.py`).
2. **Two-stage narrative in UI:** Binary panel = “**detection**”; multiclass panel = “**isolation** (given fault).” Use copy from this doc to avoid misreading multiclass accuracy as “overall plant accuracy.”
3. **Reuse existing types where possible:** `ShapFeature[]` and `FaultClassProbability[]` in `dashboard/src/lib/types.ts` align conceptually with multiclass **prob_fault_*** columns; binary **P(fault)** can drive `confidenceHistory` or a dedicated gatekeeper series.
4. **Run selector:** If you keep multiple `binary_artifacts_*.json` files, add a dropdown keyed by `{model_key, cfg_name}` and refresh charts.

---

## Quick “what not to imply”

- **Do not** present multiclass test accuracy as “probability the plant is healthy”; it is **conditional on fault-period rows**.
- **Do not** hide the **threshold**: binary FAR and missed-fault rates move with it; a single static screenshot is less trustworthy than the **threshold_tuning** curve.
- **Do** pair any “AI accuracy” tile with **split type** (run-level) and **data recipe** (balanced vs imbalanced).

---

*Derived from `notebooks/04a_Binary_Classifier.ipynb` and `notebooks/04b_Multiclass_Classifier.ipynb` as of repo state; re-run notebooks to refresh numbers before publishing a demo.*
