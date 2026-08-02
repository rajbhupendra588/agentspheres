import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "@/layouts/sidebar";
import { Topbar } from "@/layouts/topbar";
import { CommandPalette } from "@/components/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingState } from "@/components/loading-state";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  meshHealthy?: boolean;
  className?: string;
}

export function AppShell({ meshHealthy = true, className }: AppShellProps) {
  return (
    <TooltipProvider>
      <div className={cn("mesh-background flex min-h-screen", className)}>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar meshHealthy={meshHealthy} />
          <main className="flex-1 overflow-auto">
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="p-6">
                    <LoadingState />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
        <CommandPalette />
        <Toaster position="bottom-right" richColors closeButton duration={4000} />
      </div>
    </TooltipProvider>
  );
}
