# AIFI — Tennessee Eastman Predictive Maintenance

Industry 4.0 prototype: train fault classifiers on TEP sensor data, expose predictions via FastAPI, and operate a Next.js smart-factory dashboard.

## Prerequisites

- **Python 3.11+**
- **Node.js 20+** (for the dashboard)
- **TEP dataset** in `dataset/` (`.RData` files) when training or using live simulation paths

## Quick start

### 1. Python (repo root)

```powershell
cd path\to\AIFI-group_project
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Train models (required before the API; first run builds parquet cache under `outputs/cache/`):

```powershell
# Full run
python -m src.pipeline --train-runs 30 --test-runs 15 --models random_forest xgboost

# Smoke test
python -m src.pipeline --train-runs 5 --test-runs 3 --only-faults 0 1 4 6 --models random_forest --skip-shap
```

Optional API (from repo root):

```powershell
python -m uvicorn api.main:app --reload --port 8000
```

- API: http://127.0.0.1:8000  
- Swagger: http://127.0.0.1:8000/docs  

The dashboard does **not** call this API by default; it uses static JSON under `dashboard/public/data/` and in-browser mock telemetry.

### 2. Dashboard

```powershell
cd dashboard
npm install
npm run dev
```

Open http://localhost:3000

Production build:

```powershell
npm run build
npm start
```

**Vercel:** set project **Root Directory** to `dashboard` (monorepo).

### 3. Notebooks (optional)

```powershell
jupyter notebook notebooks\tep_pipeline.ipynb
```

Export scripts in `scripts/` regenerate dashboard JSON (run from repo root with venv active).

## Directory structure

```
AIFI-group_project/
├── api/                    # FastAPI service (predict, simulate, demo streams)
├── dashboard/              # Next.js operator UI (Vercel root)
│   ├── public/data/        # Static charts, sensor loops, model exports
│   └── src/                # Pages, components, hooks
├── dataset/                # Raw TEP .RData (not in git; add locally)
├── notebooks/              # Jupyter workflows (data prep, binary/multiclass)
├── scripts/                # Export JSON/figures for the dashboard
├── src/                    # Pipeline: load, preprocess, train, evaluate, simulate
│   ├── config.py           # Paths, fault catalog, severity
│   ├── data_loader.py
│   ├── preprocessing.py
│   ├── models.py
│   ├── evaluation.py
│   ├── explainability.py
│   ├── simulation.py
│   └── pipeline.py         # CLI entry: python -m src.pipeline
├── outputs/                # Generated models, figures, reports (gitignored)
├── requirements.txt
└── README.md
```

## Checklist

| Step | Command |
|------|---------|
| Install Python deps | `pip install -r requirements.txt` |
| Train (if no models) | `python -m src.pipeline …` |
| Optional API | `python -m uvicorn api.main:app --reload --port 8000` |
| Dashboard | `cd dashboard` → `npm install` → `npm run dev` |

## Troubleshooting

- **`ModuleNotFoundError` for `src` or `api`:** run Uvicorn from the **repository root**, not from `api/` or `dashboard/`.
- **API errors about missing models:** run the pipeline or confirm `outputs/models/*.joblib` exists.
