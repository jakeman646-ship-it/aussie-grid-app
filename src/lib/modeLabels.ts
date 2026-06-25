export function formatModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    save: "Save",
    self_consume: "Self-Consume",
    sell: "Sell to Grid",
    storm: "Storm Reserve",
  };
  const key = mode.toLowerCase().trim();
  return labels[key] || mode;
}

export function formatModeHeadline(mode: string): string {
  return formatModeLabel(mode);
}

export function formatGridFlow(kw: number): string {
  if (kw > 0) return `Importing ${kw.toFixed(1)} kW`;
  if (kw < 0) return `Exporting ${Math.abs(kw).toFixed(1)} kW`;
  return "Balanced";
}

export function formatConfidence(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}

export function formatTimestamp(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
