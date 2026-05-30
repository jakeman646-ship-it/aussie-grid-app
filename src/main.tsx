import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "@/app/App";
import { AuthProvider } from "@/hooks/AuthProvider";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find #root element in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
