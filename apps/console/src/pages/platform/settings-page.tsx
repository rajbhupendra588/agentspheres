import { Link } from "react-router-dom";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageMotion } from "@/pages/shared/page-motion";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { KEYBOARD_SHORTCUTS } from "@/constants/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ui";
import type { Density } from "@/stores/preferences-store";
import type { ThemeMode } from "@/stores/ui-store";

export function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  const {
    liveFeedEnabled,
    density,
    reducedMotion,
    locale,
    setLiveFeedEnabled,
    setDensity,
    setReducedMotion,
    setLocale,
  } = usePreferencesStore();

  const { subject, role, clearSession } = useAuthStore();

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader title="Settings" description="Console appearance, preferences, and session." />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Light, dark, or system</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <ThemeToggle />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sidebar</CardTitle>
              <CardDescription>Default collapsed state</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Label htmlFor="sidebar-collapsed">Collapsed by default</Label>
              <Switch
                id="sidebar-collapsed"
                checked={sidebarCollapsed}
                onCheckedChange={setSidebarCollapsed}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Command palette</CardTitle>
              <CardDescription>Keyboard shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.id} className="flex justify-between">
                  <span className="text-muted-foreground">{shortcut.label}</span>
                  <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                    {shortcut.modifier === "meta" ? "⌘" : "Ctrl"}+{shortcut.keys.join("+")}
                  </kbd>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Live feed</Label>
                <Switch checked={liveFeedEnabled} onCheckedChange={setLiveFeedEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Reduced motion</Label>
                <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
              </div>
              <div className="space-y-2">
                <Label>Density</Label>
                <Select value={density} onValueChange={(v) => setDensity(v as Density)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Locale</Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Auth session</CardTitle>
              <CardDescription>
                Manage JWT session — issue tokens on{" "}
                <Link to="/security" className="text-primary hover:underline">
                  Security
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              {subject ? (
                <p className="text-sm">
                  Signed in as <span className="font-medium">{subject}</span> ({role})
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No active session</p>
              )}
              <Button variant="outline" onClick={clearSession}>
                Clear session
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageMotion>
    </PageContainer>
  );
}
