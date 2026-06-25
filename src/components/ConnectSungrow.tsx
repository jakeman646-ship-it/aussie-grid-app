import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { usePilotHousehold } from "../hooks/usePilotHousehold";
import { getCurrentHouseholdId } from "../lib/currentHousehold";

interface ConnectSungrowProps {
  onBack?: () => void;
  onConnectSuccess?: () => void;
}

export default function ConnectSungrow({ onBack, onConnectSuccess }: ConnectSungrowProps) {
  const householdId = getCurrentHouseholdId();
  const { data: household, loading, refetch } = usePilotHousehold(householdId);

  const [appKey, setAppKey] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (household) {
      if (household.sungrow_app_key) setAppKey(household.sungrow_app_key);
      if (household.sungrow_access_key) setAccessKey(household.sungrow_access_key);
    }
  }, [household]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from("pilot_households")
        .update({
          sungrow_app_key: appKey.trim(),
          sungrow_access_key: accessKey.trim(),
          sungrow_connected_at: new Date().toISOString(),
        })
        .eq("household_id", householdId);

      if (updateError) throw updateError;

      setSuccess(true);
      await refetch();

      // Auto-navigate back after success
      setTimeout(() => {
        onConnectSuccess?.();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to save Sungrow keys");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-white">← Back to Dashboard</button>
        <h1 className="text-3xl font-bold mt-2">Connect Sungrow Inverter</h1>
        <p className="text-gray-400 mt-1">Link your Sungrow system to start sharing data with the pilot.</p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-500 rounded-xl text-green-400">
          ✅ Sungrow system connected successfully! Returning to dashboard...
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-xl text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#111827] border border-white/10 rounded-2xl p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">App Key *</label>
          <input
            type="text"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            placeholder="Paste your Sungrow App Key"
            className="w-full bg-[#0a0f1a] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Access Key *</label>
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="Paste your Sungrow Access Key"
            className="w-full bg-[#0a0f1a] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving || !appKey || !accessKey}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-colors"
        >
          {saving ? "Connecting..." : success ? "Connected ✓" : "Connect Sungrow System"}
        </button>

        <p className="text-xs text-center text-gray-500">
          This is read-only access. We will never control your inverter.
        </p>
      </form>
    </div>
  );
}