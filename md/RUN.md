# How to run AIFI (Python pipeline + Next.js dashboard)

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

## 4. Start the FastAPI server (Uvicorn) — optional

Use this when you want the **HTTP API** (Swagger, `/predict`, etc.). The **Next.js dashboard does not call this server**; it runs on in-browser mock telemetry unless you add your own integration.

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

Keep this terminal open only while you are exercising the API.

---

## 5. Dashboard: install dependencies

Open a **second** terminal:

```powershell
cd C:\Users\LithiChang\groupAIFL\AIFI-group_project\dashboard
npm install
```

---

## 6. Dashboard and the Python API

The dashboard under `dashboard\` is **self-contained**: `npm run dev` or `npm start` is enough for the full operator UI (mock twin, charts, alarm lab with optional static JSON).

There is **no** `NEXT_PUBLIC_AIFI_API_URL` wiring in this repo’s Next.js app. To show real pipeline metrics in the UI later, add your own approach (for example export JSON into `dashboard\public\data\` and load it from a page or context).

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

## 8. Vercel (monorepo)

The Next.js app is in **`dashboard\`**, not the repository root. In the Vercel project, set **Root Directory** to **`dashboard`** (same folder as `dashboard\package.json`). If Root Directory is wrong, the build fails with “No Next.js version detected”. After changing it, trigger a new deployment. Official reference: [Using Monorepos](https://vercel.com/docs/monorepos).

---

## 9. Local development (hot reload, no production build)

```powershell
cd C:\Users\LithiChang\groupAIFL\AIFI-group_project\dashboard
npm run dev
```

Then open http://localhost:3000 (or the port Next prints).

---

## 10. Optional: Jupyter notebook

From project root with venv activated:

```powershell
pip install jupyter   # already in requirements.txt
jupyter notebook notebooks\tep_pipeline.ipynb
```

---

## 11. Quick checklist

| Step | What |
|------|------|
| 1 | `pip install -r requirements.txt` |
| 2 | `python -m src.pipeline …` (if `outputs\models\` missing) |
| 3 | *(Optional)* `python -m uvicorn api.main:app --reload --port 8000` from **repo root** |
| 4 | `cd dashboard` → `npm install` → `npm run build` → `npm start` (or `npm run dev`) |

---

## 12. Troubleshooting

- **`ModuleNotFoundError` for `src` or `api`:** Start Uvicorn from the **repository root**, not from `api\` or `dashboard\`.
- **API returns errors about missing models:** Run the pipeline (section 3) or confirm `outputs\models\` contains the expected `.joblib` files.

For more detail on endpoints and artifacts, see `md/README.md`.
