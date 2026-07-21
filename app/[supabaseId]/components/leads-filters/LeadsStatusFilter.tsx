"use client";

import * as React from "react";
import { Check, PlusCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface StatusOption {
  label: string;
  value: string;
}

interface LeadsStatusFilterProps {
  title?: string;
  statusOptions: StatusOption[];
  selectedStatuses: string[];
  onChangeStatuses: (values: string[]) => void;
  meetingHeld?: boolean;
  onToggleMeetingHeld?: (value: boolean) => void;
  transfer?: boolean;
  onToggleTransfer?: (value: boolean) => void;
  draft?: boolean;
  onToggleDraft?: (value: boolean) => void;
}

export function LeadsStatusFilter({
  title = "Status",
  statusOptions,
  selectedStatuses,
  onChangeStatuses,
  meetingHeld = false,
  onToggleMeetingHeld,
  transfer = false,
  onToggleTransfer,
  draft = false,
  onToggleDraft,
}: LeadsStatusFilterProps) {
  const selectedSet = React.useMemo(
    () => new Set(selectedStatuses),
    [selectedStatuses]
  );

  const selectedLabels = React.useMemo(() => {
    const labels = statusOptions
      .filter((option) => selectedSet.has(option.value))
      .map((option) => option.label);
    if (meetingHeld) {
      labels.unshift("Reuniões realizadas");
    }
    if (transfer) {
      labels.unshift("Transferência");
    }
    if (draft) {
      labels.unshift("Rascunhos");
    }
    return labels;
  }, [draft, meetingHeld, selectedSet, statusOptions, transfer]);

  const hasSelections = selectedLabels.length > 0;

  const handleToggleStatus = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChangeStatuses(Array.from(next));
  };

  const handleClear = () => {
    onChangeStatuses([]);
    if (onToggleMeetingHeld) {
      onToggleMeetingHeld(false);
    }
    if (onToggleTransfer) {
      onToggleTransfer(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {hasSelections && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedLabels.length}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedLabels.length > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedLabels.length} selecionados
                  </Badge>
                ) : (
                  selectedLabels.map((label) => (
                    <Badge
                      variant="secondary"
                      key={label}
                      className="rounded-sm px-1 font-normal"
                    >
                      {label}
                    </Badge>
                  ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            {(onToggleMeetingHeld || onToggleTransfer || onToggleDraft) && (
              <>
                <CommandGroup>
                  {onToggleMeetingHeld && (
                    <CommandItem
                      onSelect={() => onToggleMeetingHeld(!meetingHeld)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          meetingHeld
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <span>Reuniões realizadas</span>
                    </CommandItem>
                  )}
                  {onToggleTransfer && (
                    <CommandItem
                      onSelect={() => onToggleTransfer(!transfer)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          transfer
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <span>Transferência</span>
                    </CommandItem>
                  )}
                  {onToggleDraft && (
                    <CommandItem onSelect={() => onToggleDraft(!draft)}>
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          draft
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <span>Somente rascunhos</span>
                    </CommandItem>
                  )}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup>
              {statusOptions.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleToggleStatus(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {hasSelections && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleClear}
                    className="justify-center text-center"
                  >
                    Limpar filtros
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
