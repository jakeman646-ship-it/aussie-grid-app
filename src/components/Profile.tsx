/**
 * Aussie Grid - Profile page
 * File: src/components/Profile.tsx
 * Version: v0.1.3.1
 * Updated: 3 Sep 2026 — admin impersonate Renew without waiting on household row.
 */
import { useEffect, useState, type FormEvent } from "react";
import { isHouseholdReadingFresh } from "@/components/energySystem";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useLatestReadingAt } from "@/hooks/useLatestReadingAt";
import { useOutcomeRanks } from "@/hooks/useOutcomeRanks";
import { usePilotHousehold } from "@/hooks/usePilotHousehold";
import { isAdminUser } from "@/lib/adminAccess";
import {
  markSungrowRenewClicked,
  readSungrowRenewClickedAt,
  requestSungrowRenewLink,
} from "@/lib/api/requestSungrowRenewLink";
import { getCurrentHouseholdId } from "@/lib/currentHousehold";
import {
  audPerKwhToCentsDisplay,
  centsPerKwhToAud,
} from "@/lib/api/submitConnectionRequest";
import { OUTCOME_LABELS } from "@/lib/outcomeRanks";
import { mutationTimeout, supabase } from "@/lib/supabase";
import type { OutcomeKey } from "@/types/outcomeRanks";

interface ProfileProps {
  onBack: () => void;
  onSignOut: () => void;
  onConnectInverter?: () => void;
  /** True while App.tsx is calling supabase.auth.signOut(). */
  signingOut?: boolean;
  /** Shown when sign-out fails (handled in App.tsx). */
  signOutError?: string | null;
}

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

/** Email/password users have an "email" identity; OAuth-only accounts do not. */
function userHasEmailPasswordLogin(
  identities: { provider?: string }[] | undefined
): boolean {
  return identities?.some((identity) => identity.provider === "email") ?? false;
}

function moveKey(order: OutcomeKey[], index: number, direction: -1 | 1): OutcomeKey[] {
  const next = [...order];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  const tmp = next[index];
  next[index] = next[target];
  next[target] = tmp;
  return next;
}

function isSungrowHousehold(opts: {
  inverterMake?: string | null;
  sungrowPlantId?: string | null;
}): boolean {
  const make = (opts.inverterMake || "").toLowerCase();
  if (make.includes("tesla") || make.includes("sigenergy") || make.includes("sigen")) {
    return false;
  }
  return make.includes("sungrow") || Boolean(opts.sungrowPlantId?.trim());
}

function isBlockedOemForSungrowRenew(inverterMake?: string | null): boolean {
  const make = (inverterMake || "").toLowerCase();
  return make.includes("tesla") || make.includes("sigenergy") || make.includes("sigen");
}

/** URL ?impersonate= only — not a household insert, not RLS proof. */
function readImpersonateHouseholdId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("impersonate")?.trim() || "";
}

export default function Profile({
  onBack,
  onSignOut,
  onConnectInverter,
  signingOut = false,
  signOutError = null,
}: ProfileProps) {
  const loggedInHouseholdId = getCurrentHouseholdId();
  const { effectiveHouseholdId, isImpersonating } = useImpersonation(loggedInHouseholdId);
  const { data: household, loading, error: householdError, refetch } = usePilotHousehold(
    effectiveHouseholdId,
    {
      isImpersonating,
      allowMissing: true,
    }
  );
  // Prefer registry household_id once loaded; never write under a mismatched id.
  const ranksHouseholdId = household?.household_id ?? effectiveHouseholdId;
  const outcomeRanks = useOutcomeRanks(ranksHouseholdId, { isImpersonating });
  const { lastReadingAt, loading: readingLoading } = useLatestReadingAt(ranksHouseholdId);

  const [draftOrder, setDraftOrder] = useState<OutcomeKey[]>(outcomeRanks.orderedKeys);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [retailPlanName, setRetailPlanName] = useState("");
  const [retailPeakCents, setRetailPeakCents] = useState("");
  const [retailShoulderCents, setRetailShoulderCents] = useState("");
  const [retailOffPeakCents, setRetailOffPeakCents] = useState("");
  const [retailFitCents, setRetailFitCents] = useState("");
  const [ratesSaving, setRatesSaving] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [ratesSuccess, setRatesSuccess] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [renewBusy, setRenewBusy] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [renewCopied, setRenewCopied] = useState(false);
  const [renewClickedAt, setRenewClickedAt] = useState<number | null>(null);

  // Keep draft order in sync when fetched ranks load / change household.
  useEffect(() => {
    if (!outcomeRanks.loading) {
      setDraftOrder(outcomeRanks.orderedKeys);
    }
  }, [outcomeRanks.loading, outcomeRanks.orderedKeys, ranksHouseholdId]);

  // Load stored retail_* into the rates form when the household row is available.
  useEffect(() => {
    if (!household) {
      setRetailPlanName("");
      setRetailPeakCents("");
      setRetailShoulderCents("");
      setRetailOffPeakCents("");
      setRetailFitCents("");
      return;
    }
    setRetailPlanName(household.retail_plan_id ?? "");
    setRetailPeakCents(audPerKwhToCentsDisplay(household.retail_peak_rate));
    setRetailShoulderCents(audPerKwhToCentsDisplay(household.retail_shoulder_rate));
    setRetailOffPeakCents(audPerKwhToCentsDisplay(household.retail_off_peak_rate));
    setRetailFitCents(audPerKwhToCentsDisplay(household.retail_fit_rate));
  }, [
    household?.household_id,
    household?.retail_plan_id,
    household?.retail_peak_rate,
    household?.retail_shoulder_rate,
    household?.retail_off_peak_rate,
    household?.retail_fit_rate,
  ]);

  useEffect(() => {
    let cancelled = false;
    isAdminUser()
      .then((ok) => {
        if (cancelled) return;
        setIsAdmin(ok);
      })
      .finally(() => {
        if (!cancelled) setAdminReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const impersonateId = readImpersonateHouseholdId();
    const hid = (isAdmin && impersonateId ? impersonateId : ranksHouseholdId).trim();
    setRenewClickedAt(readSungrowRenewClickedAt(hid));
  }, [ranksHouseholdId, isAdmin]);

  // connection_status is optional on the FE select — fail-open if RLS/schema blocks it.
  useEffect(() => {
    const impersonateId = readImpersonateHouseholdId();
    const hid = (household?.household_id || (isAdmin ? impersonateId : "")).trim();
    if (!hid) {
      setConnectionStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("pilot_households")
          .select("connection_status")
          .eq("household_id", hid)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setConnectionStatus(null);
          return;
        }
        const raw = (data as { connection_status?: string | null } | null)?.connection_status;
        setConnectionStatus(typeof raw === "string" && raw.trim() ? raw.trim() : null);
      } catch {
        if (!cancelled) setConnectionStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [household?.household_id, isAdmin]);

  // Scroll to priorities card when opened via Dashboard "Change priorities".
  useEffect(() => {
    const scrollToPriorities = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== "#priorities") return;
      const el = document.getElementById("priorities");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scrollToPriorities();
    window.addEventListener("hashchange", scrollToPriorities);
    return () => window.removeEventListener("hashchange", scrollToPriorities);
  }, []);

  // Resolve the signed-in user (getUser with getSession fallback, same as adminAccess).
  useEffect(() => {
    let cancelled = false;

    async function loadAuthUser() {
      try {
        const {
          data: { user: userFromGetUser },
        } = await supabase.auth.getUser();

        let user = userFromGetUser;

        if (!user?.email) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          user = session?.user ?? null;
        }

        if (cancelled) return;

        if (user?.email) {
          setAuthEmail(user.email);
          setCanChangePassword(userHasEmailPasswordLogin(user.identities));
        } else {
          setAuthEmail(null);
          setCanChangePassword(false);
        }
      } catch {
        if (!cancelled) {
          setAuthEmail(null);
          setCanChangePassword(false);
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    loadAuthUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    const email = authEmail ?? household?.email;
    if (!email) {
      setPasswordError("Could not determine your account email. Please sign in again.");
      return;
    }

    setPasswordLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_changed_password: true },
      });

      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Your password has been updated successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update password. Please try again.";
      setPasswordError(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveRates = async () => {
    setRatesError(null);
    setRatesSuccess(null);

    if (isImpersonating) {
      setRatesError("View only while impersonating.");
      return;
    }

    if (!household?.household_id) {
      setRatesError("Add rates on Connect Inverter first");
      return;
    }

    const planName = retailPlanName.trim();
    const peak = centsPerKwhToAud(retailPeakCents);
    const shoulder = centsPerKwhToAud(retailShoulderCents);
    const offPeak = centsPerKwhToAud(retailOffPeakCents);
    const fit = centsPerKwhToAud(retailFitCents);

    if (!planName && peak === null && shoulder === null && offPeak === null && fit === null) {
      setRatesError("Enter a plan name or at least one rate (¢/kWh). Blank fields are left unchanged.");
      return;
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (planName) patch.retail_plan_id = planName.slice(0, 120);
    if (peak !== null) patch.retail_peak_rate = peak;
    if (shoulder !== null) patch.retail_shoulder_rate = shoulder;
    if (offPeak !== null) patch.retail_off_peak_rate = offPeak;
    if (fit !== null) patch.retail_fit_rate = fit;

    setRatesSaving(true);
    try {
      const { data, error } = await supabase
        .from("pilot_households")
        .update(patch)
        .eq("household_id", household.household_id)
        .select("household_id")
        .abortSignal(mutationTimeout())
        .maybeSingle();

      if (error) {
        const code = "code" in error && error.code ? String(error.code) : "";
        const details =
          "details" in error && error.details ? String(error.details) : "";
        const hint = "hint" in error && error.hint ? String(error.hint) : "";
        const parts = [
          error.message || "Save failed",
          code ? `(${code})` : "",
          details,
          hint,
        ].filter(Boolean);
        setRatesError(
          `Could not save rates. ${parts.join(" ")} This is often a permissions (RLS) block — not saved.`
        );
        return;
      }

      if (!data?.household_id) {
        setRatesError(
          "Save did not update a household row (missing row or RLS). Not saved."
        );
        return;
      }

      setRatesSuccess(
        "Rates saved. This is a bill snapshot only — not a priced tariff, not connected, and not control. Dollar estimates stay off until we have a priced tariff for your network."
      );
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save rates. Please try again.";
      setRatesError(message);
    } finally {
      setRatesSaving(false);
    }
  };

  const mintSungrowRenew = async (): Promise<string> => {
    const impersonateId = readImpersonateHouseholdId();
    const hid = (
      isAdmin && impersonateId
        ? impersonateId
        : household?.household_id || (!impersonateId ? loggedInHouseholdId : "")
    ).trim();
    if (!hid) {
      throw new Error("Connect your inverter first");
    }
    if (impersonateId && !isAdmin) {
      throw new Error("View only while impersonating");
    }
    const result = await requestSungrowRenewLink(hid);
    const clicked = Date.now();
    markSungrowRenewClicked(hid, clicked);
    setRenewClickedAt(clicked);
    return result.authorizeUrl;
  };

  const handleRenewOpen = async () => {
    setRenewError(null);
    setRenewCopied(false);
    setRenewBusy(true);
    try {
      const url = await mintSungrowRenew();
      window.location.assign(url);
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : "Could not create a Renew link");
    } finally {
      setRenewBusy(false);
    }
  };

  const handleRenewCopy = async () => {
    setRenewError(null);
    setRenewCopied(false);
    setRenewBusy(true);
    try {
      const url = await mintSungrowRenew();
      await navigator.clipboard.writeText(url);
      setRenewCopied(true);
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : "Could not copy Renew link");
    } finally {
      setRenewBusy(false);
    }
  };

  const handleSavePriorities = async () => {
    outcomeRanks.clearSaveFeedback();
    await outcomeRanks.saveOrderedKeys(draftOrder);
  };

  const handleCancelPriorities = () => {
    setDraftOrder(outcomeRanks.orderedKeys);
    outcomeRanks.clearSaveFeedback();
  };

  const displayEmail = authEmail ?? household?.email ?? "-";
  const prioritiesDirty =
    draftOrder.length === outcomeRanks.orderedKeys.length &&
    draftOrder.some((key, i) => key !== outcomeRanks.orderedKeys[i]);

  const impersonateHouseholdId = readImpersonateHouseholdId();
  const adminMintHouseholdId =
    adminReady && isAdmin && impersonateHouseholdId ? impersonateHouseholdId : "";
  const mintHouseholdId = (
    adminMintHouseholdId ||
    household?.household_id ||
    (!impersonateHouseholdId ? loggedInHouseholdId : "")
  ).trim();
  const blockedOem = isBlockedOemForSungrowRenew(household?.inverter_make);
  const sungrowHome = isSungrowHousehold({
    inverterMake: household?.inverter_make,
    sungrowPlantId: household?.sungrow_plant_id,
  });
  const showAdminRenewCard = Boolean(adminMintHouseholdId) && !blockedOem;
  const readingFresh = isHouseholdReadingFresh(lastReadingAt);
  const readingNewerThanRenewClick =
    !renewClickedAt ||
    (Boolean(lastReadingAt) && Date.parse(lastReadingAt as string) > renewClickedAt);
  const needsRenew =
    showAdminRenewCard ||
    (sungrowHome &&
      (connectionStatus === "reauth_required" || !readingFresh || !readingNewerThanRenewClick));
  const canMintRenew = Boolean(mintHouseholdId && (showAdminRenewCard || (!impersonateHouseholdId && sungrowHome)));
  const showRenewCard = showAdminRenewCard || sungrowHome;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          Back to Dashboard
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
              <div className="text-lg font-medium text-slate-900">{displayEmail}</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-1">Account Type</div>
              <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                Pilot Participant
              </div>
            </div>
          </div>
        </div>

        {/* Electricity rates — owner-entered bill snapshot (not a priced tariff). */}
        <div className="rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-sm mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Your electricity rates (optional)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              From your bill, in ¢/kWh. Monitoring works without this. Saving rates is not a
              priced tariff, not connected, and not control. Dollar estimates stay off until we
              have a priced tariff for your network.
            </p>
            {isImpersonating && (
              <p className="mt-2 text-sm text-amber-700">View only while impersonating</p>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading rates...</p>
          ) : householdError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              Could not load household: {householdError.message}
            </div>
          ) : !household ? (
            <p className="text-sm text-slate-600">
              Add rates on Connect Inverter first
            </p>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="retail-plan-name"
                    className="mb-1.5 block text-sm font-semibold text-slate-600"
                  >
                    Plan name{" "}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="retail-plan-name"
                    type="text"
                    value={retailPlanName}
                    onChange={(event) => setRetailPlanName(event.target.value.slice(0, 120))}
                    disabled={isImpersonating || ratesSaving || signingOut}
                    className={INPUT_CLASS}
                    placeholder="e.g. Origin TOU"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="retail-peak"
                      className="mb-1.5 block text-sm font-semibold text-slate-600"
                    >
                      Peak ¢/kWh
                    </label>
                    <input
                      id="retail-peak"
                      type="text"
                      inputMode="decimal"
                      value={retailPeakCents}
                      onChange={(event) =>
                        setRetailPeakCents(event.target.value.replace(/[^\d.]/g, ""))
                      }
                      disabled={isImpersonating || ratesSaving || signingOut}
                      className={INPUT_CLASS}
                      placeholder="e.g. 34"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="retail-shoulder"
                      className="mb-1.5 block text-sm font-semibold text-slate-600"
                    >
                      Shoulder ¢/kWh{" "}
                      <span className="font-normal text-slate-400">(if on bill)</span>
                    </label>
                    <input
                      id="retail-shoulder"
                      type="text"
                      inputMode="decimal"
                      value={retailShoulderCents}
                      onChange={(event) =>
                        setRetailShoulderCents(event.target.value.replace(/[^\d.]/g, ""))
                      }
                      disabled={isImpersonating || ratesSaving || signingOut}
                      className={INPUT_CLASS}
                      placeholder="optional"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="retail-offpeak"
                      className="mb-1.5 block text-sm font-semibold text-slate-600"
                    >
                      Off-peak ¢/kWh
                    </label>
                    <input
                      id="retail-offpeak"
                      type="text"
                      inputMode="decimal"
                      value={retailOffPeakCents}
                      onChange={(event) =>
                        setRetailOffPeakCents(event.target.value.replace(/[^\d.]/g, ""))
                      }
                      disabled={isImpersonating || ratesSaving || signingOut}
                      className={INPUT_CLASS}
                      placeholder="e.g. 22"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="retail-fit"
                      className="mb-1.5 block text-sm font-semibold text-slate-600"
                    >
                      Solar feed-in ¢/kWh
                    </label>
                    <input
                      id="retail-fit"
                      type="text"
                      inputMode="decimal"
                      value={retailFitCents}
                      onChange={(event) =>
                        setRetailFitCents(event.target.value.replace(/[^\d.]/g, ""))
                      }
                      disabled={isImpersonating || ratesSaving || signingOut}
                      className={INPUT_CLASS}
                      placeholder="e.g. 8"
                    />
                  </div>
                </div>
              </div>

              {ratesError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {ratesError}
                </div>
              )}

              {ratesSuccess && (
                <div
                  role="status"
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                  {ratesSuccess}
                </div>
              )}

              {!isImpersonating && (
                <button
                  type="button"
                  onClick={handleSaveRates}
                  disabled={ratesSaving || signingOut}
                  className="mt-5 w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ratesSaving ? "Saving…" : "Save rates"}
                </button>
              )}
            </>
          )}
        </div>

        {/* What matters most - user-ranked outcomes (P0 suggest-only) */}
        <div
          id="priorities"
          className="rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-sm mb-6 scroll-mt-24"
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">What matters most</h2>
            <p className="mt-1 text-sm text-slate-600">
              This shapes suggestions and reports. We do not control your inverter in this
              pilot phase.
            </p>
            {outcomeRanks.isReadOnly && (
              <p className="mt-2 text-sm text-amber-700">View only while impersonating</p>
            )}
          </div>

          {outcomeRanks.loading ? (
            <p className="text-sm text-slate-500">Loading priorities...</p>
          ) : (
            <ol className="space-y-2">
              {draftOrder.map((key, index) => (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
                    {OUTCOME_LABELS[key]}
                  </span>
                  {!outcomeRanks.isReadOnly && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${OUTCOME_LABELS[key]} up`}
                        disabled={index === 0 || outcomeRanks.saving}
                        onClick={() => setDraftOrder((prev) => moveKey(prev, index, -1))}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${OUTCOME_LABELS[key]} down`}
                        disabled={index === draftOrder.length - 1 || outcomeRanks.saving}
                        onClick={() => setDraftOrder((prev) => moveKey(prev, index, 1))}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {outcomeRanks.saveError && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {outcomeRanks.saveError}
            </div>
          )}

          {outcomeRanks.saveSuccess && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              {outcomeRanks.saveSuccess}
            </div>
          )}

          {!outcomeRanks.isReadOnly && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleSavePriorities}
                disabled={
                  outcomeRanks.loading ||
                  outcomeRanks.saving ||
                  signingOut ||
                  !prioritiesDirty
                }
                className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
              >
                {outcomeRanks.saving ? "Saving…" : "Save priorities"}
              </button>
              {prioritiesDirty && (
                <button
                  type="button"
                  onClick={handleCancelPriorities}
                  disabled={outcomeRanks.saving || signingOut}
                  className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[8rem]"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {!outcomeRanks.hasSavedRow && !outcomeRanks.loading && !outcomeRanks.isReadOnly && (
            <p className="mt-3 text-xs text-slate-500">
              Showing pilot defaults until you save. Saving creates your first ranked
              preferences.
            </p>
          )}
        </div>

        {/* Sungrow Renew — admin impersonate uses URL household_id even if the row failed to load */}
        {showRenewCard && (
        <div className="rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-sm mb-6">
          <div className="mb-3">
            <div className="text-sm font-semibold text-slate-600 mb-1">Sungrow Inverter</div>
            {showAdminRenewCard && (
              <p className="mb-2 font-mono text-xs text-slate-500">
                household_id {mintHouseholdId}
              </p>
            )}
            {!showAdminRenewCard && (loading || readingLoading) ? (
              <div className="text-sm text-slate-500">Checking connection...</div>
            ) : readingFresh && readingNewerThanRenewClick && connectionStatus !== "reauth_required" && !showAdminRenewCard ? (
              <div>
                <span className="inline-flex items-center gap-2 text-emerald-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Monitoring · read-only
                </span>
                <div className="text-xs text-slate-500 mt-0.5">
                  Last reading{" "}
                  {lastReadingAt
                    ? new Date(lastReadingAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </div>
              </div>
            ) : (
              <div>
                <span className="text-amber-600 font-medium">
                  {renewClickedAt && !readingNewerThanRenewClick
                    ? "Waiting for a new reading after Renew"
                    : connectionStatus === "reauth_required"
                      ? "Re-authorisation required"
                      : "Waiting on a successful data pull"}
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Status turns green only after a household reading newer than Renew
                  (about the last 2 hours).
                </p>
              </div>
            )}
          </div>

          {needsRenew && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="text-base font-semibold text-slate-900">Renew connection</h3>
              <p className="mt-1 text-sm text-slate-600">
                30m ticket. Owner must be logged into THIS house’s iSolarCloud. An already-linked
                grant will bounce — don’t retry that login.
              </p>
              {showAdminRenewCard && (
                <p className="mt-2 text-sm text-amber-700">admin mint</p>
              )}
              {isImpersonating && !isAdmin && (
                <p className="mt-2 text-sm text-amber-700">View only while impersonating</p>
              )}
              {renewError && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {renewError}
                </div>
              )}
              {renewCopied && (
                <p className="mt-3 text-sm text-emerald-700">Link copied. It expires in 30 minutes.</p>
              )}
              {canMintRenew && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleRenewOpen}
                    disabled={renewBusy || signingOut}
                    className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                  >
                    {renewBusy ? "Creating link…" : "Open iSolarCloud"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRenewCopy}
                    disabled={renewBusy || signingOut}
                    className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[8rem]"
                  >
                    Copy link
                  </button>
                </div>
              )}
            </div>
          )}

          {!showAdminRenewCard && !household?.household_id && onConnectInverter && (
            <button
              onClick={onConnectInverter}
              className="mt-4 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition"
            >
              Connect Sungrow
            </button>
          )}
        </div>
        )}

        {!sungrowHome && !loading && !household && onConnectInverter && (
          <div className="rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-sm mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-600 mb-1">Inverter</div>
                <span className="text-amber-600 font-medium">Not connected yet</span>
              </div>
              <button
                onClick={onConnectInverter}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition"
              >
                Connect inverter
              </button>
            </div>
          </div>
        )}

        {/* Change Password — only for email/password sign-in (not OAuth-only accounts). */}
        {!authChecking && canChangePassword && (
          <div className="rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-sm mb-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
              <p className="mt-1 text-sm text-slate-600">
                Update the password you use to sign in with email.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="mb-1.5 block text-sm font-semibold text-slate-600">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={passwordLoading || signingOut}
                  className={INPUT_CLASS}
                  placeholder="Enter your current password"
                />
              </div>

              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-slate-600">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={passwordLoading || signingOut}
                  className={INPUT_CLASS}
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-slate-600">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={passwordLoading || signingOut}
                  className={INPUT_CLASS}
                  placeholder="Re-enter your new password"
                />
              </div>

              {passwordError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                  {passwordSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading || signingOut}
                className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passwordLoading ? "Updating Password…" : "Update Password"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Your new password must be at least 8 characters long.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onSignOut}
            disabled={signingOut || passwordLoading}
            className="w-full rounded-xl bg-red-600 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-red-500 active:bg-red-700 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing Out…" : "Sign Out"}
          </button>
          {signOutError && (
            <p className="text-center text-sm text-red-400" role="alert">
              {signOutError}
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          This is a pilot account. Thank you for helping us test Aussie Grid.
        </p>
      </div>
    </div>
  );
}
