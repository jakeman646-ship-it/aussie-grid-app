import { Link } from "react-router-dom";

import { Logo } from "@/components/Logo";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <Logo />
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-energy">
          404
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy">
          Off the grid
        </h1>
        <p className="mt-2 max-w-md text-sm text-navy-400">
          We couldn't find that page. Let's get you back to the dashboard.
        </p>
      </div>
      <Link to="/dashboard" className="btn-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
