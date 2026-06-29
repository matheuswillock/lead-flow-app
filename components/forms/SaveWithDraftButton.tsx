"use client";

import { ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SaveWithDraftButtonProps {
  isLoading?: boolean;
  isSaveDisabled?: boolean;
  isDraftDisabled?: boolean;
  saveLabel?: string;
  draftLabel?: string;
  loadingLabel?: string;
  onSaveFull: () => void;
  onSaveDraft: () => void;
  className?: string;
}

export function SaveWithDraftButton({
  isLoading = false,
  isSaveDisabled = false,
  isDraftDisabled = false,
  saveLabel = "Salvar",
  draftLabel = "Salvar como rascunho",
  loadingLabel = "Salvando...",
  onSaveFull,
  onSaveDraft,
  className,
}: SaveWithDraftButtonProps) {
  const saveDisabled = isSaveDisabled || isLoading;
  const draftDisabled = isDraftDisabled || isLoading;

  return (
    <div className={cn("inline-flex rounded-md", className)}>
      <Button
        type="button"
        className="rounded-r-none"
        disabled={saveDisabled}
        onClick={onSaveFull}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? loadingLabel : saveLabel}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className="rounded-l-none border-l border-primary-foreground/20 px-2"
            disabled={saveDisabled && draftDisabled}
            aria-label="Mais opções de salvamento"
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={saveDisabled} onClick={onSaveFull}>
            {saveLabel}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={draftDisabled} onClick={onSaveDraft}>
            {draftLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
