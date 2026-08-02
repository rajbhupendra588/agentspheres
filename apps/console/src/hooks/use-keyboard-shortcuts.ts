import { useEffect } from "react";
import { KEYBOARD_SHORTCUTS } from "@/constants/navigation";
import { useUiStore } from "@/stores/ui-store";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function matchesShortcut(
  event: KeyboardEvent,
  keys: string[],
  modifier: "meta" | "ctrl",
): boolean {
  const primaryModifier = modifier === "meta" ? event.metaKey : event.ctrlKey;
  const alternateModifier = modifier === "meta" ? event.ctrlKey : event.metaKey;

  if (!primaryModifier || alternateModifier) {
    return false;
  }

  const pressed = event.key.toLowerCase();
  return keys.some((key) => key.toLowerCase() === pressed);
}

export function useKeyboardShortcuts() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const paletteShortcut = KEYBOARD_SHORTCUTS.find((item) => item.id === "command-palette");
      const sidebarShortcut = KEYBOARD_SHORTCUTS.find((item) => item.id === "toggle-sidebar");

      if (
        paletteShortcut &&
        matchesShortcut(event, paletteShortcut.keys, paletteShortcut.modifier)
      ) {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (
        sidebarShortcut &&
        matchesShortcut(event, sidebarShortcut.keys, sidebarShortcut.modifier)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandPaletteOpen, toggleSidebar]);
}
