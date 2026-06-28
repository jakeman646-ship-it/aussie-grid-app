import { usePilotHousehold } from "@/hooks/usePilotHousehold";

interface ProfileProps {
  onBack: () => void;
  onSignOut: () => void;
  onChangePassword: () => void;
  onConnectInverter?: () => void;
}

import { getCurrentHouseholdId } from "@/lib/currentHousehold";

const DEFAULT_USER_ID = getCurrentHouseholdId();

export default function Profile({ 
  onBack, 
  onSignOut, 
  onChangePassword,
  onConnectInverter 
}: ProfileProps) {
  const { data: household, loading } = usePilotHousehold(DEFAULT_USER_ID);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Account</h1>
          <p className="mt-2 text-base text-slate-300">
            Manage your pilot account details.
          </p>
        </div>

        {/* Account Info Card */}
        <div className="rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-sm mb-6">
          <div className="space-y-5">
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-1">Email Address</div>
              <div className="text-lg font-medium text-slate-900">
                {household?.email ?? "jakeman646@hotmail.co.uk"}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-1">Account Type</div>
              <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                Pilot Participant
              </div>
            </div>
          </div>
        </div>

        {/* Sungrow Connection Status */}
        <div className="rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-sm mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-1">Sungrow Inverter</div>
              {loading ? (
                <div className="text-sm text-slate-500">Checking connection...</div>
              ) : household?.sungrow_connected_at ? (
                <div>
                  <span className="inline-flex items-center gap-2 text-emerald-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Connected
                  </span>
                  <div className="text-xs text-slate-500 mt-0.5">
                    since {new Date(household.sungrow_connected_at).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <span className="text-amber-600 font-medium">Not connected yet</span>
              )}
            </div>

            {!household?.sungrow_connected_at && onConnectInverter && (
              <button
                onClick={onConnectInverter}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition"
              >
                Connect Sungrow
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onChangePassword}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition"
          >
            Change Password
          </button>
          <button
            onClick={onSignOut}
            className="w-full rounded-xl bg-red-600 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-red-500 active:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-slate-500">
          This is a pilot account. Thank you for helping us test Aussie Grid.
        </p>
      </div>
    </div>
  );
}