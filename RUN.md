# How to run AIFI (Python API + Next.js dashboard)

Step-by-step from a clean machine. Commands assume **Windows PowerShell** and that the repo root is:

`C:\Users\<you>\groupAIFL\AIFI-group_project`

Adjust paths if yours differ.

---

## 0. Prerequisites

- **Python 3.11+** (`python --version`)
- **Node.js 20+** (LTS recommended; Next 16 needs a current Node) (`node --version`, `npm --version`)
- **Dataset**: `dataset\` should contain the TEP `.RData` files (needed only if you train or use live simulation paths that read data; the API mainly needs trained artifacts under `outputs\models\`).

---

## 1. Open a terminal at the project root

```powershell
cd C:\Users\LithiChang\groupAIFL\AIFI-group_project
```

---

## 2. Python environment and dependencies

Recommended: a virtual environment in the repo root.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If execution policy blocks `Activate.ps1`, run PowerShell as Administrator once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 3. (Recommended) Train models and generate `outputs/`

The FastAPI app loads serialized models from `outputs\models\`. If you have not run the pipeline yet, do this once (full run can take a while; use the smoke command for a quick test).

**Full run (example):**

```powershell
python -m src.pipeline --train-runs 30 --test-runs 15 --models random_forest xgboost
```

**Faster smoke test:**

```powershell
python -m src.pipeline --train-runs 5 --test-runs 3 --only-faults 0 1 4 6 --models random_forest --skip-shap
```

First pipeline run may build parquet cache under `outputs\cache\` (~2 minutes, large files).

---

## 4. Start the FastAPI server (Uvicorn)

Always run from the **project root** so `api.main` and `src` resolve correctly.

```powershell
cd C:\Users\LithiChang\groupAIFL\AIFI-group_project
.\.venv\Scripts\Activate.ps1   # if you use a venv
python -m uvicorn api.main:app --reload --port 8000
```

- API: http://127.0.0.1:8000  
- Swagger UI: http://127.0.0.1:8000/docs  
- Health check: http://127.0.0.1:8000/health  

If `uvicorn` is not on `PATH`, `python -m uvicorn` (as above) is the reliable form on Windows.

Leave this terminal open while you use the dashboard.

---

## 5. Dashboard: install dependencies

Open a **second** terminal:

```powershell
cd C:\Users\LithiChang\groupAIFL\AIFI-group_project\dashboard
npm install
```

---

## 6. Point the dashboard at the API (live metrics / health)

The dashboard reads `NEXT_PUBLIC_AIFI_API_URL` (see `dashboard\src\lib\api.ts`). Without it, API-dependent UI stays in demo/mock mode.

Create `dashboard\.env.local` (same folder as `package.json`):

```env
NEXT_PUBLIC_AIFI_API_URL=http://127.0.0.1:8000
```

Rebuild after changing this variable (Next bakes `NEXT_PUBLIC_*` into the client at build time).

---

## 7. Production-style build and run (Next.js)

From `dashboard\`:

```powershell
cd C:\Users\LithiChang\groupAIFL\AIFI-group_project\dashboard
npm run build
npm start
```

By default `next start` serves on http://localhost:3000 (unless `PORT` is set).

---

## 8. Local development (hot reload, no production build)

Still use `.env.local` with `NEXT_PUBLIC_AIFI_API_URL` if you want live API calls:

```powershell
cd C:\Users\LithiChang\groupAIFL\AIFI-group_project\dashboard
npm run dev
```

Then open http://localhost:3000 (or the port Next prints).

---

## 9. Optional: Jupyter notebook

From project root with venv activated:

```powershell
pip install jupyter   # already in requirements.txt
jupyter notebook notebooks\tep_pipeline.ipynb
```

---

## Quick checklist

| Step | What |
|------|------|
| 1 | `pip install -r requirements.txt` |
| 2 | `python -m src.pipeline …` (if `outputs\models\` missing) |
| 3 | `python -m uvicorn api.main:app --reload --port 8000` from **repo root** |
| 4 | `dashboard\.env.local` → `NEXT_PUBLIC_AIFI_API_URL=http://127.0.0.1:8000` |
| 5 | `cd dashboard` → `npm install` → `npm run build` → `npm start` (or `npm run dev`) |

---

## Troubleshooting

- **`ModuleNotFoundError` for `src` or `api`:** Start Uvicorn from the **repository root**, not from `api\` or `dashboard\`.
- **API returns errors about missing models:** Run the pipeline (section 3) or confirm `outputs\models\` contains the expected `.joblib` files.
- **Dashboard never shows API as connected:** Check `.env.local`, restart `npm run dev` / rebuild after env changes, and confirm http://127.0.0.1:8000/health in the browser.

For more detail on endpoints and artifacts, see `README.md`.
