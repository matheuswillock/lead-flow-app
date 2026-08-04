"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes";
import type { LeadResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { getLeadStatusBadgeClass, getLeadStatusLabel } from "@/lib/lead-status";
import { maskPhone } from "@/lib/masks";
import { maskEmailForUnsubscribe } from "@/lib/email/unsubscribe-token";
import { cn } from "@/lib/utils";
import { API_CLIENT_BASE } from "@/lib/route-map";

interface LeadMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLead: Lead;
  supabaseId: string;
  teamId: string;
  onMerged: () => void | Promise<void>;
}

function formatContact(phone: string | null | undefined, email: string | null | undefined) {
  return {
    phone: phone ? maskPhone(phone.replace(/\D/g, "").slice(-11)) : "—",
    email: email ? maskEmailForUnsubscribe(email) : "—",
  };
}

export function LeadMergeDialog({
  open,
  onOpenChange,
  targetLead,
  supabaseId,
  teamId,
  onMerged,
}: LeadMergeDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LeadResponseDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadResponseDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [merging, setMerging] = useState(false);

  const resetState = useCallback(() => {
    setSearch("");
    setResults([]);
    setSelectedLead(null);
    setConfirmOpen(false);
    setConfirmCode("");
    setMerging(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const runSearch = useCallback(async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams({
        role: "manager",
        teamId,
        search: search.trim(),
        limit: "10",
      });
      const response = await fetch(`${API_CLIENT_BASE}/leads?${params.toString()}`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": teamId,
        },
      });
      const data = await response.json();
      if (!response.ok || !data?.isValid) {
        setResults([]);
        return;
      }

      const rawResult = data.result;
      const leads = (
        Array.isArray(rawResult)
          ? rawResult
          : Array.isArray(rawResult?.leads)
            ? rawResult.leads
            : []
      ) as LeadResponseDTO[];

      setResults(leads.filter((lead) => lead.id !== targetLead.id).slice(0, 10));
    } catch {
      toast.error("Não foi possível buscar leads");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [search, supabaseId, teamId, targetLead.id]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void runSearch();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, runSearch]);

  const targetContact = useMemo(
    () => formatContact(targetLead.phone, targetLead.email),
    [targetLead.email, targetLead.phone]
  );

  const selectedContact = useMemo(
    () =>
      selectedLead
        ? formatContact(selectedLead.phone, selectedLead.email)
        : { phone: "—", email: "—" },
    [selectedLead]
  );

  const canConfirmMerge =
    selectedLead != null && confirmCode.trim() === selectedLead.leadCode;

  const handleMerge = async () => {
    if (!selectedLead || !canConfirmMerge) return;

    setMerging(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${targetLead.id}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": teamId,
        },
        body: JSON.stringify({ sourceLeadId: selectedLead.id }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao mesclar leads");
      }

      toast.success(`Lead ${selectedLead.leadCode} mesclado com sucesso`);
      setConfirmOpen(false);
      onOpenChange(false);
      await onMerged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao mesclar leads");
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mesclar com outro lead</DialogTitle>
            <DialogDescription>
              O lead atual será mantido. O histórico do lead selecionado será preservado neste registro.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Label htmlFor="merge-lead-search">Buscar lead do time</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="merge-lead-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, ID ou telefone"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
              {searching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando...
                </div>
              ) : results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search.trim() ? "Nenhum lead encontrado." : "Digite para buscar um lead."}
                </p>
              ) : (
                results.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLead(lead)}
                    className={cn(
                      "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors",
                      selectedLead?.id === lead.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">{lead.leadCode}</span>
                      {lead.status ? (
                        <Badge
                          variant="outline"
                          className={cn("font-normal", getLeadStatusBadgeClass(lead.status))}
                        >
                          {getLeadStatusLabel(lead.status)}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>

            <Separator />

            <p className="text-sm text-muted-foreground">
              Histórico preservado, campos vazios do lead mantido serão preenchidos e o lead selecionado
              deixará de existir como registro separado.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-md border border-border p-4">
                <p className="text-sm font-medium">Este lead (mantido)</p>
                <p className="text-base font-semibold">{targetLead.name}</p>
                <p className="text-xs text-muted-foreground">{targetLead.leadCode}</p>
                <p className="text-sm text-muted-foreground">Tel.: {targetContact.phone}</p>
                <p className="text-sm text-muted-foreground">E-mail: {targetContact.email}</p>
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-4">
                <p className="text-sm font-medium">Lead selecionado (será mesclado)</p>
                {selectedLead ? (
                  <>
                    <p className="text-base font-semibold">{selectedLead.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedLead.leadCode}</p>
                    <p className="text-sm text-muted-foreground">Tel.: {selectedContact.phone}</p>
                    <p className="text-sm text-muted-foreground">E-mail: {selectedContact.email}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Selecione um lead na busca acima.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!selectedLead}
              onClick={() => setConfirmOpen(true)}
            >
              Mesclar leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mesclagem</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Digite o ID{" "}
              <span className="font-medium text-foreground">{selectedLead?.leadCode}</span> do lead que
              será mesclado para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merge-confirm-code">ID do lead de origem</Label>
            <Input
              id="merge-confirm-code"
              value={confirmCode}
              onChange={(event) => setConfirmCode(event.target.value)}
              placeholder={selectedLead?.leadCode ?? ""}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirmMerge || merging}
              onClick={(event) => {
                event.preventDefault();
                void handleMerge();
              }}
            >
              {merging ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Mesclando...
                </>
              ) : (
                "Confirmar mesclagem"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
