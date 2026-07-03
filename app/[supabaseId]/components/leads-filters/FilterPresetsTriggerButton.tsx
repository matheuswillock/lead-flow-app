"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterPresetsTriggerButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  isActive: boolean;
}

export const FilterPresetsTriggerButton = React.forwardRef<
  HTMLButtonElement,
  FilterPresetsTriggerButtonProps
>(({ isActive, className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="outline"
    className={cn("h-8 px-2 lg:px-3", isActive && "border-primary/70 text-primary", className)}
    {...props}
  >
    <Heart className={cn("mr-2 size-4", isActive && "fill-primary text-primary")} />
    Presets
  </Button>
));
FilterPresetsTriggerButton.displayName = "FilterPresetsTriggerButton";
