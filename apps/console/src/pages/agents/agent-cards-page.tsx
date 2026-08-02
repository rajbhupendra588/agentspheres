import * as React from "react";
import { CreditCard } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { JsonViewer } from "@/components/json-viewer";
import { MonacoEditor } from "@/components/monaco-editor";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { ApiClientError } from "@/api/client";
import type { AgentInstance } from "@/models/agent";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

interface UniqueCard {
  key: string;
  agentName: string;
  version: string;
  card: unknown;
  instanceCount: number;
}

function uniqueCards(agents: AgentInstance[]): UniqueCard[] {
  const map = new Map<string, UniqueCard>();

  for (const agent of agents) {
    if (agent.card == null) continue;
    const key = `${agent.agentName}::${agent.version}`;
    const existing = map.get(key);
    if (existing) {
      existing.instanceCount += 1;
    } else {
      map.set(key, {
        key,
        agentName: agent.agentName,
        version: agent.version,
        card: agent.card,
        instanceCount: 1,
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    a.agentName === b.agentName
      ? a.version.localeCompare(b.version)
      : a.agentName.localeCompare(b.agentName),
  );
}

function stringifyCard(card: unknown): string {
  try {
    return JSON.stringify(card, null, 2);
  } catch {
    return String(card);
  }
}

export function AgentCardsPage() {
  const { data, isLoading, isError, error, refetch } = useAgents();
  const [search, setSearch] = React.useState("");
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const cards = React.useMemo(() => uniqueCards(data?.agents ?? []), [data?.agents]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.agentName.toLowerCase().includes(q) ||
        c.version.toLowerCase().includes(q) ||
        stringifyCard(c.card).toLowerCase().includes(q),
    );
  }, [cards, search]);

  React.useEffect(() => {
    if (filtered.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filtered.some((c) => c.key === selectedKey)) {
      setSelectedKey(filtered[0]!.key);
    }
  }, [filtered, selectedKey]);

  const selected = filtered.find((c) => c.key === selectedKey) ?? null;

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          message={error instanceof ApiClientError ? error.message : "Failed to load agent cards"}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Agent Cards"
          description="Unique Agent Card payloads deduplicated by agent name and version."
        />

        {cards.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No agent cards"
            description="Cards are included when agents register via the SDK."
          />
        ) : (
          <>
            <div className="mb-4 max-w-md">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search cards by name, version, or content…"
                aria-label="Search agent cards"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No matching cards" description="Try a different search term." />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr]">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle className="text-base">Cards ({filtered.length})</CardTitle>
                    <CardDescription>One entry per agentName + version</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-16rem)]">
                      <ul className="divide-y divide-border">
                        {filtered.map((entry) => (
                          <li key={entry.key}>
                            <button
                              type="button"
                              className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                                selectedKey === entry.key ? "bg-muted/60" : ""
                              }`}
                              onClick={() => setSelectedKey(entry.key)}
                            >
                              <span className="font-medium">{entry.agentName}</span>
                              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">v{entry.version}</Badge>
                                {entry.instanceCount} instance
                                {entry.instanceCount === 1 ? "" : "s"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {selected ? `${selected.agentName}@${selected.version}` : "Select a card"}
                    </CardTitle>
                    {selected && (
                      <CardDescription>
                        Shared by {selected.instanceCount} registered instance
                        {selected.instanceCount === 1 ? "" : "s"}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {!selected ? (
                      <p className="text-sm text-muted-foreground">Select a card from the list.</p>
                    ) : (
                      <Tabs defaultValue="viewer">
                        <TabsList>
                          <TabsTrigger value="viewer">JsonViewer</TabsTrigger>
                          <TabsTrigger value="monaco">Monaco</TabsTrigger>
                        </TabsList>
                        <TabsContent value="viewer" className="mt-4">
                          <JsonViewer data={selected.card} />
                        </TabsContent>
                        <TabsContent value="monaco" className="mt-4">
                          <MonacoEditor
                            value={stringifyCard(selected.card)}
                            readOnly
                            height="calc(100vh - 20rem)"
                          />
                        </TabsContent>
                      </Tabs>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
