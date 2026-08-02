import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

function resolveSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveAppliedTheme(theme: "light" | "dark" | "system"): "light" | "dark" {
  return theme === "system" ? resolveSystemTheme() : theme;
}

export function useTheme() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const applied = resolveAppliedTheme(theme);

    root.classList.toggle("dark", applied === "dark");
    root.dataset.theme = applied;
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const root = document.documentElement;
      const applied = resolveSystemTheme();
      root.classList.toggle("dark", applied === "dark");
      root.dataset.theme = applied;
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}
