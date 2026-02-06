"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LeadsFiltersLayoutProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function LeadsFiltersLayout({
  children,
  actions,
  className,
}: LeadsFiltersLayoutProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
