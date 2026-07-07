"use client";

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
import { Badge } from "@/components/ui/badge";
import { Loader2, CopyX } from "lucide-react";
import type { LeadDuplicateCandidateDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { getLeadStatusBadgeClass, getLeadStatusLabel } from "@/lib/lead-status";
import { maskPhone } from "@/lib/masks";
import { maskEmailForUnsubscribe } from "@/lib/email/unsubscribe-token";
import { cn } from "@/lib/utils";

interface LeadDuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: LeadDuplicateCandidateDTO[];
  isConfirming: boolean;
  onConfirm: () => void;
}

function maskContactPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return maskPhone(digits);
  const visible = digits.slice(-4);
  return `•••• ${visible}`;
}

export function LeadDuplicateWarningDialog({
  open,
  onOpenChange,
  candidates,
  isConfirming,
  onConfirm,
}: LeadDuplicateWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CopyX className="text-semantic-warning" data-icon="inline-start" />
            Possível duplicado
          </AlertDialogTitle>
          <AlertDialogDescription>
            Encontramos lead(s) neste time com o mesmo telefone ou e-mail. Revise antes de continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{candidate.name}</span>
                <span className="text-xs text-muted-foreground">{candidate.leadCode}</span>
                {candidate.status ? (
                  <Badge
                    variant="outline"
                    className={cn("font-normal", getLeadStatusBadgeClass(candidate.status))}
                  >
                    {getLeadStatusLabel(candidate.status)}
                  </Badge>
                ) : (
                  <Badge variant="outline">Rascunho</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Tel.: {maskContactPhone(candidate.phone)}</span>
                <span>
                  E-mail: {candidate.email ? maskEmailForUnsubscribe(candidate.email) : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isConfirming}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isConfirming ? (
              <>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Criando...
              </>
            ) : (
              "Criar mesmo assim"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
