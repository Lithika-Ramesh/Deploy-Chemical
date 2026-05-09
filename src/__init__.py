"""AIFI - AI Fault Intelligence pipeline for the Tennessee Eastman Process.

This package implements an end-to-end Industry 4.0 predictive-maintenance
prototype for a smart chemical plant. The submodules are organised so that
each step of the workflow (loading, preprocessing, EDA, modelling,
evaluation, explainability and smart-factory simulation) can be reused
either from a notebook, the CLI orchestrator (``src.pipeline``) or the
FastAPI service in ``api/main.py``.
"""

from importlib import metadata as _metadata

try:
    __version__ = _metadata.version("aifi-tep")
except _metadata.PackageNotFoundError:
    __version__ = "0.1.0"
