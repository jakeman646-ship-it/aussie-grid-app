/**
 * Aussie Grid — Profile page
 * File: src/components/Profile.tsx
 * Version: v0.1.2.25
 * Lines: 248
 * Updated: 8 Jul 2026 — inline Change Password form for email/password accounts.
 */
import { useEffect, useState, type FormEvent } from "react";
import { usePilotHousehold } from "@/hooks/usePilotHousehold";
import { getCurrentHouseholdId } from "@/lib/currentHousehold";
import { supabase } from "@/lib/supabase";

interface ProfileProps {
  onBack: () => void;
  onSignOut: () => void;
  onConnectInverter?: () => void;
  /** True while App.tsx is calling supabase.auth.signOut(). */
  signingOut?: boolean;
  /** Shown when sign-out fails (handled in App.tsx). */
  signOutError?: string | null;
}

const DEFAULT_USER_ID = getCurrentHouseholdId();

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

/** Email/password users have an "email" identity; OAuth-only accounts do not. */
function userHasEmailPasswordLogin(
  identities: { provider?: string }[] | undefined
): boolean {
  return identities?.some((identity) => identity.provider === "email") ?? false;
}

export default function Profile({
  onBack,
  onSignOut,
  onConnectInverter,
  signingOut = false,
  signOutError = null,
}: ProfileProps) {
  const { data: household, loading } = usePilotHousehold(DEFAULT_USER_ID);

  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

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
      // Verify the current password before allowing an update.
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

  const displayEmail = authEmail ?? household?.email ?? "—";

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

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-slate-500">
          This is a pilot account. Thank you for helping us test Aussie Grid.
        </p>
      </div>
    </div>
  );
}
