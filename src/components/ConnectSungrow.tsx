import { useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { usePilotHousehold } from "@/hooks";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEFAULT_USER_ID = "sungrow-test-001";

const STEPS = [
  {
    title: "Find your Sungrow Site ID",
    body: "Log into iSolarCloud → find your plant/site and copy the Site ID (or Plant ID).",
  },
  {
    title: "Enter your details",
    body: "We only need your Site ID and the email linked to your Sungrow account. We’ll request read-only access on your behalf.",
  },
  {
    title: "We review and activate",
    body: "You’ll get an email once we’ve connected your system (usually within 1–2 business days).",
  },
] as const;

export interface ConnectSungrowProps {
  userId?: string;
  onComplete?: () => void;
  onBack?: () => void;
}

function ReadOnlyNotice() {
  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-950/30 px-4 py-3">
      <p className="text-sm font-medium text-amber-200">Read-only access only</p>
      <p className="mt-1 text-sm leading-relaxed text-amber-100/90">
        We will only read performance data from your solar and battery system.
        We cannot control your inverter or change any settings. You remain in full control.
      </p>
    </div>
  );
}

export function ConnectSungrow({
  userId = DEFAULT_USER_ID,
  onComplete,
  onBack,
}: ConnectSungrowProps) {
  const householdQuery = usePilotHousehold(userId);
  const household = householdQuery.data;

  const [formData, setFormData] = useState({
    householdLabel: "",
    accountEmail: "",
    siteId: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState("");

  const alreadyConnected = household?.inverter_make === "Sungrow" || household?.status === "active";

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (submitError) setSubmitError(null);
  };

  const generateHouseholdId = (label: string, siteId: string): string => {
    if (label.trim()) {
      return label.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
    }
    const short = siteId.trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || Date.now().toString(36);
    return `pending-${short}`;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!formData.siteId.trim()) {
      setSubmitError("Please enter your Sungrow Site ID / Plant ID.");
      return;
    }
    if (!formData.accountEmail.trim()) {
      setSubmitError("Please enter the email linked to your Sungrow account.");
      return;
    }

    setSubmitting(true);

    const newHouseholdId = generateHouseholdId(formData.householdLabel, formData.siteId);

    try {
      const { error: insertError } = await supabase
        .from("pilot_connection_requests")
        .insert({
          household_id: newHouseholdId,
          site_id: formData.siteId.trim(),
          account_email: formData.accountEmail.trim().toLowerCase(),
          notes: formData.notes.trim() || null,
          status: "pending_review",
          requested_at: new Date().toISOString(),
          inverter_make: "Sungrow",
        });

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        setSubmitError(insertError.message || "Failed to submit request. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmittedId(newHouseholdId);
      setSuccess(true);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setSubmitError("Something went wrong. Please try again or contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  if (householdQuery.loading && !household) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
        Loading your household…
      </div>
    );
  }

  if (householdQuery.error && !household) {
    return (
      <div className="space-y-4 rounded-lg border border-red-800 bg-red-950/40 p-6 text-red-200">
        <p>{householdQuery.error.message}</p>
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-md border border-red-700 px-4 py-2 text-sm hover:bg-red-900/40">
            Back to Dashboard
          </button>
        )}
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6 rounded-xl border border-emerald-700/40 bg-slate-950 p-6 text-slate-100">
        <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 p-6 text-center">
          <p className="text-3xl" aria-hidden>✓</p>
          <h1 className="mt-3 text-xl font-semibold text-emerald-300">Request submitted successfully</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Thank you. We’ve received your connection request for <span className="font-mono text-emerald-300">{submittedId}</span>.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            We’ll review it and request read-only access from Sungrow. You’ll receive an email once approved (usually within 1–2 business days).
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5 text-sm">
          <p className="font-medium text-emerald-300 mb-2">What happens next:</p>
          <ul className="space-y-1.5 text-slate-300">
            <li>• We verify your Site ID and request read-only API access</li>
            <li>• You’ll get a confirmation email once everything is connected</li>
            <li>• Your dashboard will then show live solar, battery, and grid data</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onComplete ?? onBack}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Return to Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setSuccess(false);
              setFormData({ householdLabel: "", accountEmail: "", siteId: "", notes: "" });
              setSubmittedId("");
            }}
            className="rounded-md border border-emerald-600/60 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-950/40"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border border-slate-700 bg-slate-950 p-6 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold text-emerald-400">Connect your Sungrow system</h1>
        <p className="mt-2 text-sm text-slate-400">
          Link your system so we can show live solar, battery, and grid data on your dashboard.
        </p>
        {household && (
          <p className="mt-1 text-sm text-slate-300">
            Household: {household.household_id}
            {household.is_test ? " · test household" : ""}
          </p>
        )}
      </header>

      <ReadOnlyNotice />

      {alreadyConnected && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          This household already has a Sungrow inverter registered. You can still submit a request for another property.
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-emerald-400">How it works</h2>
        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 rounded-lg border border-slate-700/80 bg-slate-900/60 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-sm font-semibold text-emerald-400 ring-1 ring-emerald-700/50">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-slate-200">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="text-lg font-medium text-emerald-400">Enter your Sungrow details</h2>

        {submitError && (
          <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {submitError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Household name / label <span className="text-slate-500">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.householdLabel}
            onChange={(e) => handleInputChange("householdLabel", e.target.value)}
            placeholder="e.g. Jakeman Home or 12 Davlyn Dr"
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Sungrow account email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={formData.accountEmail}
            onChange={(e) => handleInputChange("accountEmail", e.target.value)}
            placeholder="you@email.com"
            required
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-slate-500">The email you use to log into iSolarCloud</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Site ID / Plant ID <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.siteId}
            onChange={(e) => handleInputChange("siteId", e.target.value)}
            placeholder="e.g. 12345678 or PLANT-ABC123"
            required
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-slate-500">Found in your iSolarCloud plant list or dashboard</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Notes (optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="e.g. 10kW system with 13.5kWh battery"
            rows={2}
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting request..." : "Submit connection request"}
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="rounded-md border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          We’ll review and activate read-only access, usually within 1–2 business days.
        </p>
      </form>
    </div>
  );
}

export default ConnectSungrow;