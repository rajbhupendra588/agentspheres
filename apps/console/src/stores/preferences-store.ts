import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "comfortable" | "compact";

interface PreferencesState {
  locale: string;
  density: Density;
  reducedMotion: boolean;
  liveFeedEnabled: boolean;
  setLocale: (locale: string) => void;
  setDensity: (density: Density) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setLiveFeedEnabled: (enabled: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: "en",
      density: "comfortable",
      reducedMotion: false,
      liveFeedEnabled: true,
      setLocale: (locale) => set({ locale }),
      setDensity: (density) => set({ density }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setLiveFeedEnabled: (liveFeedEnabled) => set({ liveFeedEnabled }),
    }),
    {
      name: "agentsphere.preferences",
    },
  ),
);
