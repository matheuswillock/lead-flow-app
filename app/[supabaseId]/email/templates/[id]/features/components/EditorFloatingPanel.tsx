import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type EditorFloatingPanelWidth = "sidebar" | "inspector";

const WIDTH_CLASS: Record<EditorFloatingPanelWidth, string> = {
  sidebar: "w-72",
  inspector: "w-80",
};

interface EditorFloatingPanelProps extends ComponentPropsWithoutRef<"aside"> {
  width?: EditorFloatingPanelWidth;
}

export function EditorFloatingPanel({
  width = "sidebar",
  className,
  ...props
}: EditorFloatingPanelProps) {
  return (
    <aside
      className={cn(
        "flex max-h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-md",
        WIDTH_CLASS[width],
        className
      )}
      {...props}
    />
  );
}
