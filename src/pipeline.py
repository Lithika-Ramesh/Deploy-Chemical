"""End-to-end orchestrator + CLI for the AIFI pipeline.

Run from the project root:

.. code-block:: bash

    python -m src.pipeline --train-runs 30 --test-runs 15 \
        --models random_forest xgboost --skip-shap

The orchestrator wires together every module in ``src/`` and writes its
artifacts into ``outputs/`` so they can be picked up by the FastAPI
service or the Next.js dashboard.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import List

# Headless plotting - the orchestrator runs in CLI/CI contexts, never in a
# Tk-aware GUI thread. Must be set BEFORE any submodule imports pyplot.
import matplotlib
matplotlib.use("Agg")

from . import config
from .data_loader import load_tep_dataset
from .eda import run_full_eda
from .evaluation import (
    EvaluationResult,
    evaluate_model,
    pick_best_model,
    plot_model_comparison,
    save_evaluation_report,
)
from .explainability import compute_shap_summary, plot_feature_importance
from .models import train_all
from .preprocessing import preprocess_split
from .simulation import generate_demo_alerts


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("aifi.pipeline")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _parse_args(argv: List[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="aifi-pipeline",
        description="Train + evaluate the TEP smart-factory predictive engine.",
    )
    p.add_argument("--train-runs", type=int,
                   default=config.DEFAULT_SAMPLING.train_runs_per_fault,
                   help="Simulation runs per fault used for training.")
    p.add_argument("--test-runs", type=int,
                   default=config.DEFAULT_SAMPLING.test_runs_per_fault,
                   help="Simulation runs per fault used for testing.")
    p.add_argument("--models", nargs="+",
                   default=["random_forest", "xgboost"],
                   choices=["random_forest", "xgboost"],
                   help="Models to train.")
    p.add_argument("--skip-eda", action="store_true",
                   help="Skip EDA plots (faster smoke runs).")
    p.add_argument("--skip-shap", action="store_true",
                   help="Skip SHAP analysis (saves a few minutes).")
    p.add_argument("--skip-simulation", action="store_true",
                   help="Skip generating dashboard demo alert streams.")
    p.add_argument("--force-rebuild-cache", action="store_true",
                   help="Rebuild the parquet cache from .RData (slow).")
    p.add_argument("--only-faults", type=int, nargs="+", default=None,
                   help="Restrict to specific fault classes (smoke testing).")
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
def run_pipeline(args: argparse.Namespace) -> dict:
    log.info("=" * 70)
    log.info("AIFI pipeline starting")
    log.info("=" * 70)

    # 1. Data --------------------------------------------------------------
    log.info("[1/7] Loading Tennessee Eastman dataset…")
    ds = load_tep_dataset(
        train_runs_per_fault=args.train_runs,
        test_runs_per_fault=args.test_runs,
        force_rebuild=args.force_rebuild_cache,
        only_faults=args.only_faults,
    )
    log.info("Dataset summary: %s", ds.summary())
    ds.class_distribution().to_csv(config.REPORT_DIR / "class_distribution.csv")

    # 2. Preprocessing -----------------------------------------------------
    log.info("[2/7] Preprocessing (impute + scale + audit)…")
    X_train_p, X_test_p, artifacts, audit = preprocess_split(ds.X_train, ds.X_test)
    audit["missing_train"].to_csv(config.REPORT_DIR / "audit_missing_train.csv")
    audit["outliers_train"].to_csv(config.REPORT_DIR / "audit_outliers_train.csv")

    # 3. EDA ---------------------------------------------------------------
    if not args.skip_eda:
        log.info("[3/7] Running exploratory data analysis…")
        run_full_eda(X_train_p, ds.y_train, ds.meta_train, X_test_p, ds.y_test)
    else:
        log.info("[3/7] Skipping EDA (per CLI flag).")

    # 4. Training ----------------------------------------------------------
    log.info("[4/7] Training models: %s", args.models)
    trained = train_all(args.models, X_train_p, ds.y_train, artifacts)
    for m in trained.values():
        m.save()

    # 5. Evaluation --------------------------------------------------------
    log.info("[5/7] Evaluating models…")
    results: List[EvaluationResult] = [evaluate_model(m, ds.X_test, ds.y_test)
                                       for m in trained.values()]
    save_evaluation_report(results)
    plot_model_comparison(results)
    best = pick_best_model(results)
    log.info("Best model -> %s (f1_macro=%.4f)", best.name, best.f1_macro)

    # 6. Explainability ----------------------------------------------------
    log.info("[6/7] Computing explainability artifacts…")
    best_model = trained[best.name]
    plot_feature_importance(best_model, top_n=25)
    if not args.skip_shap:
        compute_shap_summary(best_model, X_test_p)
    else:
        log.info("Skipping SHAP analysis (per CLI flag).")

    # 7. Smart-factory simulation -----------------------------------------
    if not args.skip_simulation:
        log.info("[7/7] Generating dashboard-ready demo alert streams…")
        generate_demo_alerts(best_model)
    else:
        log.info("[7/7] Skipping demo simulation (per CLI flag).")

    # Save a manifest the dashboard / API can read on startup -------------
    manifest = {
        "best_model": best.name,
        "best_model_path": str(config.MODEL_DIR / f"{best.name}.joblib"),
        "results": [r.to_summary() for r in results],
        "feature_columns": ds.feature_columns,
        "fault_catalog": config.FAULT_CATALOG,
    }
    (config.REPORT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2,
                                                                default=str))
    log.info("Pipeline complete. Outputs at %s", config.OUTPUT_DIR)
    return manifest


def main(argv: List[str] | None = None) -> None:
    args = _parse_args(argv)
    run_pipeline(args)


if __name__ == "__main__":
    main()
