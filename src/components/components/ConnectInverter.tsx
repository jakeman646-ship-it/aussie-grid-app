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
  inverterSerial: string;
  notes: string;
}

interface ConnectionStatus {
  status: 'none' | 'pending' | 'connected';
  message?: string;
}

export function ConnectInverter({ 
  onBack, 
  onConnectionComplete, 
  currentHouseholdId 
}: ConnectInverterProps) {
  const [formData, setFormData] = useState<FormData>({
    accountEmail: "",
    siteId: "",
    inverterSerial: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'none' });
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if this household already has a connection request or is connected
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!currentHouseholdId) {
        setCheckingStatus(false);
        return;
      }

      setCheckingStatus(true);

      try {
        // Check for existing pending request
        const { data: pendingRequest } = await supabase
          .from('pilot_connection_requests')
          .select('id, status')
          .eq('household_id', currentHouseholdId)
          .eq('status', 'pending_review')
          .maybeSingle();

        if (pendingRequest) {
          setConnectionStatus({ 
            status: 'pending', 
            message: 'Your connection request is currently being reviewed by the team.' 
          });
          setCheckingStatus(false);
          return;
        }

        // Check if household is already active/connected
        const { data: household } = await supabase
          .from('pilot_households')
          .select('status, sungrow_connected_at')
          .eq('household_id', currentHouseholdId)
          .maybeSingle();

        if (household && (household.status === 'active' || household.sungrow_connected_at)) {
          setConnectionStatus({ 
            status: 'connected', 
            message: 'Your Sungrow system is already connected and sending live data.' 
          });
        } else {
          setConnectionStatus({ status: 'none' });
        }
      } catch (err) {
        console.error('Error checking connection status:', err);
        setConnectionStatus({ status: 'none' });
      }

      setCheckingStatus(false);
    };

    checkExistingConnection();
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
      const { error: insertError } = await supabase
        .from('pilot_connection_requests')
        .insert({
          household_id: currentHouseholdId,
          site_id: formData.siteId.trim(),
          account_email: formData.accountEmail.trim(),
          inverter_serial: formData.inverterSerial.trim() || null,
          notes: formData.notes.trim() || null,
          status: 'pending_review',
          requested_at: new Date().toISOString(),
        });

      if (insertError) {
        throw insertError;
      }

      setIsSubmitting(false);
      setIsSubmitted(true);

      // Let parent know after user sees success state
      setTimeout(() => {
        onConnectionComplete?.();
      }, 2200);
    } catch (err: any) {
      console.error('Connection request error:', err);
      setError(err.message || 'Failed to submit request. Please try again or contact support.');
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ accountEmail: "", siteId: "", inverterSerial: "", notes: "" });
    setIsSubmitted(false);
    setError(null);
  };

  // Show status screens if already pending or connected
  if (connectionStatus.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-2xl pt-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-3xl">⏳</span>
          </div>
          <h1 className="text-2xl font-semibold text-amber-400">Request already submitted</h1>
          <p className="mt-3 text-slate-300">{connectionStatus.message}</p>
          <p className="mt-2 text-sm text-slate-400">We'll email you as soon as it's approved and your dashboard goes live.</p>
          
          {onBack && (
            <button onClick={onBack} className="mt-8 rounded-xl border border-slate-600 px-6 py-2.5 text-sm hover:bg-slate-900">
              ← Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  if (connectionStatus.status === 'connected') {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-2xl pt-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-semibold text-emerald-400">You're already connected</h1>
          <p className="mt-3 text-slate-300">{connectionStatus.message}</p>
          
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

        {/* Pre-pilot reassurance */}
        <div className="mb-6 rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-5 py-4">
          <p className="text-sm font-medium text-emerald-300">Read-only during pre-pilot learning phase</p>
          <p className="mt-1 text-sm leading-relaxed text-emerald-100/90">
            We will only <span className="font-semibold">read</span> data from your solar and battery system. 
            We cannot control your inverter or change any settings. This keeps everything simple and safe while we learn what works best for Mackay households.
          </p>
        </div>

        {!isSubmitted ? (
          <>
            {/* Why connect */}
            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <h2 className="text-lg font-medium text-emerald-400">Why connect your system?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Connecting lets you see your live solar production, battery charge level, and grid flow right here in the pilot dashboard. 
                Your smart agent will also start learning from your home’s real data so it can give you better daily suggestions.
              </p>
            </div>

            {/* How to connect - improved instructions */}
            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
              <h3 className="text-base font-semibold text-emerald-400">How to connect (takes about 2 minutes)</h3>
              <ol className="mt-3 space-y-3 text-sm text-slate-300">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">1</span>
                  <span>Log into your <span className="font-medium">Sungrow iSolarCloud</span> account (app or web at <span className="font-mono text-xs">isolarcloud.com</span> or the Sungrow app)</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">2</span>
                  <span>Go to your plant → <span className="font-medium">Settings → General information</span>. Copy the <span className="font-medium">Plant ID</span> (also called Site ID or ps-id). It’s usually a long number.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">3</span>
                  <span>(Optional but helpful) Go to Devices and copy your inverter’s <span className="font-medium">Serial Number</span> (on the physical inverter sticker too)</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">4</span>
                  <span>Enter the details below. We’ll request read-only access on your behalf.</span>
                </li>
              </ol>
              <p className="mt-4 text-xs text-slate-500">
                Note: Full third-party API access sometimes requires an extra approval step via the Sungrow Developer Portal. We’ll guide you if we need it for richer data later.
              </p>
            </div>

            {/* Form */}
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
                    placeholder="e.g. 8.2kW system with 13.5kWh battery, or anything the team should know"
                    rows={3}
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
                We’ll review and activate read-only access, usually within 1–2 business days.
              </p>
            </form>
          </>
        ) : (
          /* Success state */
          <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/10 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-semibold text-emerald-400">Request received — thank you!</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              We’ve received your details and will now request read-only access to your Sungrow system.
            </p>

            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5 text-left text-sm">
              <p className="font-medium text-emerald-300">What happens next:</p>
              <ul className="mt-2 space-y-1.5 text-slate-300">
                <li>• Our team verifies your Site ID and requests read-only access</li>
                <li>• You’ll receive a confirmation email (usually within 24–48 hours)</li>
                <li>• Once approved, your dashboard will show live solar, battery and grid data</li>
                <li>• Your smart agent starts learning from your real home usage (still read-only)</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {onBack && (
                <button onClick={onBack} className="rounded-xl border border-slate-600 px-6 py-2.5 text-sm font-medium hover:bg-slate-900">
                  Return to Dashboard
                </button>
              )}
              <button onClick={resetForm} className="rounded-xl border border-emerald-600/60 px-6 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-950/40">
                Submit another connection
              </button>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Questions? Reply to the confirmation email or check the Help section in the dashboard.
            </p>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-slate-500">
          Aussie Grid Mackay Pilot — Pre-pilot learning phase • Read-only access only • Your system stays under your full control
        </div>
      </div>
    </div>
  );
}

export default ConnectInverter;