import * as React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Edge,
  type Node,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

export interface AgentGraphNode {
  instanceId: string;
  agentName: string;
  status: "HEALTHY" | "UNHEALTHY" | "DRAINING" | string;
  capabilities?: string[];
}

export interface AgentFlowProps {
  agents: AgentGraphNode[];
  className?: string;
  height?: string | number;
  showCapabilityHubs?: boolean;
}

const statusColors: Record<string, string> = {
  HEALTHY: "#10b981",
  UNHEALTHY: "#ef4444",
  DRAINING: "#f59e0b",
  UNKNOWN: "#94a3b8",
};

function AgentNode({ data }: { data: { label: string; status: string } }) {
  const color = statusColors[data.status] ?? statusColors.UNKNOWN;

  return (
    <div className="min-w-[140px] rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="truncate text-sm font-medium">{data.label}</span>
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{data.status}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}

function CapabilityHubNode({ data }: { data: { label: string } }) {
  return (
    <div className="rounded-full border border-dashed border-primary/40 bg-accent/50 px-3 py-1.5 text-xs font-medium text-accent-foreground">
      <Handle type="target" position={Position.Top} className="!bg-primary/40" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!bg-primary/40" />
    </div>
  );
}

const nodeTypes = {
  agent: AgentNode,
  capabilityHub: CapabilityHubNode,
};

function buildGraph(
  agents: AgentGraphNode[],
  showCapabilityHubs: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = agents.map((agent, index) => ({
    id: agent.instanceId,
    type: "agent",
    position: {
      x: (index % 4) * 220 + 40,
      y: Math.floor(index / 4) * 140 + 40,
    },
    data: { label: agent.agentName, status: agent.status },
  }));

  const edges: Edge[] = [];
  const capabilityMap = new Map<string, string[]>();

  for (const agent of agents) {
    for (const cap of agent.capabilities ?? []) {
      const list = capabilityMap.get(cap) ?? [];
      list.push(agent.instanceId);
      capabilityMap.set(cap, list);
    }
  }

  if (showCapabilityHubs) {
    let hubIndex = 0;
    for (const [capability, instanceIds] of capabilityMap) {
      if (instanceIds.length < 2) continue;
      const hubId = `hub-${capability}`;
      nodes.push({
        id: hubId,
        type: "capabilityHub",
        position: { x: hubIndex * 180 + 100, y: 280 },
        data: { label: capability },
      });
      for (const instanceId of instanceIds) {
        edges.push({
          id: `${instanceId}-${hubId}`,
          source: instanceId,
          target: hubId,
          type: "smoothstep",
          animated: agents.find((a) => a.instanceId === instanceId)?.status === "HEALTHY",
          style: {
            stroke:
              statusColors[
                agents.find((a) => a.instanceId === instanceId)?.status ?? "UNKNOWN"
              ],
          },
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        });
      }
      hubIndex += 1;
    }
  } else {
    for (const [, instanceIds] of capabilityMap) {
      if (instanceIds.length < 2) continue;
      for (let i = 0; i < instanceIds.length; i++) {
        for (let j = i + 1; j < instanceIds.length; j++) {
          const source = instanceIds[i]!;
          const target = instanceIds[j]!;
          const sourceStatus = agents.find((a) => a.instanceId === source)?.status;
          const targetStatus = agents.find((a) => a.instanceId === target)?.status;
          const animated = sourceStatus === "HEALTHY" && targetStatus === "HEALTHY";
          edges.push({
            id: `${source}-${target}`,
            source,
            target,
            type: "smoothstep",
            animated,
            style: { stroke: animated ? statusColors.HEALTHY : "#94a3b8" },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          });
        }
      }
    }
  }

  return { nodes, edges };
}

export function AgentFlow({
  agents,
  className,
  height = 480,
  showCapabilityHubs = true,
}: AgentFlowProps) {
  const { nodes, edges } = React.useMemo(
    () => buildGraph(agents, showCapabilityHubs),
    [agents, showCapabilityHubs],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="overflow-hidden rounded-lg border border-border bg-background/60"
        style={{ height }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background gap={16} size={1} color="hsl(var(--border))" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={2}
            pannable
            zoomable
            className="!bg-background/90 !border-border"
          />
        </ReactFlow>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">Legend</span>
        {Object.entries(statusColors)
          .filter(([key]) => key !== "UNKNOWN")
          .map(([status, color]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </span>
          ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-emerald-500" />
          Animated = healthy link
        </span>
      </div>
    </div>
  );
}
