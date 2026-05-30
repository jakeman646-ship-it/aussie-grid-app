import { Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LoginPage } from "@/app/routes/LoginPage";
import { DashboardPage } from "@/app/routes/DashboardPage";
import { NotFoundPage } from "@/app/routes/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
