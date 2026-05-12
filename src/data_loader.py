"""Tennessee Eastman dataset loader with parquet caching and sub-sampling.

The raw R datasets are large (the faulty training file alone unpacks to
roughly 5 million rows × 55 columns ≈ 2 GB of RAM). We therefore:

1. Convert each ``.RData`` file to parquet on first use - the conversion
   is the slow step but only happens once.
2. Use **only** the faulty training + faulty testing archives (no
   fault-free baselines merged in), drop pre-injection rows, then keep
   rows with ``faultNumber > 0`` so the task is pure multi-class fault
   discrimination among the 20 disturbance types.
3. Read **metadata columns only** to choose simulation runs, then load sensor
   rows for those runs via PyArrow row filters (avoids holding full ~10M×52
   float matrices in RAM). Finally a stratified **70 / 15 / 15** train /
   validation / test split at row level.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from . import config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache layer
# ---------------------------------------------------------------------------
def _parquet_path(name: str) -> Path:
    return config.CACHE_DIR / f"{name}.parquet"


def _convert_rdata_to_parquet(rdata_path: Path, parquet_path: Path) -> None:
    """One-off conversion: read an .RData file with pyreadr and persist parquet."""
    import pyreadr  # local import: heavy, only needed on first run

    logger.info("Converting %s -> %s (one-off)", rdata_path.name, parquet_path.name)
    result = pyreadr.read_r(str(rdata_path))
    if not result:
        raise RuntimeError(f"No R objects found in {rdata_path}")
    df = next(iter(result.values()))
    df.columns = [c.strip() for c in df.columns]
    df["faultNumber"]   = df["faultNumber"].astype(np.int16)
    df["simulationRun"] = df["simulationRun"].astype(np.int32)
    df["sample"]        = df["sample"].astype(np.int32)
    feature_cols = [c for c in df.columns if c not in config.META_COLUMNS]
    df[feature_cols] = df[feature_cols].astype(np.float32)
    df.to_parquet(parquet_path, index=False)
    logger.info("Wrote %s rows to %s", len(df), parquet_path)


def ensure_parquet_cache(force: bool = False) -> Dict[str, Path]:
    """Make sure every RData file has a parquet twin in ``outputs/cache``."""
    paths: Dict[str, Path] = {}
    for name, rdata_path in config.RDATA_FILES.items():
        if not rdata_path.exists():
            logger.warning("Missing source file: %s", rdata_path)
            continue
        pq_path = _parquet_path(name)
        if force or not pq_path.exists():
            _convert_rdata_to_parquet(rdata_path, pq_path)
        paths[name] = pq_path
    return paths


# ---------------------------------------------------------------------------
# Loading + sub-sampling
# ---------------------------------------------------------------------------
@dataclass
class TEPDataset:
    """Container holding train / validation / test splits (faulty TEP only)."""
    X_train: pd.DataFrame
    y_train: pd.Series
    X_val:   pd.DataFrame
    y_val:   pd.Series
    X_test:  pd.DataFrame
    y_test:  pd.Series
    meta_train: pd.DataFrame
    meta_val:   pd.DataFrame
    meta_test:  pd.DataFrame
    feature_columns: list

    def class_distribution(self) -> pd.DataFrame:
        return pd.DataFrame({
            "train": self.y_train.value_counts().sort_index(),
            "val":   self.y_val.value_counts().sort_index(),
            "test":  self.y_test.value_counts().sort_index(),
        }).fillna(0).astype(int)

    def summary(self) -> Dict[str, int]:
        ys = pd.concat([self.y_train, self.y_val, self.y_test])
        return {
            "train_rows": len(self.X_train),
            "val_rows":   len(self.X_val),
            "test_rows":  len(self.X_test),
            "n_features": len(self.feature_columns),
            "n_classes":  int(ys.nunique()),
        }


def _sample_runs(df: pd.DataFrame, runs_per_fault: int, random_state: int) -> pd.DataFrame:
    """Randomly select ``runs_per_fault`` simulation runs per fault class."""
    rng = np.random.default_rng(random_state)
    keep = []
    for fault, grp in df.groupby("faultNumber", sort=False):
        runs = grp["simulationRun"].unique()
        n = min(runs_per_fault, len(runs))
        chosen = rng.choice(runs, size=n, replace=False)
        keep.append(grp[grp["simulationRun"].isin(chosen)])
    out = pd.concat(keep, ignore_index=True)
    return out


def _sample_run_keys_from_meta_halves(
    train_meta: pd.DataFrame,
    test_meta: pd.DataFrame,
    runs_per_fault: int,
    random_state: int,
) -> pd.DataFrame:
    """Pick (fault, source, run) keys using only skinny meta frames (low RAM)."""
    rng = np.random.default_rng(random_state)
    tr_raw = (
        train_meta.groupby("faultNumber", sort=False)["simulationRun"]
        .unique()
        .to_dict()
    )
    te_raw = (
        test_meta.groupby("faultNumber", sort=False)["simulationRun"]
        .unique()
        .to_dict()
    )
    tr_keys = {int(k): v for k, v in tr_raw.items()}
    te_keys = {int(k): v for k, v in te_raw.items()}
    faults = sorted(set(tr_keys) | set(te_keys))
    rows = []
    for fault in faults:
        pool = (
            [("faulty_training", int(r)) for r in tr_keys.get(fault, [])]
            + [("faulty_testing", int(r)) for r in te_keys.get(fault, [])]
        )
        if not pool:
            continue
        n = min(runs_per_fault, len(pool))
        pick = rng.choice(len(pool), size=n, replace=False)
        for i in pick:
            src, run = pool[i]
            rows.append(
                {"faultNumber": fault, "_tep_source": src, "simulationRun": run}
            )
    return pd.DataFrame(rows)


def _load_parquet_rows_for_keys(
    pq_path: Path,
    split_label: str,
    keys_df: pd.DataFrame,
) -> pd.DataFrame:
    """Read only simulation runs we need from one faulty parquet (PyArrow filters)."""
    if keys_df.empty:
        return pd.DataFrame()
    parts: list[pd.DataFrame] = []
    for fault_id, grp in keys_df.groupby("faultNumber", sort=False):
        runs = [int(x) for x in grp["simulationRun"].unique()]
        chunk = pd.read_parquet(
            pq_path,
            engine="pyarrow",
            filters=[
                ("faultNumber", "==", int(fault_id)),
                ("simulationRun", "in", runs),
            ],
        )
        chunk = _drop_pre_injection(chunk, split_label)
        chunk = chunk.loc[chunk["faultNumber"] > 0]
        parts.append(chunk)
    out = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()
    return out


def _drop_pre_injection(df: pd.DataFrame, split: str) -> pd.DataFrame:
    """Remove the genuinely fault-free portion of faulty simulations."""
    cutoff = config.FAULT_INJECTION_SAMPLE[split]
    mask = (df["faultNumber"] == 0) | (df["sample"] > cutoff)
    return df.loc[mask].reset_index(drop=True)


def load_tep_dataset(
    train_runs_per_fault: int = config.DEFAULT_SAMPLING.train_runs_per_fault,
    test_runs_per_fault:  int = config.DEFAULT_SAMPLING.test_runs_per_fault,
    random_state: int = config.DEFAULT_SAMPLING.random_state,
    force_rebuild: bool = False,
    only_faults: Optional[Iterable[int]] = None,
) -> TEPDataset:
    """Build a memory-friendly **fault-only** TEP dataset with 70/15/15 splits.

    Uses ``TEP_Faulty_Training`` and ``TEP_Faulty_Testing`` only (no fault-free
    archives). After pre-injection trimming, keeps ``faultNumber > 0`` so class
    0 (normal) is excluded.

    Parameters
    ----------
    train_runs_per_fault, test_runs_per_fault
        Upper bound on simulation runs retained per fault class after pooling
        both faulty archives; the larger of the two values is used.
    random_state
        Seeds run-selection and stratified splitting.
    force_rebuild
        If True, regenerate the parquet cache from the original .RData files.
    only_faults
        Optional iterable of fault numbers to restrict to. ``None`` keeps all
        active faults (1–20 by default).
    """
    paths = ensure_parquet_cache(force=force_rebuild)

    logger.info(
        "Scanning faulty TEP parquet metadata only (then loading sampled runs) from %s",
        config.CACHE_DIR,
    )
    meta_cols = list(config.META_COLUMNS)
    ft_train_meta = pd.read_parquet(paths["faulty_training"], columns=meta_cols)
    ft_test_meta = pd.read_parquet(paths["faulty_testing"], columns=meta_cols)

    train_meta = _drop_pre_injection(ft_train_meta, "training")
    test_meta = _drop_pre_injection(ft_test_meta, "testing")
    train_meta = train_meta.loc[train_meta["faultNumber"] > 0].reset_index(drop=True)
    test_meta = test_meta.loc[test_meta["faultNumber"] > 0].reset_index(drop=True)

    if only_faults is not None:
        only_faults = set(int(f) for f in only_faults)
        train_meta = train_meta[train_meta["faultNumber"].isin(only_faults)]
        test_meta = test_meta[test_meta["faultNumber"].isin(only_faults)]

    runs_budget = max(train_runs_per_fault, test_runs_per_fault)
    run_keys = _sample_run_keys_from_meta_halves(
        train_meta, test_meta, runs_budget, random_state,
    )
    tr_keys = run_keys[run_keys["_tep_source"] == "faulty_training"].drop(
        columns=["_tep_source"],
    )
    te_keys = run_keys[run_keys["_tep_source"] == "faulty_testing"].drop(
        columns=["_tep_source"],
    )
    sampled_tr = _load_parquet_rows_for_keys(
        paths["faulty_training"], "training", tr_keys,
    )
    sampled_te = _load_parquet_rows_for_keys(
        paths["faulty_testing"], "testing", te_keys,
    )
    sampled = pd.concat([sampled_tr, sampled_te], ignore_index=True)

    feature_cols = config.FEATURE_COLUMNS
    X = sampled[feature_cols].reset_index(drop=True)
    y = sampled[config.TARGET_COLUMN].astype(int).reset_index(drop=True)
    meta = sampled[config.META_COLUMNS].reset_index(drop=True)

    X_tr, X_te, y_tr, y_te, m_tr, m_te = train_test_split(
        X, y, meta,
        test_size=0.15,
        random_state=random_state,
        stratify=y,
    )
    val_ratio = 0.15 / (1.0 - 0.15)
    X_train, X_val, y_train, y_val, meta_train, meta_val = train_test_split(
        X_tr, y_tr, m_tr,
        test_size=val_ratio,
        random_state=random_state,
        stratify=y_tr,
    )

    X_test = X_te.reset_index(drop=True)
    y_test = y_te.reset_index(drop=True)
    meta_test = m_te.reset_index(drop=True)

    logger.info(
        "Final shapes (70/15/15): train=%s val=%s test=%s",
        X_train.shape, X_val.shape, X_test.shape,
    )
    return TEPDataset(
        X_train=X_train, y_train=y_train,
        X_val=X_val, y_val=y_val,
        X_test=X_test, y_test=y_test,
        meta_train=meta_train, meta_val=meta_val, meta_test=meta_test,
        feature_columns=feature_cols,
    )


# ---------------------------------------------------------------------------
# Streaming helper for the smart-factory simulation
# ---------------------------------------------------------------------------
def stream_simulation_run(
    fault_number: int,
    split: str = "testing",
    simulation_run: Optional[int] = None,
    random_state: int = 0,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Return one full simulation run as if it were live plant telemetry.

    The dashboard layer can then iterate row by row to mimic a real
    sensor stream feeding the predictive-maintenance engine.

    Returns
    -------
    features : DataFrame of shape (n_samples, n_features)
    meta     : DataFrame of shape (n_samples, len(META_COLUMNS))
    """
    paths = ensure_parquet_cache()
    key = f"{'fault_free' if fault_number == 0 else 'faulty'}_{split}"
    df = pd.read_parquet(paths[key])
    df = df[df["faultNumber"] == int(fault_number)]
    if df.empty:
        raise ValueError(f"No simulation found for fault={fault_number} split={split}")
    rng = np.random.default_rng(random_state)
    runs = df["simulationRun"].unique()
    chosen = int(simulation_run) if simulation_run is not None else int(rng.choice(runs))
    sim = df[df["simulationRun"] == chosen].sort_values("sample").reset_index(drop=True)
    return sim[config.FEATURE_COLUMNS], sim[config.META_COLUMNS]
