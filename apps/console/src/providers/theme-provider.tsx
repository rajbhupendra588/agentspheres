import type { ReactNode } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useLiveEvents } from "@/hooks/use-live-events";
import { useTheme } from "@/hooks/use-theme";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useTheme();
  useKeyboardShortcuts();
  useLiveEvents();

  return children;
}
