import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";

type Mode = "signin" | "signup";

interface LocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!loading && user) {
    const state = (location.state ?? null) as LocationState | null;
    const redirectTo = state?.from?.pathname ?? "/dashboard";
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        navigate("/dashboard", { replace: true });
      } else {
        await signUp(email, password);
        setInfo(
          "Account created. Check your inbox to confirm your email, then sign in.",
        );
        setMode("signin");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-stretch bg-slate-50">
      <div className="hidden w-1/2 flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Logo variant="light" />
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Power the community.
            <span className="block text-energy">Powered by community.</span>
          </h1>
          <p className="max-w-md text-base text-navy-100">
            Aussie Grid is a Virtual Power Plant pilot in Mackay, Queensland —
            connecting home batteries, solar, and EVs into one resilient,
            community-owned grid.
          </p>
          <ul className="space-y-2 text-sm text-navy-100">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-energy" />
              Storm-ready resilience
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-energy" />
              Lower bills through smart trading
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-energy" />
              Local jobs, local energy
            </li>
          </ul>
        </div>
        <p className="text-xs text-navy-200">
          A community energy initiative · Mackay, QLD
        </p>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-navy">
            {mode === "signin" ? "Sign in to Aussie Grid" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-navy-400">
            {mode === "signin"
              ? "Welcome back. Let's keep the grid running."
              : "Join the Mackay VPP pilot in under a minute."}
          </p>

          {!isSupabaseConfigured && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong className="font-semibold">Heads up:</strong> Supabase env
              vars are not configured. Copy{" "}
              <code className="rounded bg-amber-100 px-1">.env.example</code> to{" "}
              <code className="rounded bg-amber-100 px-1">.env.local</code> and
              fill in <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_ANON_KEY</code>.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1.5"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-1.5"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {info && (
              <div
                role="status"
                className="rounded-lg border border-energy-200 bg-energy-50 px-4 py-3 text-sm text-energy-700"
              >
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-navy-400">
            {mode === "signin" ? (
              <>
                New to Aussie Grid?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setInfo(null);
                  }}
                  className="font-semibold text-energy hover:text-energy-500"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setInfo(null);
                  }}
                  className="font-semibold text-energy hover:text-energy-500"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
