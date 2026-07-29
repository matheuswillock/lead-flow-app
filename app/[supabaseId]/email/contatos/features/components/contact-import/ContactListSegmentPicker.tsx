"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContatosService, type RadarSegmentOption } from "../../services/ContatosService";

const service = new ContatosService();

interface ContactListSegmentPickerProps {
  listId: string;
  supabaseId: string;
  selectedSegmentId: string | null;
  selectedSegmentName: string | null;
  onSelect: (segmentId: string, segmentName: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function ContactListSegmentPicker({
  listId,
  supabaseId,
  selectedSegmentId,
  selectedSegmentName,
  onSelect,
  onClear,
  disabled = false,
}: ContactListSegmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [segments, setSegments] = useState<RadarSegmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    service
      .listRadarSegments(supabaseId)
      .then(setSegments)
      .catch(() => setSegments([]))
      .finally(() => setLoading(false));
  }, [open, supabaseId]);

  const trimmed = search.trim();
  const matchesExisting = segments.some(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreate = trimmed.length > 0 && !matchesExisting;

  const handleCreate = async () => {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const created = await service.createRadarSegmentForList(supabaseId, trimmed, listId);
      setSegments((prev) => [created, ...prev]);
      onSelect(created.id, created.name);
      setOpen(false);
      setSearch("");
    } catch {
      // error handled by parent
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-48 justify-between text-sm"
            disabled={disabled}
          >
            {selectedSegmentName ? (
              <span className="truncate">{selectedSegmentName}</span>
            ) : (
              <span className="text-muted-foreground">Selecionar segmento...</span>
            )}
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar ou criar segmento..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {showCreate && (
                    <>
                      <CommandGroup heading="Criar novo">
                        <CommandItem
                          onSelect={handleCreate}
                          disabled={creating}
                          className="gap-2"
                        >
                          {creating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Plus className="size-4" />
                          )}
                          <span>Criar &quot;{trimmed}&quot;</span>
                        </CommandItem>
                      </CommandGroup>
                      <CommandSeparator />
                    </>
                  )}
                  <CommandGroup heading="Segmentos existentes">
                    {segments.length === 0 && !showCreate ? (
                      <CommandEmpty>Nenhum segmento encontrado</CommandEmpty>
                    ) : (
                      segments.map((segment) => (
                        <CommandItem
                          key={segment.id}
                          value={segment.name}
                          onSelect={() => {
                            onSelect(segment.id, segment.name);
                            setOpen(false);
                            setSearch("");
                          }}
                          className="gap-2"
                        >
                          <Check
                            className={cn(
                              "size-4 shrink-0",
                              selectedSegmentId === segment.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {segment.name}
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedSegmentId && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onClear}
          disabled={disabled}
        >
          <X className="size-4" />
          <span className="sr-only">Remover segmento</span>
        </Button>
      )}

      {selectedSegmentName && (
        <Badge variant="secondary" className="hidden sm:inline-flex">
          Radar
        </Badge>
      )}
    </div>
  );
}
