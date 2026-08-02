import { Link, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NAV_SECTIONS } from "@/constants/navigation";
import { getNavIcon } from "@/constants/nav-icons";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative flex h-full shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-md"
      >
        <div className="flex h-14 items-center gap-3 border-b border-border px-3">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="AgentSphere home"
          >
            <BrandLogo size={36} />
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-w-0"
              >
                <p className="font-brand truncate text-sm font-semibold leading-tight">AgentSphere</p>
                <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                  Console
                </p>
              </motion.div>
            )}
          </Link>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-4 px-2">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                {!collapsed && (
                  <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {section.title}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = getNavIcon(item.href);
                    const link = (
                      <NavLink
                        to={item.href}
                        end={item.href === "/"}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            collapsed && "justify-center px-0",
                          )
                        }
                      >
                        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    );

                    if (collapsed) {
                      return (
                        <li key={item.href}>
                          <Tooltip>
                            <TooltipTrigger asChild>{link}</TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        </li>
                      );
                    }

                    return <li key={item.href}>{link}</li>;
                  })}
                </ul>
                {!collapsed && <Separator className="mt-4" />}
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className={cn("w-full", !collapsed && "justify-start")}
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
