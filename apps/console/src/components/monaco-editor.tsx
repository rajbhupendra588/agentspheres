import * as React from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
  options?: editor.IStandaloneEditorConstructionOptions;
}

function resolveMonacoTheme(theme: string): "vs" | "vs-dark" {
  if (theme === "dark") return "vs-dark";
  if (theme === "light") return "vs";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "vs-dark" : "vs";
}

export function MonacoEditor({
  value,
  onChange,
  language = "json",
  readOnly = false,
  height = "320px",
  className,
  options,
}: MonacoEditorProps) {
  const theme = useUiStore((s) => s.theme);
  const editorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null);

  const monacoTheme = React.useMemo(() => resolveMonacoTheme(theme), [theme]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system" && editorRef.current) {
        const monaco = (window as Window & { monaco?: typeof import("monaco-editor") }).monaco;
        monaco?.editor.setTheme(resolveMonacoTheme("system"));
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const handleMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;
  };

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <Editor
        height={height}
        language={language}
        theme={monacoTheme}
        value={value}
        onChange={(v) => onChange?.(v ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          readOnly,
          automaticLayout: true,
          ...options,
        }}
      />
    </div>
  );
}
