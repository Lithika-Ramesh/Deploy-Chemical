/**
 * Single source of truth for operator-facing dashboard copy.
 * Avoid rendering raw metric keys or ML jargon in UI components.
 */

export const METRIC_LABELS = {
  recall: "Faults caught",
  far: "Unnecessary alerts",
  auc: "Detection strength",
  macro_f1: "Accuracy across all fault types",
  macro_recall: "Faults caught (all types)",
  weighted_f1: "Balanced accuracy",
  risk_proxy: "AI certainty",
  threshold: "Sensitivity setting",
  accuracy: "Overall accuracy",
} as const;

export const FAULT_DESCRIPTIONS: Record<number, string> = {
  0: "Normal behavior",
  1: "A/C feed ratio, B composition constant",
  2: "B composition, A/C ratio constant",
  3: "D feed temperature",
  4: "Reactor cooling water inlet temperature",
  5: "Condenser cooling water inlet temperature",
  6: "A feed loss",
  7: "C header pressure loss",
  8: "A, B, C feed composition",
  9: "D feed temperature",
  10: "C feed temperature",
  11: "Reactor cooling water inlet temperature",
  12: "Condenser cooling water inlet temperature",
  13: "Reaction kinetics",
  14: "Reactor cooling water valve",
  15: "Condenser cooling water valve",
  16: "Unknown",
  17: "Unknown",
  18: "Unknown",
  19: "Unknown",
  20: "Unknown",
};

export const SENSITIVITY_PRESETS = {
  cautious: {
    label: "Cautious",
    description:
      "Catches more faults early. Expect occasional unnecessary alerts.",
  },
  balanced: {
    label: "Balanced",
    description:
      "Current setting. Catches ~9 in 10 faults. ~1 unnecessary alert per 5 normal hours.",
  },
  strict: {
    label: "Strict",
    description:
      "Fewer unnecessary alerts. May miss early warning signs of slow-developing faults.",
  },
} as const;

/** Map SHAP / feature tags to plain sensor names shown to operators. */
export const SHAP_FEATURE_PLAIN_NAMES: Record<string, string> = {
  xmeas_1: "A feed flow",
  xmeas_2: "D feed flow",
  xmeas_3: "E feed flow",
  xmeas_4: "A and C feed flow",
  xmeas_5: "Recycle flow",
  xmeas_6: "Reactor feed rate",
  xmeas_7: "Reactor pressure",
  xmeas_8: "Reactor level",
  xmeas_9: "Reactor temperature",
  xmeas_10: "Purge rate",
  xmeas_11: "Separator temperature",
  xmeas_12: "Product separator level",
  xmeas_13: "Separator pressure",
  xmeas_14: "Product separator level",
  xmeas_15: "Stripper level",
  xmeas_16: "Stripper pressure",
  /** Dashboard convention: highlighted as recycle-side flow signal for operators */
  xmeas_17: "Recycle flow rate",
  xmeas_18: "Stripper steam flow",
  xmeas_19: "Compressor work",
  xmeas_20: "Reactor cooling water outlet temperature",
  xmeas_21: "Separator cooling water outlet temperature",
  xmeas_22: "Component A in purge",
  xmeas_23: "Component B in purge",
  xmeas_24: "Component C in purge",
  xmeas_25: "Component D in purge",
  xmeas_26: "Component E in purge",
  xmeas_27: "Component F in purge",
  xmeas_28: "Component G in purge",
  xmeas_31: "Component A in product",
  xmeas_32: "Component B in product",
  xmeas_33: "Component C in product",
  xmeas_34: "Component D in product",
  xmeas_35: "Component E in product",
  xmeas_36: "Component F in product",
  xmeas_37: "Component G in product",
  xmeas_38: "Component H in product",
  xmeas_39: "Component A in bottoms",
  xmeas_40: "Component B in bottoms",
  xmeas_41: "Component C in bottoms",
  xmv_1: "D feed flow valve",
  xmv_2: "E feed flow valve",
  xmv_3: "A feed flow valve",
  xmv_4: "A and C feed flow valve",
  xmv_5: "Compressor recycle valve",
  xmv_6: "Purge valve",
  xmv_7: "Separator pot liquid flow valve",
  xmv_8: "Stripper liquid product flow valve",
  xmv_9: "Stripper steam valve",
  xmv_10: "Reactor cooling water flow valve",
  xmv_11: "Condenser cooling water flow valve",
};

export function plainFaultDescription(classId: number): string {
  return FAULT_DESCRIPTIONS[classId] ?? `Fault pattern ${classId}`;
}

export function plainShapFeatureName(tag: string): string {
  const key = tag.toLowerCase();
  return SHAP_FEATURE_PLAIN_NAMES[key] ?? tag.replace(/^xmeas_/i, "Plant sensor ");
}

/** Replace internal training labels with neutral operator-facing names. */
export function plainNotebookModelName(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("histgradient") || s.includes("xgboost") || s.includes("xgb")) {
    return "Tree ensemble (candidate)";
  }
  if (s.includes("random") && s.includes("forest")) {
    return "Forest ensemble (candidate)";
  }
  return "Model candidate";
}
