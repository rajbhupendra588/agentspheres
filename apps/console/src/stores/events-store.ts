import { create } from "zustand";
import type { MeshEvent } from "@/models/mesh";

const MAX_EVENTS = 200;

interface EventsState {
  events: MeshEvent[];
  pushEvent: (event: MeshEvent) => void;
  clear: () => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  events: [],
  pushEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, MAX_EVENTS),
    })),
  clear: () => set({ events: [] }),
}));
