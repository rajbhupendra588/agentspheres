import type { ServerResponse } from "node:http";

export interface SseClient {
  id: string;
  response: ServerResponse;
}

const clients = new Set<SseClient>();

export function addClient(client: SseClient): void {
  clients.add(client);
}

export function removeClient(client: SseClient): void {
  clients.delete(client);
}

export function broadcast(data: unknown): number {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  let delivered = 0;

  for (const client of clients) {
    try {
      client.response.write(payload);
      delivered += 1;
    } catch {
      clients.delete(client);
    }
  }

  return delivered;
}

export function clientCount(): number {
  return clients.size;
}
