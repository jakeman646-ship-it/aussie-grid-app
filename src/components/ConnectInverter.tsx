/**
 * Aussie Grid — ConnectInverter
 * File: src/components/ConnectInverter.tsx
 * Version: v0.1.2.8
 */
import { useState, useEffect, type FormEvent } from "react";
import { AppVersionBadge } from "@/components/common/AppVersionBadge";
import { supabase } from "@/lib/supabase";

export interface ConnectInverterProps {
  onBack?: () => void;
  onConnectionComplete?: () => void;
  currentHouseholdId?: string;
}

interface FormData {
  householdLabel: string;
  accountEmail: string;
  siteId: string;
  inverterSerial: string;
  notes: string;
}

interface ConnectionStatus {
  status: "none" | "pending" | "connected";
  message?: string;
}

export function ConnectInverter({
  onBack,
  onConnectionComplete,
  currentHouseholdId,
}: ConnectInverterProps) {
  const [formData, setFormData] = useState<FormData>({
    householdLabel: "",
    accountEmail: "",
    siteId: "",
    inverterSerial: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: "none" });
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!currentHouseholdId) {
        setCheckingStatus(false);
        return;
      }
      setCheckingStatus(true);
      try {
        const { data: pendingRequest } = await supabase
          .from("pilot_connection_requests")
          .select("id, status")
          .eq("household_id", currentHouseholdId)
          .eq("status", "pending_review")
          .maybeSingle();

        if (pendingRequest) {
          setConnectionStatus({
            status: "pending",
            message: "Your connection request is currently being reviewed by the team.",
          });
          setCheckingStatus(false);
          return;
        }

        const { data: household } = await supabase
          .from("pilot_households")
          .select("status, sungrow_connected_at")
          .eq("household_id", currentHouseholdId)
          .maybeSingle();

        if (household && (household.status === "active" || household.sungrow_connected_at)) {
          setConnectionStatus({
            status: "connected",
            message: "This household is already connected and sending live data.",
          });
        } else {
          setConnectionStatus({ status: "none" });
        }
      } catch (err) {
        console.error("Error checking connection status:", err);
        setConnectionStatus({ status: "none" });
      }
      setCheckingStatus(false);
    };
    checkExistingConnection();
  }, [currentHouseholdId]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const generateHouseholdId = (label: string, siteId: string): string => {
    if (label.trim()) {
      return label.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
    }
    const short = siteId.trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || Date.now().toString(36);
    return `pending-${short}`;
  };

  const validateForm = (): boolean => {
    if (!formData.siteId.trim()) {
      setError("Please enter your Sungrow Site ID (Plant ID).");
      return false;
    }
    if (!formData.accountEmail.trim()) {
      setError("Please enter the email associated with your Sungrow iSolarCloud account.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.accountEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const targetHouseholdId = generateHouseholdId(formData.householdLabel, formData.siteId);

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from("pilot_connection_requests")
        .insert({
          household_id: targetHouseholdId,
          site_id: formData.siteId.trim(),
          account_email: formData.accountEmail.trim().toLowerCase(),
          inverter_serial: formData.inverterSerial.trim() || null,
          notes: formData.notes.trim() || null,
          inverter_make: "Sungrow",
          status: "pending_review",
          requested_at: new Date().toISOString(),
        });

      if (insertError) {
        if (insertError.code === "23505" || insertError.message?.toLowerCase().includes("duplicate")) {
          setConnectionStatus({
            status: "pending",
            message: "A pending request already exists for this household. Our team is reviewing it.",
          });
          setError(insertError.message);
        } else {
          throw insertError;
        }
      } else {
        setIsSubmitted(true);
        onConnectionComplete?.();
      }
    } catch (err: unknown) {
      console.error("Connection request error:", err);
      const message = err instanceof Error ? err.message : "Failed to submit request. Please try again or contact support.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ householdLabel: "", accountEmail: "", siteId: "", inverterSerial: "", notes: "" });
    setIsSubmitted(false);
    setError(null);
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-3xl pt-12 text-center">
          <p className="text-sm text-slate-400">Checking your connection status…</p>
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
          <p className="mt-2 text-sm text-slate-400">We&apos;ll email you as soon as it&apos;s approved and your dashboard goes live.</p>
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
              <h1 className="text-2xl font-semibold text-emerald-400">Connect your Sungrow system</h1>
              <p className="text-sm text-slate-400">Mackay Pilot — Pre-pilot phase</p>
            </div>
          </div>
        </div>

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
                See your live solar production, battery charge level, and grid flow. Your smart agent will learn from your real data to give better daily suggestions.
              </p>
            </div>

            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <h3 className="text-base font-semibold text-emerald-400">How to connect (takes about 2 minutes)</h3>
              <ol className="mt-3 space-y-3 text-sm text-slate-300">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">1</span>
                  <span>Log into your <span className="font-medium">Sungrow iSolarCloud</span> account</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">2</span>
                  <span>Go to your plant → <span className="font-medium">Settings → General information</span> and copy the <span className="font-medium">Plant ID</span> (Site ID)</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">3</span>
                  <span>(Optional) Copy your inverter&apos;s <span className="font-medium">Serial Number</span></span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">4</span>
                  <span>Enter the details below. We&apos;ll request read-only access on your behalf.</span>
                </li>
              </ol>
            </div>

            <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700 bg-slate-900 p-6">
              <h3 className="text-lg font-medium text-emerald-400">Enter your Sungrow details</h3>

              {error && (
                <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-5 space-y-5">
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

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Sungrow iSolarCloud account email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.accountEmail}
                    onChange={(e) => handleInputChange("accountEmail", e.target.value)}
                    placeholder="you@email.com"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">The email you use to log into iSolarCloud</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Site ID / Plant ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.siteId}
                    onChange={(e) => handleInputChange("siteId", e.target.value)}
                    placeholder="e.g. 123456789 or PLANT-ABC123"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">Found in iSolarCloud → Plant → Settings → General information</p>
                </div>

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
                {isSubmitting ? "Submitting request..." : "Submit connection request"}
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
              We&apos;ve received your connection request and will now review it.
            </p>

            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5 text-left text-sm">
              <p className="font-medium text-emerald-300 mb-2">What happens next:</p>
              <ul className="space-y-1.5 text-slate-300">
                <li>• We verify your Site ID and request read-only access from Sungrow</li>
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
              <button onClick={resetForm} className="rounded-xl border border-emerald-600/60 px-6 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-950/40">
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
            Aussie Grid Mackay Pilot — Pre-pilot learning phase • Read-only access only • Your system stays under your full control
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConnectInverter;