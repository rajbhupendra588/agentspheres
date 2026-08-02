import { useLocation } from "react-router-dom";
import { Search, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { StatusIndicator } from "@/components/status-indicator";
import { PathBreadcrumbs } from "@/lib/breadcrumbs";
import { useUiStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export interface TopbarProps {
  meshHealthy?: boolean;
  className?: string;
}

export function Topbar({ meshHealthy = true, className }: TopbarProps) {
  const location = useLocation();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const subject = useAuthStore((s) => s.subject);
  const role = useAuthStore((s) => s.role);
  const clearSession = useAuthStore((s) => s.clearSession);

  const initials = subject
    ? subject
        .split(/[@.\s]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "OP";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <PathBreadcrumbs pathname={location.pathname} />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 w-48 justify-start text-muted-foreground sm:flex"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left text-xs">Search…</span>
          <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] lg:inline">
            ⌘K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open search"
        >
          <Search className="h-4 w-4" />
        </Button>

        <TenantSwitcher />

        <div className="hidden rounded-full border border-border bg-muted/40 px-3 py-1 md:block">
          <StatusIndicator
            label={meshHealthy ? "Mesh healthy" : "Mesh degraded"}
            tone={meshHealthy ? "success" : "warning"}
            pulse={meshHealthy}
          />
        </div>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{subject ?? "Operator"}</span>
                {role && (
                  <span className="text-xs font-normal capitalize text-muted-foreground">{role}</span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearSession}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
