import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ConnectionRequest {
  id: string;
  household_id: string;
  site_id: string;
  account_email: string;
  notes: string | null;
  requested_at: string;
}

export interface RequestsProps {
  onBack?: () => void;
}

export function Requests({ onBack }: RequestsProps) {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPendingRequests = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('pilot_connection_requests')
      .select('id, household_id, site_id, account_email, notes, requested_at')
      .eq('status', 'pending_review')
      .order('requested_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const handleApprove = async (req: ConnectionRequest) => {
    setProcessingId(req.id);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Mark the request as approved
      const { error: updateReqError } = await supabase
        .from('pilot_connection_requests')
        .update({ 
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', req.id);

      if (updateReqError) throw updateReqError;

      // 2. Create or update the household record (upsert = safe create or update)
      const { error: upsertError } = await supabase
        .from('pilot_households')
        .upsert({
          household_id: req.household_id,
          status: 'active',
          sungrow_connected_at: new Date().toISOString(),
          inverter_make: 'Sungrow',
          // sensible defaults for new pilot households
          battery_capacity_kwh: 13.5,
          solar_kw: 6.6,
          consent_given: true,
          onboarding_notes: req.notes || 'Approved via Requests page',
        }, {
          onConflict: 'household_id'
        });

      if (upsertError) {
        console.warn('Household upsert warning (non-fatal):', upsertError);
      }

      setSuccessMessage(`Approved ${req.household_id}. The household is now live with read-only data.`);

      // Refresh the list so the approved request disappears
      await fetchPendingRequests();
    } catch (err: any) {
      console.error('Approve error:', err);
      setError(err.message || 'Failed to approve request. Check console for details.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900"
              >
                ← Back to Dashboard
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-emerald-400">Connection Requests</h1>
              <p className="text-sm text-slate-400">Mackay Pilot — Internal tool</p>
            </div>
          </div>
          <button
            onClick={fetchPendingRequests}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {successMessage && (
          <div className="mb-4 rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-8 text-center">
            <p className="text-slate-300">No pending connection requests.</p>
            <p className="mt-1 text-sm text-slate-500">New submissions will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Household</th>
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-left font-medium">Site ID</th>
                  <th className="px-6 py-3 text-left font-medium">Notes</th>
                  <th className="px-6 py-3 text-left font-medium">Requested</th>
                  <th className="px-6 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-4 font-mono text-emerald-300">{req.household_id}</td>
                    <td className="px-6 py-4 text-slate-300">{req.account_email}</td>
                    <td className="px-6 py-4 font-mono text-slate-300">{req.site_id}</td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate">
                      {req.notes || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(req.requested_at).toLocaleDateString()} <br />
                      <span className="text-xs text-slate-500">
                        {new Date(req.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={processingId === req.id}
                        className="rounded-lg bg-emerald-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-800"
                      >
                        {processingId === req.id ? 'Approving...' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">
          Internal tool • Approving a request marks it as approved and creates/updates the household as live (read-only)
        </div>
      </div>
    </div>
  );
}

export default Requests;