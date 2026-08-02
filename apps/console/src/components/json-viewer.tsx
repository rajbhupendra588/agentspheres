import * as React from "react";
import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/utils";

export interface JsonViewerProps {
  data: unknown;
  className?: string;
  collapsed?: boolean;
  maxDepth?: number;
}

function stringifyJson(data: unknown, space = 2): string {
  try {
    return JSON.stringify(data, null, space);
  } catch {
    return String(data);
  }
}

export function JsonViewer({ data, className, collapsed = false }: JsonViewerProps) {
  const formatted = React.useMemo(() => stringifyJson(data), [data]);
  const display = collapsed && formatted.length > 800 ? `${formatted.slice(0, 800)}…` : formatted;

  return (
    <CodeBlock
      code={display}
      language="json"
      className={cn("font-mono text-xs", className)}
    />
  );
}
