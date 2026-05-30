import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-navy">
          <span
            aria-hidden
            className="h-3 w-3 animate-pulse rounded-full bg-energy"
          />
          <span className="text-sm font-medium">Connecting to the grid…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
