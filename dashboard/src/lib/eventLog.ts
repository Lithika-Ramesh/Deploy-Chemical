export type EventLogEntryType = "log" | "warning" | "resolved";

export interface EventLogEntry {
  time: string;
  type: EventLogEntryType;
  icon: string;
  text: string;
}

export function buildEventLog(hardestFaultSentence: string): EventLogEntry[] {
  return [
    {
      time: "Today, 09:14",
      type: "log",
      icon: "✅",
      text: "AI model checked against test data — performing as expected across 21 fault types",
    },
    {
      time: "Today, 07:30",
      type: "warning",
      icon: "📊",
      text: hardestFaultSentence,
    },
    {
      time: "Yesterday",
      type: "log",
      icon: "🔁",
      text: "Model last trained on 847 simulated plant runs spanning all known fault scenarios",
    },
    {
      time: "3 days ago",
      type: "resolved",
      icon: "⚠️",
      text: "Separator pressure showed early deviation pattern — investigated and resolved before escalation",
    },
  ];
}

export const DEFAULT_HARDEST_FAULT_TEXT =
  "Hardest fault to detect: Feed composition shift — caught in 6 of 10 cases. Operators should monitor feed sensors manually.";
