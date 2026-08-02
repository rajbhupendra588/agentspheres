import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import { resolveGatewayBaseUrl } from "@/api/client";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { usePreferencesStore } from "@/stores/preferences-store";
import {
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

export function ConfigurationPage() {
  const gatewayUrl = resolveGatewayBaseUrl() || "(same origin — proxied in dev)";
  const { data: health } = useMeshHealth();
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

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Configuration"
          description="Gateway resolution, environment mode, and console preferences."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Gateway</CardTitle>
              <CardDescription>Mesh API base URL resolution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <JsonViewer
                data={{
                  resolvedBaseUrl: gatewayUrl,
                  mode: import.meta.env.MODE,
                  dev: import.meta.env.DEV,
                  viteGatewayUrl: import.meta.env.VITE_GATEWAY_URL ?? null,
                  windowGateway:
                    typeof window !== "undefined" ? window.AGENTSPHERE_GATEWAY ?? null : null,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live health config</CardTitle>
              <CardDescription>From GET /mesh/health</CardDescription>
            </CardHeader>
            <CardContent>
              {health ? (
                <JsonViewer data={health} collapsed />
              ) : (
                <p className="text-sm text-muted-foreground">Health data loading…</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Persisted in local storage</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="cfg-live-feed">Live feed enabled</Label>
                <Switch
                  id="cfg-live-feed"
                  checked={liveFeedEnabled}
                  onCheckedChange={setLiveFeedEnabled}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="cfg-motion">Reduced motion</Label>
                <Switch
                  id="cfg-motion"
                  checked={reducedMotion}
                  onCheckedChange={setReducedMotion}
                />
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
                    <SelectItem value="en-US">English (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageMotion>
    </PageContainer>
  );
}
