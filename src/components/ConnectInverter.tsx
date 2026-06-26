import { useState, type FormEvent } from "react";
import { usePilotHousehold } from "@/hooks";
import { createConnectionRequest } from "@/lib/api/createConnectionRequest";

const DEFAULT_USER_ID = "sungrow-test-001";

interface ConnectInverterProps {
  userId?: string;
  onComplete?: () => void;
  onBack?: () => void;
}

export function ConnectInverter({
  userId = DEFAULT_USER_ID,
  onComplete,
  onBack,
}: ConnectInverterProps) {
  const householdQuery = usePilotHousehold(userId);
  const household = householdQuery.data;
  const householdId = household?.household_id ?? userId;

  const [siteId, setSiteId] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const alreadyConnected = household?.inverter_make === "Sungrow";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      await createConnectionRequest({
        householdId,
        siteId: siteId.trim(),
        email: email.trim(),
        notes: notes.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Success screen
  if (success) {
    return (
      <div className="space-y-6 rounded-xl border border-emerald-700/40 bg-slate-950 p-6 text-slate-100">
        <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 p-6 text-center">
          <p className="text-3xl" aria-hidden>✓</p>
          <h1 className="mt-3 text-xl font-semibold text-emerald-300">
            Request submitted
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Thank you. We’ve received your connection request and will review it shortly.
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5 text-sm">
          <p className="font-medium text-emerald-300 mb-2">What happens next:</p>
          <ul className="space-y-1.5 text-slate-300">
            <li>• We will verify your Site ID and request read-only access</li>
            <li>• You’ll receive an email once your system is connected (usually within 1–2 business days)</li>
            <li>• Your dashboard will then show live solar, battery and grid data</li>
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
          {onBack && onComplete && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Stay on this page
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (householdQuery.loading && !household) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
        Loading your household…
      </div>
    );
  }

  // Main form (works even if no household record exists)
  return (
    <div className="space-y-6 rounded-xl border border-slate-700 bg-slate-950 p-6 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold text-emerald-400">
          Connect Your Sungrow Inverter
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Submit a request to link your Sungrow system to your pilot household. 
          We’ll review it and connect your system manually.
        </p>
        {household && (
          <p className="mt-1 text-sm text-slate-300">
            Household: {household.household_id}
            {household.is_test ? " · test household" : ""}
          </p>
        )}
      </header>

      {/* Graceful message when no household record exists yet */}
      {!household && !householdQuery.loading && (
        <div className="rounded-lg border border-amber-600/40 bg-amber-950/30 p-5">
          <p className="font-medium text-amber-200">No household record found yet</p>
          <p className="mt-2 text-sm text-amber-100/90">
            We don’t have a household record for this ID yet. You can still submit a connection request 
            and we’ll create one during review.
          </p>
        </div>
      )}

      {alreadyConnected && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          This household already has a Sungrow inverter registered. You can submit a new request to update the connection.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="site-id" className="block text-sm font-medium text-slate-300 mb-1">
            Sungrow Site ID / Plant ID <span className="text-red-400">*</span>
          </label>
          <input
            id="site-id"
            type="text"
            required
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            placeholder="e.g. 1234567890"
          />
          <p className="mt-1 text-xs text-slate-500">
            You can find this in the Sungrow iSolarCloud app or portal.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
            Contact Email <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            placeholder="your@email.com"
          />
          <p className="mt-1 text-xs text-slate-500">
            We’ll use this to send you updates about your connection request.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-1">
            Additional Notes (optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            placeholder="Any extra information that might help us..."
          />
        </div>

        {submitError && (
          <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {submitError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Submitting request...
              </>
            ) : (
              "Submit Connection Request"
            )}
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
      </form>

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-sm">
        <p className="text-slate-400">
          <span className="font-medium text-slate-300">Note:</span> This is a pilot program. 
          Connection requests are reviewed manually. You’ll be notified by email once your system is connected.
        </p>
      </div>
    </div>
  );
}

export default ConnectInverter;