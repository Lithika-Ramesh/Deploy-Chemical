/** Shapes for optional `/public/data/binary_results.json` and `multiclass_results.json`. */

export interface BinaryResultsArtifact {
  generated_at?: string;
  /** 0–100: interpreted as AI confidence the plant is in a normal state */
  plant_health_pct?: number;
  /** Hours since last meaningful alert; omit or null if none */
  last_alert_hours_ago?: number | null;
  /** Share of fault periods correctly flagged (0–1) */
  recall?: number;
  /**
   * Average unnecessary alerts per hour during normal operation.
   * Display uses reciprocal: "1 in X hours" when X = 1/rate.
   */
  false_alarms_per_normal_hour?: number;
  open_incidents?: number;
}

export interface MulticlassPerClassRow {
  label: number;
  recall: number;
  name?: string;
}

export interface MulticlassResultsArtifact {
  generated_at?: string;
  per_class?: MulticlassPerClassRow[];
}

/** Optional champion class distribution snapshot for narrative panels */
export interface ChampionProbabilitiesArtifact {
  generated_at?: string;
  /** class id 0 = normal, 1–21 = TEP faults; values are percentages 0–100 */
  classes?: Array<{ id: number; pct: number }>;
}

export const FALLBACK_BINARY: Required<
  Pick<
    BinaryResultsArtifact,
    | "plant_health_pct"
    | "last_alert_hours_ago"
    | "recall"
    | "false_alarms_per_normal_hour"
    | "open_incidents"
  >
> & { generated_at?: string } = {
  generated_at: undefined,
  plant_health_pct: 94,
  last_alert_hours_ago: 3,
  recall: 0.9,
  false_alarms_per_normal_hour: 0.2,
  open_incidents: 2,
};

export const FALLBACK_MULTICLASS: MulticlassResultsArtifact = {
  generated_at: undefined,
  per_class: [
    { label: 2, recall: 0.6, name: "Feed composition shift" },
    { label: 1, recall: 0.85, name: "Feed flow disturbance" },
  ],
};
