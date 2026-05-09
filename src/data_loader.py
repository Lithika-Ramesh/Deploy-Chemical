"""Tennessee Eastman dataset loader with parquet caching and sub-sampling.

The raw R datasets are large (the faulty training file alone unpacks to
roughly 5 million rows × 55 columns ≈ 2 GB of RAM). We therefore:

1. Convert each ``.RData`` file to parquet on first use - the conversion
   is the slow step but only happens once.
2. Read the parquet cache and randomly select ``train_runs_per_fault``
   simulation runs per fault class. This produces a balanced, memory
   friendly dataset that still covers every disturbance pattern.
3. Drop the pre-injection samples from faulty simulations - in TEP the
   disturbance is only introduced after sample 20 (training) or sample
   160 (testing); earlier samples are genuine fault-free behaviour and
   would otherwise corrupt the labels.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

import numpy as np
import pandas as pd

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
    """Container holding a usable train/test split of the TEP data."""
    X_train: pd.DataFrame
    y_train: pd.Series
    X_test:  pd.DataFrame
    y_test:  pd.Series
    meta_train: pd.DataFrame
    meta_test:  pd.DataFrame
    feature_columns: list

    def class_distribution(self) -> pd.DataFrame:
        return pd.DataFrame({
            "train": self.y_train.value_counts().sort_index(),
            "test":  self.y_test.value_counts().sort_index(),
        }).fillna(0).astype(int)

    def summary(self) -> Dict[str, int]:
        return {
            "train_rows": len(self.X_train),
            "test_rows":  len(self.X_test),
            "n_features": len(self.feature_columns),
            "n_classes":  int(pd.concat([self.y_train, self.y_test]).nunique()),
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
    """Build a memory-friendly TEP train/test dataset.

    Parameters
    ----------
    train_runs_per_fault, test_runs_per_fault
        How many of the 500 simulation runs per fault class to retain.
    random_state
        Seeds the run-selection RNG for reproducibility.
    force_rebuild
        If True, regenerate the parquet cache from the original .RData files.
    only_faults
        Optional iterable of fault numbers to restrict the dataset to (handy
        for very fast smoke tests). ``None`` keeps all 21 classes.
    """
    paths = ensure_parquet_cache(force=force_rebuild)

    logger.info("Loading parquet cache from %s", config.CACHE_DIR)
    ff_train = pd.read_parquet(paths["fault_free_training"])
    ff_test  = pd.read_parquet(paths["fault_free_testing"])
    ft_train = pd.read_parquet(paths["faulty_training"])
    ft_test  = pd.read_parquet(paths["faulty_testing"])

    train_full = pd.concat([ff_train, ft_train], ignore_index=True)
    test_full  = pd.concat([ff_test,  ft_test],  ignore_index=True)

    train_full = _drop_pre_injection(train_full, "training")
    test_full  = _drop_pre_injection(test_full,  "testing")

    if only_faults is not None:
        only_faults = set(int(f) for f in only_faults)
        train_full = train_full[train_full["faultNumber"].isin(only_faults)]
        test_full  = test_full[test_full["faultNumber"].isin(only_faults)]

    train = _sample_runs(train_full, train_runs_per_fault, random_state)
    test  = _sample_runs(test_full,  test_runs_per_fault,  random_state + 1)

    feature_cols = config.FEATURE_COLUMNS
    X_train = train[feature_cols].reset_index(drop=True)
    y_train = train[config.TARGET_COLUMN].astype(int).reset_index(drop=True)
    X_test  = test[feature_cols].reset_index(drop=True)
    y_test  = test[config.TARGET_COLUMN].astype(int).reset_index(drop=True)
    meta_train = train[config.META_COLUMNS].reset_index(drop=True)
    meta_test  = test[config.META_COLUMNS].reset_index(drop=True)

    logger.info("Final shapes: X_train=%s X_test=%s", X_train.shape, X_test.shape)
    return TEPDataset(
        X_train=X_train, y_train=y_train,
        X_test=X_test,   y_test=y_test,
        meta_train=meta_train, meta_test=meta_test,
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
