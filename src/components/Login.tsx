/**
 * Aussie Grid — Login
 * File: src/components/Login.tsx
 * Version: v0.1.3.3
 * Updated: 29 Aug 2026 — invite-gated signup toggle; account ≠ connected.
 */
import { useState } from "react";
import { supabase } from "../lib/supabase";

type AuthMode = "signin" | "signup";

const INVITE_CODE =
  (import.meta.env.VITE_PILOT_INVITE_CODE as string | undefined)?.trim() || "VOLUNTEER";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  fontSize: "16px",
  border: "1px solid #ddd",
  borderRadius: "10px",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  color: "#555",
  marginBottom: "8px",
  fontWeight: 500,
};

function inviteMatches(entered: string): boolean {
  return entered.trim().toUpperCase() === INVITE_CODE.toUpperCase();
}

export default function Login() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    resetMessages();
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
    }

    setLoading(false);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter an email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!inviteMatches(inviteCode)) {
      setError("Invite code is wrong. Ask Aussie Grid for a pilot invite.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const identities = data.user?.identities ?? [];
    const hasSession = Boolean(data.session);

    // Confirm-email, or existing user (Supabase returns empty identities).
    if (!hasSession || identities.length === 0) {
      setInfo("Check your email to confirm, then sign in. You are not in the app yet.");
      setMode("signin");
      setPassword("");
      setConfirmPassword("");
      setInviteCode("");
      setLoading(false);
      return;
    }

    // Session present — App onAuthStateChange keeps the user logged in.
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#fff",
          borderRadius: "16px",
          padding: "48px 40px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "#0A2540",
              margin: "0 0 8px 0",
            }}
          >
            Aussie Grid
          </h1>
          <p style={{ color: "#666", fontSize: "16px", margin: 0 }}>
            Pilot Testing Portal
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Account"
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px",
            padding: "4px",
            backgroundColor: "#f1f5f9",
            borderRadius: "10px",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            onClick={() => switchMode("signin")}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: mode === "signin" ? "#fff" : "transparent",
              color: mode === "signin" ? "#0A2540" : "#64748b",
              boxShadow: mode === "signin" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => switchMode("signup")}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: mode === "signup" ? "#fff" : "transparent",
              color: mode === "signup" ? "#0A2540" : "#64748b",
              boxShadow: mode === "signup" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Create account
          </button>
        </div>

        <p
          style={{
            color: "#64748b",
            fontSize: "13px",
            lineHeight: 1.5,
            margin: "0 0 24px 0",
            textAlign: "center",
          }}
        >
          Invite-only volunteer access. Monitoring first. You decide.
        </p>

        {mode === "signin" ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "28px" }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "24px",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            {info && (
              <div
                style={{
                  backgroundColor: "#ecfdf5",
                  color: "#047857",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "24px",
                  fontSize: "14px",
                }}
              >
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: loading ? "#86efac" : "#22C55E",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <p
              style={{
                textAlign: "center",
                margin: "16px 0 0 0",
                fontSize: "14px",
                color: "#64748b",
              }}
            >
              <button
                type="button"
                onClick={() => switchMode("signup")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#16a34a",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Create an account
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleCreateAccount}>
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Password (min 8 characters)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "28px" }}>
              <label style={labelStyle}>Invite code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Pilot invite"
                required
                autoComplete="off"
                style={inputStyle}
              />
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "24px",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: loading ? "#86efac" : "#22C55E",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
            <p
              style={{
                textAlign: "center",
                margin: "16px 0 0 0",
                fontSize: "14px",
                color: "#64748b",
              }}
            >
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#16a34a",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        <p
          style={{
            textAlign: "center",
            color: "#888",
            fontSize: "13px",
            marginTop: "32px",
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Connecting the inverter is a separate step we review. Signup is not connected.
        </p>
      </div>
    </div>
  );
}
