/**
 * Aussie Grid — Connection request approval helper
 * File: src/lib/api/approveConnectionRequest.ts
 * Version: v0.1.2.20
 * Lines: 122
 * Updated: 7 Jul 2026 — transfer Sungrow site_id → sungrow_plant_id and
 *          inverter_serial; promote is_test → false on approve.
 */
import { supabase } from "@/lib/supabase";

export interface ConnectionRequestRow {
  id: string;
  household_id: string;
  site_id: string;
  account_email: string;
  account_password?: string | null;
  inverter_brand: string | null;
  inverter_serial?: string | null;
  notes?: string | null;
}

export function getTeslaMissingFields(req: ConnectionRequestRow): string[] {
  const missing: string[] = [];
  if (!req.site_id?.trim()) missing.push("Energy Site ID");
  if (!req.account_email?.trim()) missing.push("Tesla account email");
  if (!req.account_password?.trim()) missing.push("Tesla account password");
  return missing;
}

export function buildHouseholdPayloadFromRequest(
  req: ConnectionRequestRow,
  options: { promoteToReal?: boolean; onboardingNotes?: string } = {}
): Record<string, unknown> {
  const { promoteToReal = true, onboardingNotes } = options;
  const isTesla = (req.inverter_brand || "").trim().toLowerCase() === "tesla";
  const make = req.inverter_brand || "Sungrow";
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    household_id: req.household_id,
    email: req.account_email,
    status: "active",
    inverter_make: make,
    consent_given: true,
    updated_at: now,
    onboarding_notes: onboardingNotes ?? req.notes ?? "Approved via Requests page",
  };

  if (promoteToReal) {
    payload.is_test = false;
  }

  if (isTesla) {
    Object.assign(payload, {
      tesla_site_id: req.site_id?.trim() || null,
      tesla_connected_at: now,
      tesla_account_email: req.account_email,
      tesla_account_password: req.account_password,
    });
  } else {
    const serial = req.inverter_serial?.trim();
    Object.assign(payload, {
      sungrow_plant_id: req.site_id?.trim() || null,
      sungrow_connected_at: now,
      ...(serial ? { inverter_serial: serial } : {}),
    });
  }

  return payload;
}

export async function approveConnectionRequest(
  req: ConnectionRequestRow,
  options: { promoteToReal?: boolean } = {}
): Promise<"added" | "updated"> {
  const householdPayload = buildHouseholdPayloadFromRequest(req, options);

  const { data: existing } = await supabase
    .from("pilot_households")
    .select("household_id")
    .eq("household_id", req.household_id)
    .maybeSingle();

  const writeHousehold = async (payload: Record<string, unknown>) => {
    if (existing) {
      const { error } = await supabase
        .from("pilot_households")
        .update(payload)
        .eq("household_id", req.household_id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("pilot_households").insert(payload);
      if (error) throw error;
    }
  };

  try {
    await writeHousehold(householdPayload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      "inverter_serial" in householdPayload &&
      (msg.includes("inverter_serial") || msg.includes("PGRST204"))
    ) {
      const { inverter_serial: _serial, ...withoutSerial } = householdPayload;
      console.warn(
        "pilot_households.inverter_serial column missing — run scripts/sungrow_connection_columns.sql"
      );
      await writeHousehold(withoutSerial);
    } else {
      throw err;
    }
  }

  const { error: reqError } = await supabase
    .from("pilot_connection_requests")
    .update({ status: "approved" })
    .eq("id", req.id);
  if (reqError) throw reqError;

  return existing ? "updated" : "added";
}
