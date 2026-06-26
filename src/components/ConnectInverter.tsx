import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface ConnectInverterProps {
  onBack?: () => void;
  onConnectionComplete?: () => void;
  currentHouseholdId?: string;
}

interface FormData {
  accountEmail: string;
  siteId: string;
  notes: string;
}

export function ConnectInverter({ 
  onBack, 
  onConnectionComplete, 
  currentHouseholdId 
}: ConnectInverterProps) {
  const [formData, setFormData] = useState<FormData>({
    accountEmail: "",
    siteId: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);

  // Guard: check for existing pending request on mount / when household changes
  useEffect(() => {
    const checkPending = async () => {
      if (!currentHouseholdId) {
        setCheckingPending(false);
        return;
      }
      setCheckingPending(true);
      const { data, error: checkError } = await supabase
        .from('pilot_connection_requests')
        .select('id')
        .eq('household_id', currentHouseholdId)
        .eq('status', 'pending_review')
        .limit(1);

      if (!checkError && data && data.length > 0) {
        setHasPendingRequest(true);
      } else {
        setHasPendingRequest(false);
      }
      setCheckingPending(false);
    };
    checkPending();
  }, [currentHouseholdId]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.siteId.trim()) {
      setError("Please enter your Sungrow Site ID (Plant ID).");
      return false;
    }
    if (!formData.accountEmail.trim()) {
      setError("Please enter the email associated with your Sungrow account.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.accountEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentHouseholdId) {
      setError("Missing household ID. Please return to the dashboard and try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Double-check guard right before insert
      const { data: existing } = await supabase
        .from('pilot_connection_requests')
        .select('id')
        .eq('household_id', currentHouseholdId)
        .eq('status', 'pending_review')
        .limit(1);

      if (existing && existing.length > 0) {
        setHasPendingRequest(true);
        setError("You already have a pending connection request for this household.");
        setIsSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('pilot_connection_requests')
        .insert({
          household_id: currentHouseholdId,
          site_id: formData.siteId.trim(),
          account_email: formData.accountEmail.trim().toLowerCase(),
          notes: formData.notes.trim() || null,
          status: 'pending_review',
          requested_at: new Date().toISOString(),
        });

      if (insertError) {
        // Graceful handling for unique constraint (idx_unique_pending_per_household)
        if (insertError.code === '23505' || insertError.message?.toLowerCase().includes('duplicate')) {
          setHasPendingRequest(true);
          setError("A pending request already exists for this household. Our team is reviewing it.");
        } else {
          throw insertError;
        }
      } else {
        setIsSubmitted(true);
        setHasPendingRequest(true); // lock further submissions
      }
    } catch (err: any) {
      console.error('Connection request error:', err);
      setError(err?.message || 'Failed to submit request. Please try again or contact the team.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ accountEmail: "", siteId: "", notes: "" });
    setIsSubmitted(false);
    setError(null);
  };

  // Pending request state (guard active)
  if (!checkingPending && hasPendingRequest && !isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
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

          <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
              <span className="text-3xl">⏳</span>
            </div>
            <h2 className="text-2xl font-semibold text-amber-300">Request already pending</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              We already have a pending connection request for this household. 
              Our team is reviewing it and will activate read-only access shortly (usually within 1–2 business days).
            </p>
            <p className="mt-4 text-sm text-amber-200/90">
              You’ll see “Live data” on the dashboard once it’s approved.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {onBack && (
                <button onClick={onBack} className="rounded-xl border border-slate-600 px-6 py-2.5 text-sm font-medium hover:bg-slate-900">
                  Return to Dashboard
                </button>
              )}
              <button 
                onClick={() => window.location.reload()} 
                className="rounded-xl border border-emerald-600/60 px-6 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-950/40"
              >
                Refresh status
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
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

        {/* Pre-pilot reassurance banner */}
        <div className="mb-6 rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-5 py-4">
          <p className="text-sm font-medium text-emerald-300">Read-only during pre-pilot learning phase</p>
          <p className="mt-1 text-sm leading-relaxed text-emerald-100/90">
            We will only <span className="font-semibold">read</span> data from your solar and battery system. 
            We cannot control your inverter or change any settings. This keeps everything simple and safe while we learn what works best for Mackay households.
          </p>
        </div>

        {checkingPending ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
            Checking your connection status…
          </div>
        ) : isSubmitted ? (
          /* Success state */
          <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/10 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-semibold text-emerald-400">Request received — thank you!</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              We’ve got your Sungrow Site ID and will now request read-only access to your system. 
              You’ll receive an email confirmation once we’ve verified everything and your dashboard shows “Live data”.
            </p>

            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-left text-sm">
              <p className="font-medium text-emerald-300">What happens next:</p>
              <ul className="mt-2 space-y-1.5 text-slate-300">
                <li>• Our team verifies your Site ID and requests read-only API access</li>
                <li>• You’ll see a confirmation email (usually within 24–48 hours)</li>
                <li>• Once connected, the dashboard will show live solar, battery, and grid data</li>
                <li>• Your agent starts learning from your real home data (still read-only)</li>
              </ul>
            </div>

            <div className="mt-6 flex justify-center">
              {onBack && (
                <button onClick={onBack} className="rounded-xl border border-emerald-600/60 px-8 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-950/40">
                  Return to Dashboard
                </button>
              )}
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Questions? Check the Help page or reply to the confirmation email when you receive it.
            </p>
          </div>
        ) : (
          <>
            {/* Why connect */}
            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <h2 className="text-lg font-medium text-emerald-400">Why connect your system?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Connecting lets you see your live solar production, battery charge level, and grid flow right here in the pilot dashboard. 
                Your smart agent will also start learning from your home’s real data so it can give you better daily suggestions.
              </p>
              <p className="mt-3 text-sm text-slate-400">
                This is still the <span className="font-medium text-emerald-300">pre-pilot learning phase</span> — everything stays read-only until we’ve gathered enough data from participating homes.
              </p>
            </div>

            {/* How it works */}
            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <h3 className="text-base font-semibold text-emerald-400">How to connect (takes about 2 minutes)</h3>
              <ol className="mt-3 space-y-3 text-sm text-slate-300">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">1</span>
                  <span>Log into your <span className="font-medium">Sungrow iSolarCloud</span> account (app or web at isolarcloud.com)</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">2</span>
                  <span>Find your plant / site and copy the <span className="font-medium">Site ID</span> or <span className="font-medium">Plant ID</span></span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">3</span>
                  <span>Enter your Site ID and the email linked to your Sungrow account below</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">4</span>
                  <span>We’ll securely request read-only access on your behalf. You’ll see “Live data” status once connected.</span>
                </li>
              </ol>
              <p className="mt-4 text-xs text-slate-500">
                Don’t worry — we only ever request read-only access during the pilot. You stay in full control of your system.
              </p>
            </div>

            {/* Connection form */}
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
                    Sungrow account email <span className="text-red-400">*</span>
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
                    placeholder="e.g. 12345678 or PLANT-ABC123"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">Found in your iSolarCloud plant list or dashboard</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="e.g. I have a 10kW system with 13.5kWh battery, or any questions for the team"
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-700"
              >
                {isSubmitting ? "Submitting request..." : "Submit connection request"}
              </button>

              <p className="mt-3 text-center text-xs text-slate-500">
                We’ll review and activate read-only access, usually within 1–2 business days.
              </p>
            </form>
          </>
        )}

        {/* Footer reassurance */}
        <div className="mt-8 text-center text-xs text-slate-500">
          Aussie Grid Mackay Pilot — Pre-pilot learning phase • Read-only access only • Your system stays under your full control
        </div>
      </div>
    </div>
  );
}

export default ConnectInverter;