import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RoutingState {
  preferredVersions: Record<string, string>;
  defaultLimit: number;
  setPreferredVersion: (capability: string, version: string) => void;
  removePreferredVersion: (capability: string) => void;
  setDefaultLimit: (limit: number) => void;
}

export const useRoutingStore = create<RoutingState>()(
  persist(
    (set) => ({
      preferredVersions: {},
      defaultLimit: 10,
      setPreferredVersion: (capability, version) =>
        set((state) => ({
          preferredVersions: { ...state.preferredVersions, [capability]: version },
        })),
      removePreferredVersion: (capability) =>
        set((state) => {
          const next = { ...state.preferredVersions };
          delete next[capability];
          return { preferredVersions: next };
        }),
      setDefaultLimit: (defaultLimit) => set({ defaultLimit }),
    }),
    { name: "agentsphere.routing" },
  ),
);
