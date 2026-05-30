import { Outlet, useNavigate } from "react-router-dom";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-navy-500 sm:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="btn-ghost"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-xs text-navy-400">
          <span>© {new Date().getFullYear()} Aussie Grid</span>
          <span>Mackay, Queensland · Community VPP Pilot</span>
        </div>
      </footer>
    </div>
  );
}
