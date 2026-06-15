"use client";

import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImportStepperProps {
  stepIndex: number;
  totalSteps: number;
}

function ImportStepper({ stepIndex, totalSteps }: ImportStepperProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
      <span className="flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const position = index + 1;
          const isDone = position < stepIndex;
          const isActive = position === stepIndex;
          return (
            <span
              key={index}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                isActive && "bg-primary ring-2 ring-primary/20",
                isDone && "bg-primary",
                !isActive && !isDone && "bg-border"
              )}
            />
          );
        })}
      </span>
      Etapa {stepIndex} de {totalSteps}
    </span>
  );
}

interface ImportDialogHeaderProps {
  title: string;
  stepIndex: number;
  totalSteps: number;
  stepTitle: string;
  stepDescription: string;
}

export function ImportDialogHeader({
  title,
  stepIndex,
  totalSteps,
  stepTitle,
  stepDescription,
}: ImportDialogHeaderProps) {
  return (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2.5">
        {title}
        <ImportStepper stepIndex={stepIndex} totalSteps={totalSteps} />
      </DialogTitle>
      <DialogDescription>
        <strong className="font-semibold text-foreground/80">{stepTitle}</strong> — {stepDescription}
      </DialogDescription>
    </DialogHeader>
  );
}
