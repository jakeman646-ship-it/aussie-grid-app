/**
 * Aussie Grid — ConnectInverter
 * File: src/components/ConnectInverter.tsx
 * Version: v0.1.5.1
 * Updated: 29 Aug 2026 — optional bill rates after 4-digit postcode; NSW still unpriced.
 */
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { AppVersionBadge } from "@/components/common/AppVersionBadge";
import {
  supabase,
  queryTimeout,
  isSupabaseConfigured,
  getSupabaseConfigIssue,
} from "@/lib/supabase";
import {
  submitConnectionRequest,
  mapConnectionSubmitError,
  isTransientFetchError,
  type InverterMake,
} from "@/lib/api/submitConnectionRequest";
import { suggestTariffFromPostcode } from "@/lib/dnspLookup";

export interface ConnectInverterProps {
  onBack?: () => void;
  onConnectionComplete?: () => void;
  currentHouseholdId?: string;
}

type SupplyPhase = "1" | "3";

interface FormData {
  householdLabel: string;
  supplyPhase: SupplyPhase;
  accountEmail: string;
  accountPassword: string;
  siteId: string;
  inverterSerial: string;
  notes: string;
  postcode: string;
  suburb: string;
  state: string;
  /** Optional owner-entered bill rates — display ¢/kWh; converted to $/kWh on submit. */
  retailPlanName: string;
  retailPeakCents: string;
  retailShoulderCents: string;
  retailOffPeakCents: string;
  retailFitCents: string;
}

const SUPPLY_PHASE_OPTIONS: { value: SupplyPhase; label: string }[] = [
  { value: "1", label: "Single Phase (230V)" },
  { value: "3", label: "Three Phase (400V)" },
];

const STATE_OPTIONS = [
  "QLD",
  "NSW",
  "VIC",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
] as const;

interface ConnectionStatus {
  status: "none" | "pending" | "connected";
  message?: string;
}

const INVERTER_OPTIONS: { value: InverterMake; label: string }[] = [
  { value: "Sungrow", label: "Sungrow (iSolarCloud)" },
  { value: "Tesla", label: "Tesla (Powerwall / Energy)" },
];

const INVERTER_COPY: Record<
  InverterMake,
  {
    title: string;
    emailLabel: string;
    emailHint: string;
    siteLabel: string;
    siteHint: string;
    sitePlaceholder: string;
    steps: string[];
    successVerify: string;
  }
> = {
  Sungrow: {
    title: "Connect your Sungrow system",
    emailLabel: "Sungrow iSolarCloud account email",
    emailHint: "The email you use to log into iSolarCloud",
    siteLabel: "Site ID / Plant ID",
    siteHint: "Found in iSolarCloud → Plant → Settings → General information",
    sitePlaceholder: "e.g. 123456789 or PLANT-ABC123",
    steps: [
      "Log into your Sungrow iSolarCloud account",
      "Go to your plant → Settings → General information and copy the Plant ID (Site ID)",
      "(Optional) Copy your inverter's Serial Number",
      "Enter your iSolarCloud account email and Plant ID below",
      "Continue to connect with iSolarCloud — you'll approve read-only access as the plant owner (no password needed here).",
    ],
    successVerify:
      "We verify your Site ID and continue with secure iSolarCloud owner approval for read-only monitoring",
  },
  Tesla: {
    title: "Connect your Tesla system",
    emailLabel: "Tesla account email",
    emailHint: "The email you use to log into the Tesla app or Tesla.com",
    siteLabel: "Energy Site ID",
    siteHint: "Found in the Tesla app under Energy → your site, or from your installer",
    sitePlaceholder: "e.g. 1234567890",
    steps: [
      "Log into your Tesla account (app or tesla.com)",
      "Open your energy site and copy the Site ID",
      "Enter your Tesla account email and password below so we can request read-only access",
      "We'll review and activate read-only data access on your behalf.",
    ],
    successVerify: "We verify your Site ID and request read-only access from Tesla",
  },
};

const EMPTY_FORM: FormData = {
  householdLabel: "",
  supplyPhase: "1",
  accountEmail: "",
  accountPassword: "",
  siteId: "",
  inverterSerial: "",
  notes: "",
  postcode: "",
  suburb: "",
  state: "QLD",
  retailPlanName: "",
  retailPeakCents: "",
  retailShoulderCents: "",
  retailOffPeakCents: "",
  retailFitCents: "",
};

function optionalRatesCaption(
  dnsp: string | null,
  state: string,
  networkTariffProfile: string | null
): string {
  const d = (dnsp || "").toLowerCase();
  const st = state.trim().toUpperCase();
  const profile = (networkTariffProfile || "").toLowerCase();
  const nsw =
    st === "NSW" ||
    st === "NEW SOUTH WALES" ||
    d === "ausgrid" ||
    d === "endeavour" ||
    d === "essential";
  if (nsw) {
    return "Optional. Stored for later. Bill impact is not priced for NSW yet.";
  }
  if (d === "energex" || profile === "energex_ntc6900") {
    return "From your electricity bill or plan. Used only to estimate savings — not a guarantee. Enter figures in ¢/kWh (e.g. 34 for 34¢). You can skip this and still connect for monitoring.";
  }
  if (d === "ergon" || profile === "ergon_12d") {
    return "Optional. Enter ¢/kWh from your bill if you want an override. Default remains Ergon 12D if you leave this blank.";
  }
  return "Optional. From your bill. Monitoring works without this. Enter ¢/kWh (e.g. 34 for 34¢).";
}

export function ConnectInverter({
  onBack,
  onConnectionComplete,
  currentHouseholdId,
}: ConnectInverterProps) {
  const [inverterMake, setInverterMake] = useState<InverterMake>("Sungrow");
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: "none" });
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [connectivityWarning, setConnectivityWarning] = useState<string | null>(null);

  const configIssue = getSupabaseConfigIssue();

  const copy = INVERTER_COPY[inverterMake];

  const tariffPreview = useMemo(
    () => suggestTariffFromPostcode(formData.postcode, formData.state),
    [formData.postcode, formData.state]
  );

  const postcodeDigits = formData.postcode.replace(/\D/g, "");
  const showTariffPreview = postcodeDigits.length >= 4 && tariffPreview.ok;
  const showOptionalRates = postcodeDigits.length >= 4;

  // Wipe owner-entered cents only when the postcode is cleared — not when DNSP changes.
  useEffect(() => {
    if (postcodeDigits.length > 0) return;
    setFormData((prev) => {
      if (
        !prev.retailPlanName &&
        !prev.retailPeakCents &&
        !prev.retailShoulderCents &&
        !prev.retailOffPeakCents &&
        !prev.retailFitCents
      ) {
        return prev;
      }
      return {
        ...prev,
        retailPlanName: "",
        retailPeakCents: "",
        retailShoulderCents: "",
        retailOffPeakCents: "",
        retailFitCents: "",
      };
    });
  }, [postcodeDigits.length]);

  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!currentHouseholdId) {
        setCheckingStatus(false);
        return;
      }
      setCheckingStatus(true);
      try {
        // Run both checks in parallel so a slow query can't double the wait.
        const [pendingResult, householdResult] = await Promise.all([
          supabase
            .from("pilot_connection_requests")
            .select("id")
            .eq("household_id", currentHouseholdId)
            .eq("status", "pending_review")
            .abortSignal(queryTimeout())
            .limit(1)
            .maybeSingle(),
          supabase
            .from("pilot_households")
            .select("status, sungrow_connected_at, tesla_connected_at")
            .eq("household_id", currentHouseholdId)
            .abortSignal(queryTimeout())
            .maybeSingle(),
        ]);

        if (pendingResult.data?.id) {
          setConnectionStatus({
            status: "pending",
            message: "Your connection request is currently being reviewed by the team.",
          });
          return;
        }

        const household = householdResult.data;

        const isConnected =
          household &&
          (household.status === "active" ||
            household.sungrow_connected_at ||
            household.tesla_connected_at);

        if (isConnected) {
          setConnectionStatus({
            status: "connected",
            message: "This household is already connected and sending live data.",
          });
        } else {
          setConnectionStatus({ status: "none" });
        }
      } catch (err) {
        console.error("Error checking connection status:", err);
        if (isTransientFetchError(err)) {
          setConnectivityWarning(
            "Could not reach the database to check your status. You can still submit a connection request below."
          );
        }
        setConnectionStatus({ status: "none" });
      } finally {
        setCheckingStatus(false);
      }
    };
    checkExistingConnection();
  }, [currentHouseholdId]);

  const handleInverterChange = (make: InverterMake) => {
    setInverterMake(make);
    setFormData((prev) => ({ ...prev, accountPassword: "" }));
    if (error) setError(null);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    if (formData.supplyPhase !== "1" && formData.supplyPhase !== "3") {
      setError("Please select your supply phase (Single Phase or Three Phase).");
      return false;
    }
    if (!formData.siteId.trim()) {
      setError(
        inverterMake === "Tesla"
          ? "Please enter your Tesla Energy Site ID."
          : "Please enter your Sungrow Site ID (Plant ID)."
      );
      return false;
    }
    if (!formData.accountEmail.trim()) {
      setError(
        inverterMake === "Tesla"
          ? "Please enter the email associated with your Tesla account."
          : "Please enter the email associated with your Sungrow iSolarCloud account."
      );
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.accountEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }
    // Sungrow: password not collected — OAuth / owner Accept is the production path.
    if (inverterMake === "Tesla" && !formData.accountPassword.trim()) {
      setError("Please enter your Tesla account password.");
      return false;
    }
    // Location fields are recommended only — never block submit.
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitConnectionRequest({
        inverterMake,
        householdLabel: formData.householdLabel,
        phaseCount: Number(formData.supplyPhase) as 1 | 3,
        siteId: formData.siteId,
        accountEmail: formData.accountEmail,
        // Sungrow: never post a password — owner Accept / OAuth is the real path.
        accountPassword:
          inverterMake === "Tesla" ? formData.accountPassword : undefined,
        inverterSerial: formData.inverterSerial,
        notes: formData.notes,
        currentHouseholdId,
        postcode: formData.postcode,
        suburb: formData.suburb,
        state: formData.state,
        retailPlanName: formData.retailPlanName,
        retailPeakCents: formData.retailPeakCents,
        retailShoulderCents: formData.retailShoulderCents,
        retailOffPeakCents: formData.retailOffPeakCents,
        retailFitCents: formData.retailFitCents,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (result.reusedPending) {
        setConnectionStatus({
          status: "pending",
          message: "Your connection request is already being reviewed. We've refreshed it with your latest details.",
        });
      }

      setIsSubmitted(true);
      onConnectionComplete?.();
    } catch (err: unknown) {
      console.error("Connection request error:", err);
      setError(
        mapConnectionSubmitError(
          err instanceof Error ? err : new Error("Failed to submit request.")
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setIsSubmitted(false);
    setError(null);
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-3xl pt-12 text-center">
          <p className="text-sm text-slate-400">Checking your connection status…</p>
          <div className="mt-6 flex justify-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                ← Back to Dashboard
              </button>
            )}
            <button
              onClick={() => setCheckingStatus(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Skip and show the form
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (connectionStatus.status === "pending" && !isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-2xl pt-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-3xl">⏳</span>
          </div>
          <h1 className="text-2xl font-semibold text-amber-400">Request already submitted</h1>
          <p className="mt-3 text-slate-300">{connectionStatus.message}</p>
          <p className="mt-2 text-sm text-slate-400">
            We&apos;ll email you as soon as it&apos;s approved and your dashboard goes live.
          </p>
          {onBack && (
            <button onClick={onBack} className="mt-8 rounded-xl border border-slate-600 px-6 py-2.5 text-sm hover:bg-slate-900">
              ← Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900">
                ← Back to Dashboard
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-emerald-400">{copy.title}</h1>
              <p className="text-sm text-slate-400">Mackay Pilot — Pre-pilot phase</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                Volunteer homes outside QLD can connect for monitoring. Dollar estimates stay QLD
                (Ergon/Energex) until we have your bill tariff.
              </p>
            </div>
          </div>
        </div>

        {(!isSupabaseConfigured || configIssue) && (
          <div className="mb-6 rounded-lg border border-amber-700/60 bg-amber-950/30 px-5 py-4">
            <p className="text-sm font-medium text-amber-200">Database not connected in this build</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-100/90">
              {configIssue ??
                "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (SUPABASE_URL / publishable key aliases also work), then redeploy so the build picks them up."}
            </p>
          </div>
        )}

        {connectivityWarning && (
          <div className="mb-6 rounded-lg border border-amber-700/60 bg-amber-950/30 px-5 py-4">
            <p className="text-sm text-amber-100/90">{connectivityWarning}</p>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-5 py-4">
          <p className="text-sm font-medium text-emerald-300">Read-only during pre-pilot learning phase</p>
          <p className="mt-1 text-sm leading-relaxed text-emerald-100/90">
            We will only <span className="font-semibold">read</span> data from your solar and battery system.
            We cannot control your inverter or change any settings.
          </p>
        </div>

        {connectionStatus.status === "connected" && (
          <div className="mb-6 rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-5 py-4">
            <p className="text-sm font-medium text-emerald-300">✓ {connectionStatus.message}</p>
            <p className="mt-1 text-sm text-emerald-100/90">
              You can still submit a new request below (e.g. for a different property).
            </p>
          </div>
        )}

        {!isSubmitted ? (
          <>
            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <h2 className="text-lg font-medium text-emerald-400">Why connect your system?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                See your live solar production, battery charge level, and grid flow. Your smart agent will learn from
                your real data to give better daily suggestions.
              </p>
            </div>

            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <h3 className="text-base font-semibold text-emerald-400">How to connect (takes about 2 minutes)</h3>
              <ol className="mt-3 space-y-3 text-sm text-slate-300">
                {copy.steps.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700 bg-slate-900 p-6">
              <h3 className="text-lg font-medium text-emerald-400">Enter your {inverterMake} details</h3>

              {error && (
                <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-5 space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Inverter / system brand <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={inverterMake}
                    onChange={(e) => handleInverterChange(e.target.value as InverterMake)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {INVERTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Household name / label <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.householdLabel}
                    onChange={(e) => handleInputChange("householdLabel", e.target.value)}
                    placeholder="e.g. Jack's Place or 12 Davlyn Dr"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Location — recommended for tariff + weather routing */}
                <div className="rounded-lg border border-slate-700/80 bg-slate-950/50 p-4">
                  <h4 className="text-sm font-semibold text-emerald-400">
                    Your location{" "}
                    <span className="font-normal text-slate-500">(recommended)</span>
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Helps us set the right network tariff (Ergon / Energex) and weather for your area.
                    You can leave these blank and still submit.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">
                        Postcode
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={4}
                        value={formData.postcode}
                        onChange={(e) =>
                          handleInputChange(
                            "postcode",
                            e.target.value.replace(/\D/g, "").slice(0, 4)
                          )
                        }
                        placeholder="4740"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">
                        Suburb
                      </label>
                      <input
                        type="text"
                        autoComplete="address-level2"
                        value={formData.suburb}
                        onChange={(e) => handleInputChange("suburb", e.target.value)}
                        placeholder="Andergrove"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">
                        State
                      </label>
                      <select
                        value={formData.state}
                        onChange={(e) => handleInputChange("state", e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                      >
                        {STATE_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {showTariffPreview && (
                    <div className="mt-3 rounded-md border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100/95">
                      <span className="font-medium text-emerald-300">
                        {tariffPreview.networkTariffProfile
                          ? "Suggested tariff: "
                          : "Suggested network: "}
                      </span>
                      {tariffPreview.summary}
                    </div>
                  )}
                  {!showTariffPreview &&
                    formData.postcode.replace(/\D/g, "").length >= 4 &&
                    !tariffPreview.ok && (
                      <div className="mt-3 rounded-md border border-slate-600/50 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                        {tariffPreview.summary}
                      </div>
                    )}

                  {showOptionalRates && (
                    <div className="mt-4 border-t border-slate-700/70 pt-4">
                      <h4 className="text-sm font-semibold text-emerald-400">
                        Your electricity rates{" "}
                        <span className="font-normal text-slate-500">(optional)</span>
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {optionalRatesCaption(
                          tariffPreview.dnsp,
                          formData.state,
                          tariffPreview.networkTariffProfile
                        )}
                      </p>
                      <div className="mt-3">
                        <label className="mb-1.5 block text-sm font-medium text-slate-300">
                          Plan name{" "}
                          <span className="font-normal text-slate-500">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={formData.retailPlanName}
                          onChange={(e) =>
                            handleInputChange("retailPlanName", e.target.value.slice(0, 120))
                          }
                          placeholder="e.g. Origin TOU"
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-300">
                            Peak ¢/kWh
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.retailPeakCents}
                            onChange={(e) =>
                              handleInputChange(
                                "retailPeakCents",
                                e.target.value.replace(/[^\d.]/g, "")
                              )
                            }
                            placeholder="e.g. 34"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-300">
                            Shoulder ¢/kWh{" "}
                            <span className="font-normal text-slate-500">(if on bill)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.retailShoulderCents}
                            onChange={(e) =>
                              handleInputChange(
                                "retailShoulderCents",
                                e.target.value.replace(/[^\d.]/g, "")
                              )
                            }
                            placeholder="optional"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-300">
                            Off-peak ¢/kWh
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.retailOffPeakCents}
                            onChange={(e) =>
                              handleInputChange(
                                "retailOffPeakCents",
                                e.target.value.replace(/[^\d.]/g, "")
                              )
                            }
                            placeholder="e.g. 22"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-300">
                            Solar feed-in ¢/kWh
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.retailFitCents}
                            onChange={(e) =>
                              handleInputChange(
                                "retailFitCents",
                                e.target.value.replace(/[^\d.]/g, "")
                              )
                            }
                            placeholder="e.g. 8"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Supply Phase <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.supplyPhase}
                    onChange={(e) => handleInputChange("supplyPhase", e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                    required
                  >
                    {SUPPLY_PHASE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Your grid connection type — check your electricity bill or meter box if unsure.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    {copy.emailLabel} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.accountEmail}
                    onChange={(e) => handleInputChange("accountEmail", e.target.value)}
                    placeholder="you@email.com"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">{copy.emailHint}</p>
                  {inverterMake === "Sungrow" && (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                      We connect with secure iSolarCloud owner approval — your password is not
                      required for ongoing monitoring.
                    </p>
                  )}
                </div>

                {inverterMake === "Tesla" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Tesla account password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.accountPassword}
                      onChange={(e) => handleInputChange("accountPassword", e.target.value)}
                      placeholder="Your Tesla account password"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Used only to set up read-only access. Stored securely and never shared.
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    {copy.siteLabel} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.siteId}
                    onChange={(e) => handleInputChange("siteId", e.target.value)}
                    placeholder={copy.sitePlaceholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">{copy.siteHint}</p>
                </div>

                {inverterMake === "Sungrow" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Inverter Serial Number <span className="text-slate-500">(optional but recommended)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.inverterSerial}
                      onChange={(e) => handleInputChange("inverterSerial", e.target.value)}
                      placeholder="e.g. SG1234567890"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-500">On the inverter label or in iSolarCloud under Devices</p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="e.g. 8.2kW system with 13.5kWh battery"
                    rows={2}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || checkingStatus}
                className="mt-6 w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-700"
              >
                {isSubmitting
                  ? "Submitting request… (may take up to a minute on slow connections)"
                  : inverterMake === "Sungrow"
                    ? "Connect with iSolarCloud"
                    : "Submit connection request"}
              </button>

              <p className="mt-3 text-center text-xs text-slate-500">
                We&apos;ll review and activate read-only access, usually within 1–2 business days.
              </p>
            </form>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/10 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-semibold text-emerald-400">Request received — thank you!</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              We&apos;ve received your {inverterMake} connection request and will now review it.
            </p>

            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5 text-left text-sm">
              <p className="mb-2 font-medium text-emerald-300">What happens next:</p>
              <ul className="space-y-1.5 text-slate-300">
                <li>• {copy.successVerify}</li>
                <li>• You&apos;ll receive a confirmation email once approved (usually within 24–48 hours)</li>
                <li>• Your dashboard will then show live solar, battery, and grid data</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {onBack && (
                <button
                  onClick={() => {
                    onConnectionComplete?.();
                    onBack();
                  }}
                  className="rounded-xl border border-slate-600 px-6 py-2.5 text-sm font-medium hover:bg-slate-900"
                >
                  Return to Dashboard
                </button>
              )}
              <button
                onClick={resetForm}
                className="rounded-xl border border-emerald-600/60 px-6 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-950/40"
              >
                Submit another connection
              </button>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Questions? Just reply to the confirmation email when you receive it.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 text-center text-xs text-slate-500">
          <AppVersionBadge />
          <p>
            Aussie Grid Mackay Pilot — Pre-pilot learning phase • Read-only access only • Your system stays under your
            full control
          </p>
          <p>
            Volunteer homes outside QLD can connect for monitoring. Dollar estimates stay QLD (Ergon/Energex)
            until we have your bill tariff.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConnectInverter;
