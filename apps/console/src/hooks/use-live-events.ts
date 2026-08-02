import { useEffect, useRef } from "react";
import { createEventSource } from "@/api/mesh";
import type { MeshEvent } from "@/models/mesh";
import { useEventsStore } from "@/stores/events-store";
import { usePreferencesStore } from "@/stores/preferences-store";

function parseMeshEvent(raw: string): MeshEvent | null {
  if (!raw || raw.startsWith(":")) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<MeshEvent>;
    if (typeof parsed.type === "string" && typeof parsed.ts === "string") {
      return {
        id: crypto.randomUUID(),
        type: parsed.type,
        payload: parsed.payload,
        ts: parsed.ts,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function useLiveEvents() {
  const liveFeedEnabled = usePreferencesStore((state) => state.liveFeedEnabled);
  const pushEvent = useEventsStore((state) => state.pushEvent);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!liveFeedEnabled) {
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }

    const source = createEventSource();
    sourceRef.current = source;

    source.onmessage = (message) => {
      const event = parseMeshEvent(message.data);
      if (event) {
        pushEvent(event);
      }
    };

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [liveFeedEnabled, pushEvent]);
}
