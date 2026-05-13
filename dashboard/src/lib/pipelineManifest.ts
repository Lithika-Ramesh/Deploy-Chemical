/**
 * Parses `GET /metrics` from the AIFI FastAPI app, which returns the same JSON
 * as `outputs/reports/manifest.json` from `python -m src.pipeline` /
 * `notebooks/tep_pipeline.ipynb`.
 */

export type PipelineModelResultRow = {
  model: string;
  f1_macro: number;
  accuracy: number;
  precision_macro: number;
  recall_macro: number;
};

export type ParsedPipelineSummary = {
  bestModel: string | null;
  bestF1Macro: number | null;
  bestTestAccuracy: number | null;
  featureCount: number | null;
  nClasses: number | null;
  datasetRows: { train?: number; val?: number; test?: number } | null;
  results: PipelineModelResultRow[];
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function parsePipelineManifest(raw: unknown): ParsedPipelineSummary | null {
  if (raw == null || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;

  const bestModel = str(m.best_model);
  const resultsIn = Array.isArray(m.results) ? m.results : [];
  const results: PipelineModelResultRow[] = [];
  for (const row of resultsIn) {
    if (row == null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const model = str(r.model);
    if (!model) continue;
    const f1 = num(r.f1_macro);
    const acc = num(r.accuracy);
    if (f1 == null || acc == null) continue;
    results.push({
      model,
      f1_macro: f1,
      accuracy: acc,
      precision_macro: num(r.precision_macro) ?? 0,
      recall_macro: num(r.recall_macro) ?? 0,
    });
  }

  const bestRow =
    bestModel != null ? results.find((r) => r.model === bestModel) : results[0];

  let featureCount: number | null = null;
  if (Array.isArray(m.feature_columns)) {
    featureCount = m.feature_columns.length;
  }

  let nClasses: number | null = null;
  let datasetRows: ParsedPipelineSummary["datasetRows"] = null;
  if (m.dataset != null && typeof m.dataset === "object") {
    const d = m.dataset as Record<string, unknown>;
    nClasses = num(d.n_classes);
    datasetRows = {
      train: num(d.train_rows) ?? undefined,
      val: num(d.val_rows) ?? undefined,
      test: num(d.test_rows) ?? undefined,
    };
  }

  if (!bestModel && results.length === 0 && featureCount == null) return null;

  return {
    bestModel,
    bestF1Macro: bestRow ? bestRow.f1_macro : null,
    bestTestAccuracy: bestRow ? bestRow.accuracy : null,
    featureCount,
    nClasses,
    datasetRows,
    results,
  };
}
