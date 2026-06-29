"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackofficeStickyHelpButtonProps = {
  sticky?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
  className?: string;
};

export function BackofficeStickyHelpButton({
  sticky = true,
  onClick,
  "aria-label": ariaLabel = "Ajuda",
  className,
}: BackofficeStickyHelpButtonProps) {
  return (
    <Button
      type="button"
      variant="default"
      size="icon"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "size-12 rounded-full shadow-md",
        sticky && "fixed bottom-6 right-6",
        className,
      )}
    >
      <CircleHelp />
    </Button>
  );
}
