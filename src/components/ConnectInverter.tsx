import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ConnectInverterProps {
  currentHouseholdId: string;
  onBack?: () => void;
}

type ConnectionStatus = "loading" | "not_connected" | "pending" | "connected";

export function ConnectInverter({ currentHouseholdId, onBack }: ConnectInverterProps) {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    inverter_serial: "",
    site_id: "",
    api_key: "",
    inverter_model: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check current connection status from database
  useEffect(() => {
    const checkStatus = async () => {
      if (!currentHouseholdId) {
        setStatus("not_connected");
        return;
      }

      try {
        // Check if already connected
        const { data: household } = await supabase
          .from("pilot_households")
          .select("sungrow_connected_at")
          .eq("household_id", currentHouseholdId)
          .single();

        if (household?.sungrow_connected_at) {
          setStatus("connected");
          return;
        }

        // Check for pending request
        const { data: pendingRequest } = await supabase
          .from("pilot_connection_requests")
          .select("id")
          .eq("household_id", currentHouseholdId)
          .eq("status", "pending_review")
          .limit(1)
          .single();

        if (pendingRequest) {
          setStatus("pending");
        } else {
          setStatus("not_connected");
        }
      } catch {
        setStatus("not_connected");
      }
    };

    checkStatus();
  }, [currentHouseholdId]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.inverter_serial.trim()) newErrors.inverter_serial = "Inverter serial number is required";
    if (!form.site_id.trim()) newErrors.site_id = "Site / Plant ID is required";
    if (!form.api_key.trim()) newErrors.api_key = "API Key / Access Token is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !currentHouseholdId) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.from("pilot_connection_requests").insert({
        household_id: currentHouseholdId,
        status: "pending_review",
        inverter_serial: form.inverter_serial.trim(),
        site_id: form.site_id.trim(),
        api_key: form.api_key.trim(),
        inverter_model: form.inverter_model.trim() || null,
        notes: form.notes.trim() || null,
      });

      if (error) throw error;

      setSubmitted(true);
      setStatus("pending");
    } catch (err) {
      alert("Failed to submit request. Please try again or contact support.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  if (status === "loading") {
    return <div className="p-8 text-center text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
            >
              ← Back
            </button>
          )}
          <h1 className="text-2xl font-semibold text-emerald-400">Connect Your Sungrow Inverter</h1>
        </div>

        {/* Status Banner */}
        {status === "connected" && (
          <div className="mb-6 rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-5 py-4">
            <p className="font-medium text-emerald-300">Your Sungrow system is already connected.</p>
          </div>
        )}

        {status === "pending" && !submitted && (
          <div className="mb-6 rounded-lg border border-amber-600/40 bg-amber-950/20 px-5 py-4">
            <p className="font-medium text-amber-300">Connection request already submitted.</p>
            <p className="mt-1 text-sm text-amber-200/80">We’re reviewing it and will update you within 1–2 business days.</p>
          </div>
        )}

        {/* Intro */}
        <div className="mb-8 rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-4 text-sm text-slate-300">
          During the pilot we can only read data from your system. Connecting your inverter lets us start collecting your solar and battery data.
        </div>

        {/* Success State */}
        {submitted ? (
          <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/20 p-6">
            <h2 className="text-xl font-semibold text-emerald-400">Request submitted successfully</h2>
            <p className="mt-3 text-slate-300">Thank you. We’ve received your connection request.</p>

            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <p className="mb-2 font-medium text-emerald-300">What happens next?</p>
              <ul className="space-y-1 text-sm text-slate-300 list-disc list-inside">
                <li>Our team reviews your inverter details within 1–2 business days</li>
                <li>Once approved, we enable read-only data access</li>
                <li>You’ll start seeing your live solar, battery and grid data on the Dashboard</li>
              </ul>
            </div>
          </div>
        ) : status === "not_connected" ? (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-5">
              <FormField
                label="Inverter Serial Number"
                required
                value={form.inverter_serial}
                onChange={(v) => updateField("inverter_serial", v)}
                error={errors.inverter_serial}
                placeholder="e.g. S1234567890"
              />
              <FormField
                label="Site / Plant ID"
                required
                value={form.site_id}
                onChange={(v) => updateField("site_id", v)}
                error={errors.site_id}
                placeholder="Found in iSolarCloud"
              />
              <FormField
                label="API Key / Access Token"
                required
                type="password"
                value={form.api_key}
                onChange={(v) => updateField("api_key", v)}
                error={errors.api_key}
                placeholder="Your Sungrow API key"
              />
              <FormField
                label="Inverter Model"
                value={form.inverter_model}
                onChange={(v) => updateField("inverter_model", v)}
                placeholder="e.g. SH10RT"
              />
              <FormField
                label="Notes (optional)"
                type="textarea"
                value={form.notes}
                onChange={(v) => updateField("notes", v)}
                placeholder="Anything else we should know?"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Connection Request"}
            </button>
          </form>
        ) : null}

        {/* What happens next info */}
        {!submitted && status !== "connected" && (
          <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/40 p-5 text-sm">
            <p className="mb-2 font-medium text-emerald-400">What happens next?</p>
            <ul className="space-y-1 text-slate-300 list-disc list-inside">
              <li>We review your request within 1–2 business days</li>
              <li>Once approved, we enable read-only access to your inverter</li>
              <li>You’ll see your live data appear on the Dashboard</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, required, value, onChange, error, placeholder, type = "text" }: any) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">
        {label} {required && <span className="text-emerald-400">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default ConnectInverter;