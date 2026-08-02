import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { AppProviders } from "./providers/app-providers";
import { ThemeProvider } from "./providers/theme-provider";
import "./styles/globals.css";

async function loadRuntimeConfig(): Promise<void> {
  await new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = `/config.js?t=${Date.now()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

async function bootstrap(): Promise<void> {
  await loadRuntimeConfig();

  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element #root not found");
  }

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProviders>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AppProviders>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
