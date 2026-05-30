export type OperatingMode = "storm" | "save" | "sell" | "holiday";

export interface OperatingModeInfo {
  id: OperatingMode;
  name: string;
  tagline: string;
  description: string;
  accent: "navy" | "energy";
}
