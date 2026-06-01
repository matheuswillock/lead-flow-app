"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ReferralLeadOption = {
  id: string;
  name: string;
  phone: string | null;
};

export interface ReferralValue {
  referrerLeadId: string;
  referrerName: string;
  referrerPhone: string;
}

interface ReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  initialValue?: ReferralValue;
  onConfirm: (value: ReferralValue) => void;
}

export function ReferralDialog({ open, onOpenChange, teamId, initialValue, onConfirm }: ReferralDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const [mode, setMode] = useState<"existing" | "manual">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReferralLeadOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ReferralLeadOption | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialValue?.referrerLeadId ? "existing" : "manual");
    setSelectedId(initialValue?.referrerLeadId || "");
    setManualName(initialValue?.referrerName || "");
    setManualPhone(initialValue?.referrerPhone || "");
    setSelectedSnapshot(
      initialValue?.referrerLeadId
        ? {
            id: initialValue.referrerLeadId,
            name: initialValue.referrerName,
            phone: initialValue.referrerPhone || null,
          }
        : null
    );
    setSearchOpen(false);
    setQuery("");
    setResults([]);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open || mode !== "existing" || !supabaseId) return;
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/leads/search?q=${encodeURIComponent(normalizedQuery)}`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          ...(teamId ? { "x-team-id": teamId } : {}),
        },
      })
        .then((res) => res.json())
        .then((result) => {
          if (!mounted) return;
          const list = Array.isArray(result?.result) ? (result.result as ReferralLeadOption[]) : [];
          setResults(list);
        })
        .catch(() => {
          if (!mounted) return;
          setResults([]);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [open, mode, query, supabaseId, teamId]);

  const selectedLead = results.find((item) => item.id === selectedId) ?? selectedSnapshot;

  const handleConfirm = () => {
    if (mode === "existing" && selectedLead) {
      onConfirm({
        referrerLeadId: selectedLead.id,
        referrerName: selectedLead.name,
        referrerPhone: selectedLead.phone || "",
      });
      onOpenChange(false);
      return;
    }

    onConfirm({
      referrerLeadId: "",
      referrerName: manualName.trim(),
      referrerPhone: manualPhone.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dados da indicação</DialogTitle>
          <DialogDescription>Escolha entre buscar um lead existente ou informar manualmente.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as "existing" | "manual")} className="grid gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="existing" id="referral-existing" />
              <Label htmlFor="referral-existing">Buscar lead existente</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="referral-manual" />
              <Label htmlFor="referral-manual">Informar manualmente</Label>
            </div>
          </RadioGroup>

          {mode === "existing" ? (
            <div className="grid gap-2">
              <Label>Buscar por nome ou telefone</Label>
              {selectedLead && (
                <div className="text-xs text-muted-foreground">
                  Selecionado: <span className="text-foreground">{selectedLead.name} • {selectedLead.phone || "Sem telefone"}</span>
                </div>
              )}
              <div
                ref={searchContainerRef}
                onFocusCapture={() => setSearchOpen(true)}
                onBlurCapture={(event) => {
                  const nextFocused = event.relatedTarget as Node | null;
                  if (!nextFocused || !searchContainerRef.current?.contains(nextFocused)) {
                    setSearchOpen(false);
                  }
                }}
              >
                <Command shouldFilter={false} className="rounded-md border border-input bg-transparent">
                <CommandInput
                  placeholder="Buscar por nome ou telefone..."
                  value={query}
                  onValueChange={setQuery}
                />
                  {searchOpen && (
                    <CommandList className="max-h-56 scroll-hover-y">
                  {loading && <div className="p-3 text-sm text-muted-foreground">Buscando...</div>}
                  {!loading && <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>}
                  <CommandGroup>
                    {results.map((lead) => (
                      <CommandItem
                        key={lead.id}
                        value={`${lead.id}-${lead.name}-${lead.phone ?? ""}`}
                        onSelect={() => {
                          setSelectedId(lead.id);
                          setSelectedSnapshot(lead);
                          setSearchOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2", selectedId === lead.id ? "opacity-100" : "opacity-0")} />
                        <span>{lead.name} • {lead.phone || "Sem telefone"}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                    </CommandList>
                  )}
                </Command>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="referrer-name">Nome do indicador</Label>
                <Input id="referrer-name" value={manualName} onChange={(event) => setManualName(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="referrer-phone">Telefone do indicador</Label>
                <Input id="referrer-phone" value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={mode === "existing" ? !selectedLead : !manualName.trim()}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
