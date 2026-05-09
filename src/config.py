"""Project-wide configuration for the AIFI Tennessee Eastman pipeline.

Keeping every magic number, file path and domain-knowledge dictionary in
one module makes the rest of the codebase trivially auditable - which
matters when the system is being framed as an Industry 4.0 prototype for
a real chemical plant where every threshold can be traced back to a
documented source.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

# ---------------------------------------------------------------------------
# Filesystem layout
# ---------------------------------------------------------------------------
PROJECT_ROOT: Path = Path(__file__).resolve().parents[1]
DATASET_DIR: Path = PROJECT_ROOT / "dataset"
OUTPUT_DIR: Path = PROJECT_ROOT / "outputs"
FIGURE_DIR: Path = OUTPUT_DIR / "figures"
MODEL_DIR: Path = OUTPUT_DIR / "models"
REPORT_DIR: Path = OUTPUT_DIR / "reports"
PREDICTION_DIR: Path = OUTPUT_DIR / "predictions"
CACHE_DIR: Path = OUTPUT_DIR / "cache"

for _p in (FIGURE_DIR, MODEL_DIR, REPORT_DIR, PREDICTION_DIR, CACHE_DIR):
    _p.mkdir(parents=True, exist_ok=True)

# Raw RData files shipped with the project
RDATA_FILES: Dict[str, Path] = {
    "fault_free_training": DATASET_DIR / "TEP_FaultFree_Training.RData",
    "fault_free_testing":  DATASET_DIR / "TEP_FaultFree_Testing.RData",
    "faulty_training":     DATASET_DIR / "TEP_Faulty_Training.RData",
    "faulty_testing":      DATASET_DIR / "TEP_Faulty_Testing.RData",
}

# ---------------------------------------------------------------------------
# Tennessee Eastman feature schema
# ---------------------------------------------------------------------------
META_COLUMNS: List[str] = ["faultNumber", "simulationRun", "sample"]
XMEAS_COLUMNS: List[str] = [f"xmeas_{i}" for i in range(1, 42)]   # 41 sensors
XMV_COLUMNS:   List[str] = [f"xmv_{i}"   for i in range(1, 12)]   # 11 valves
FEATURE_COLUMNS: List[str] = XMEAS_COLUMNS + XMV_COLUMNS
TARGET_COLUMN: str = "faultNumber"

# Per the Rieth/Mestl release: in faulty simulations the disturbance is
# only injected after sample 20 (training) or sample 160 (testing).
# Anything before that is genuinely fault-free and would otherwise
# poison the labels.
FAULT_INJECTION_SAMPLE: Dict[str, int] = {
    "training": 20,
    "testing":  160,
}

# ---------------------------------------------------------------------------
# Sub-sampling defaults
# ---------------------------------------------------------------------------
# The full faulty training set is 5M rows × 55 cols (~2 GB in RAM). For an
# end-to-end demo on a laptop we randomly pick a subset of simulation
# runs per fault class. These can be overridden from the CLI.
@dataclass(frozen=True)
class SamplingConfig:
    train_runs_per_fault: int = 30   # of 500 available
    test_runs_per_fault:  int = 15   # of 500 available
    random_state: int = 42


DEFAULT_SAMPLING = SamplingConfig()

# ---------------------------------------------------------------------------
# Modelling defaults
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ModelConfig:
    random_state: int = 42
    n_jobs: int = -1
    rf_n_estimators: int = 250
    rf_max_depth: int | None = 25
    xgb_n_estimators: int = 400
    xgb_max_depth: int = 8
    xgb_learning_rate: float = 0.08
    xgb_subsample: float = 0.9
    xgb_colsample_bytree: float = 0.9
    test_size: float = 0.2          # used when no separate test parquet exists
    shap_sample_size: int = 1000    # SHAP TreeExplainer is O(N), keep tractable


DEFAULT_MODEL = ModelConfig()

# ---------------------------------------------------------------------------
# Industrial domain knowledge: fault catalogue
# ---------------------------------------------------------------------------
# Source: Downs & Vogel 1993 "A plant-wide industrial process control
# problem" plus the Rieth et al. 2017 dataset description.
FAULT_CATALOG: Dict[int, Dict[str, str]] = {
    0:  {"name": "Normal Operation",
         "description": "All process variables within steady-state envelope.",
         "type": "Normal",
         "severity": "NONE",
         "action": "Continue routine monitoring."},
    1:  {"name": "A/C Feed Ratio Step Change",
         "description": "Stream 4 A/C feed ratio steps (B held constant).",
         "type": "Step",
         "severity": "MEDIUM",
         "action": "Verify feed-ratio controller setpoint and flow meters on stream 4."},
    2:  {"name": "B Composition Step Change",
         "description": "B composition in stream 4 steps (A/C ratio constant).",
         "type": "Step",
         "severity": "MEDIUM",
         "action": "Inspect feed gas chromatograph and stream 4 composition analyser."},
    3:  {"name": "D Feed Temperature Step",
         "description": "Step disturbance on stream 2 (D feed) inlet temperature.",
         "type": "Step",
         "severity": "LOW",
         "action": "Check D-feed pre-heater and upstream heat exchanger fouling."},
    4:  {"name": "Reactor Cooling Inlet Temperature Step",
         "description": "Reactor cooling water inlet temperature step disturbance.",
         "type": "Step",
         "severity": "HIGH",
         "action": "Inspect reactor cooling water supply, heat-exchanger fouling, cooling tower."},
    5:  {"name": "Condenser Cooling Inlet Temperature Step",
         "description": "Condenser cooling water inlet temperature step disturbance.",
         "type": "Step",
         "severity": "MEDIUM",
         "action": "Inspect condenser cooling-water supply temperature and flow."},
    6:  {"name": "A Feed Loss",
         "description": "Stream 1 (A feed) loss - severe loss of reactant.",
         "type": "Step",
         "severity": "CRITICAL",
         "action": "EMERGENCY: verify stream 1 valves, isolate, switch to backup feed line."},
    7:  {"name": "C Header Pressure Loss",
         "description": "Stream 4 C header pressure loss - reduced availability.",
         "type": "Step",
         "severity": "HIGH",
         "action": "Inspect stream 4 header pressure regulator and supply compressor."},
    8:  {"name": "A/B/C Feed Composition Random Variation",
         "description": "Random variation in feed composition of A, B and C in stream 4.",
         "type": "Random",
         "severity": "MEDIUM",
         "action": "Recalibrate composition analyser and review supplier feed quality logs."},
    9:  {"name": "D Feed Temperature Random Variation",
         "description": "Random variation in stream 2 D-feed temperature.",
         "type": "Random",
         "severity": "LOW",
         "action": "Inspect D-feed temperature sensor and pre-heater control loop."},
    10: {"name": "C Feed Temperature Random Variation",
         "description": "Random variation in stream 4 C-feed temperature.",
         "type": "Random",
         "severity": "LOW",
         "action": "Inspect stream 4 inlet temperature sensor and pre-heater."},
    11: {"name": "Reactor Cooling Inlet Temperature Random",
         "description": "Random variation in reactor cooling water inlet temperature.",
         "type": "Random",
         "severity": "HIGH",
         "action": "Inspect cooling water supply line, pumps and tower performance."},
    12: {"name": "Condenser Cooling Inlet Temperature Random",
         "description": "Random variation in condenser cooling water inlet temperature.",
         "type": "Random",
         "severity": "MEDIUM",
         "action": "Inspect condenser cooling water supply and pump performance."},
    13: {"name": "Reaction Kinetics Slow Drift",
         "description": "Slow drift in reaction kinetics - possible catalyst degradation.",
         "type": "Drift",
         "severity": "HIGH",
         "action": "Schedule catalyst sampling and assay; plan catalyst replacement window."},
    14: {"name": "Reactor Cooling Valve Sticking",
         "description": "Reactor cooling water valve sticking - actuator fault.",
         "type": "Sticking",
         "severity": "CRITICAL",
         "action": "EMERGENCY: dispatch maintenance to reactor cooling valve actuator."},
    15: {"name": "Condenser Cooling Valve Sticking",
         "description": "Condenser cooling water valve sticking - actuator fault.",
         "type": "Sticking",
         "severity": "HIGH",
         "action": "Dispatch maintenance to condenser cooling valve actuator."},
    16: {"name": "Unknown Disturbance #16",
         "description": "Undocumented fault pattern - investigate process state.",
         "type": "Unknown",
         "severity": "MEDIUM",
         "action": "Trigger forensic data review; involve process engineer."},
    17: {"name": "Unknown Disturbance #17",
         "description": "Undocumented fault pattern - investigate process state.",
         "type": "Unknown",
         "severity": "MEDIUM",
         "action": "Trigger forensic data review; involve process engineer."},
    18: {"name": "Unknown Disturbance #18",
         "description": "Undocumented fault pattern - investigate process state.",
         "type": "Unknown",
         "severity": "MEDIUM",
         "action": "Trigger forensic data review; involve process engineer."},
    19: {"name": "Unknown Disturbance #19",
         "description": "Undocumented fault pattern - investigate process state.",
         "type": "Unknown",
         "severity": "MEDIUM",
         "action": "Trigger forensic data review; involve process engineer."},
    20: {"name": "Unknown Disturbance #20",
         "description": "Undocumented fault pattern - investigate process state.",
         "type": "Unknown",
         "severity": "MEDIUM",
         "action": "Trigger forensic data review; involve process engineer."},
}

# Plant-status flag derived from severity - used by the smart-factory layer.
SEVERITY_TO_STATUS: Dict[str, str] = {
    "NONE":     "NORMAL",
    "LOW":      "ADVISORY",
    "MEDIUM":   "WARNING",
    "HIGH":     "ALERT",
    "CRITICAL": "EMERGENCY",
}

# Numeric severity ranking for dashboard sorting / colour coding.
SEVERITY_RANK: Dict[str, int] = {
    "NONE": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4,
}


def get_fault_label(fault_id: int) -> str:
    """Human-readable fault name for any TEP fault number."""
    return FAULT_CATALOG.get(int(fault_id), {"name": f"Unknown ({fault_id})"})["name"]


def get_severity(fault_id: int) -> str:
    return FAULT_CATALOG.get(int(fault_id), {"severity": "MEDIUM"})["severity"]


def get_recommended_action(fault_id: int) -> str:
    return FAULT_CATALOG.get(int(fault_id),
                             {"action": "Investigate anomaly with process engineer."})["action"]


def get_plant_status(fault_id: int) -> str:
    return SEVERITY_TO_STATUS.get(get_severity(fault_id), "WARNING")
