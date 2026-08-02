import type { DiscoveryInstance } from "@agentsphere/contracts";

const cursors = new Map<string, number>();

export function weightedRoundRobinOrder(
  instances: DiscoveryInstance[],
  capability: string,
): DiscoveryInstance[] {
  if (instances.length === 0) {
    return [];
  }

  const sorted = [...instances].sort((a, b) => {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.instanceId.localeCompare(b.instanceId);
  });

  const ring: DiscoveryInstance[] = [];
  for (const inst of sorted) {
    for (let i = 0; i < inst.weight; i++) {
      ring.push(inst);
    }
  }

  if (ring.length === 0) {
    return sorted;
  }

  const cursor = cursors.get(capability) ?? 0;
  const start = cursor % ring.length;
  cursors.set(capability, cursor + 1);

  const seen = new Set<string>();
  const ordered: DiscoveryInstance[] = [];

  for (let i = 0; i < ring.length; i++) {
    const inst = ring[(start + i) % ring.length]!;
    if (!seen.has(inst.instanceId)) {
      seen.add(inst.instanceId);
      ordered.push(inst);
    }
  }

  return ordered;
}
