import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ConnectionRequest {
  id: string;
  household_id: string;
  site_id: string;
  account_email: string;
  inverter_serial: string | null;
  notes: string | null;
  status: string;
  requested_at: string;
}

export interface RequestsProps {
  onBack?: () => void;
}

export function Requests({ onBack }: RequestsProps) {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ConnectionRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const fetchPendingRequests = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('pilot_connection_requests')
      .select('id, household_id, site_id, account_email, inverter_serial, notes, status, requested_at')
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

  const closeModal = () => {
    setSelectedRequest(null);
    setShowRejectForm(false);
    setRejectReason('');
    setError(null);
  };

  const handleApprove = async (req: ConnectionRequest) => {
    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateReqError } = await supabase
        .from('pilot_connection_requests')
        .update({ status: 'approved' })
        .eq('id', req.id);

      if (updateReqError) throw updateReqError;

      const { error: upsertError } = await supabase
        .from('pilot_households')
        .upsert({
          household_id: req.household_id,
          status: 'active',
          sungrow_connected_at: new Date().toISOString(),
          inverter_make: 'Sungrow',
          battery_capacity_kwh: 13.5,
          solar_kw: 6.6,
          consent_given: true,
          onboarding_notes: req.notes || 'Approved via Requests page',
        }, {
          onConflict: 'household_id'
        });

      if (upsertError) {
        console.warn('Household upsert warning:', upsertError);
      }

      setSuccessMessage(`Approved ${req.household_id}. Household is now live.`);
      closeModal();
      await fetchPendingRequests();
    } catch (err: any) {
      console.error('Approve error:', err);
      setError(err.message || 'Failed to approve request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (req: ConnectionRequest) => {
    setIsProcessing(true);
    setError(null);

    try {
      const finalNotes = rejectReason.trim()
        ? `${req.notes || ''}\n\n[Rejected] ${rejectReason.trim()}`
        : req.notes;

      const { error: updateError } = await supabase
        .from('pilot_connection_requests')
        .update({
          status: 'rejected',
          notes: finalNotes || null,
        })
        .eq('id', req.id);

      if (updateError) throw updateError;

      setSuccessMessage(`Request for ${req.household_id} has been rejected.`);
      closeModal();
      await fetchPendingRequests();
    } catch (err: any) {
      console.error('Reject error:', err);
      setError(err.message || 'Failed to reject request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openRequest = (req: ConnectionRequest) => {
    setSelectedRequest(req);
    setShowRejectForm(false);
    setRejectReason('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
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
              <p className="text-sm text-slate-400">Mackay Pilot — Internal review tool</p>
            </div>
          </div>
          <button
            onClick={fetchPendingRequests}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
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
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-12 text-center text-slate-400">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
              <span className="text-2xl">📭</span>
            </div>
            <p className="text-lg text-slate-300">No pending connection requests</p>
            <p className="mt-1 text-sm text-slate-500">New submissions will appear here.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
              <span>{requests.length} pending request{requests.length !== 1 ? 's' : ''}</span>
              <span className="text-xs">Click any row to review</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Household</th>
                    <th className="px-6 py-3 text-left font-medium">Email</th>
                    <th className="px-6 py-3 text-left font-medium">Site ID</th>
                    <th className="px-6 py-3 text-left font-medium">Inverter Serial</th>
                    <th className="px-6 py-3 text-left font-medium">Requested</th>
                    <th className="px-6 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => openRequest(req)}
                      className="cursor-pointer hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-emerald-300">{req.household_id}</td>
                      <td className="px-6 py-4 text-slate-300">{req.account_email}</td>
                      <td className="px-6 py-4 font-mono text-slate-300">{req.site_id}</td>
                      <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                        {req.inverter_serial || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {new Date(req.requested_at).toLocaleDateString()}<br />
                        <span className="text-xs text-slate-500">
                          {new Date(req.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-400">
                          Pending Review
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">
          Internal tool • Approving gives read-only access
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-emerald-400">Review Connection Request</h2>
                <p className="text-sm text-slate-400 font-mono">{selectedRequest.household_id}</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/60 p-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">Account Email</div>
                  <div className="mt-0.5 text-slate-200">{selectedRequest.account_email}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">Site ID / Plant ID</div>
                  <div className="mt-0.5 font-mono text-emerald-300">{selectedRequest.site_id}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">Inverter Serial</div>
                  <div className="mt-0.5 font-mono text-slate-200">{selectedRequest.inverter_serial || '—'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">Requested</div>
                  <div className="mt-0.5 text-slate-200">
                    {new Date(selectedRequest.requested_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">Notes from household</div>
                  <div className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-slate-300">
                    {selectedRequest.notes}
                  </div>
                </div>
              )}
            </div>

            {showRejectForm && (
              <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/10 p-4">
                <label className="text-sm font-medium text-red-300">Reason for rejection (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Could not verify Site ID ownership"
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {!showRejectForm ? (
                <>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={isProcessing}
                    className="rounded-xl border border-red-600/60 px-6 py-2.5 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Reject Request
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={isProcessing}
                    className="rounded-xl bg-emerald-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-800"
                  >
                    {isProcessing ? 'Processing...' : 'Approve & Activate Household'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    disabled={isProcessing}
                    className="rounded-xl border border-slate-600 px-6 py-2.5 text-sm hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReject(selectedRequest)}
                    disabled={isProcessing}
                    className="rounded-xl bg-red-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:bg-red-800"
                  >
                    {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
              Approving gives the household read-only access to their solar + battery data.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Requests;