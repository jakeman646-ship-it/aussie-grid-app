export interface AgentDecisionReasoning {
  proposal?: { mode?: string };
  final?: { mode?: string };
  weather?: {
    tomorrow_irradiance_kwh_m2?: number;
    low_solar_forecast?: boolean;
  };
  context?: {
    battery_soc?: number;
    solar_power_w?: number;
  };
}

export interface AgentDecision {
  mode: string;
  reason: string;
  confidence?: number;
  verification_passed?: boolean;
  severity?: string;
  harmony_influenced?: boolean;
  harmony_recommendation?: string;
  tomorrow_irradiance_kwh_m2?: number;
  reasoning?: AgentDecisionReasoning;
}