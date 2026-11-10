"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { API_CLIENT_BASE } from "@/lib/route-map";

/**
 * "Excluir lead" dentro do lead aberto, com confirmação. Antes ficava escondido no menu "⋯" da
 * linha do funil; agora quem abre o lead encontra todas as ações nele.
 */
export function LeadDeleteAction({ leadId, leadName, supabaseId, teamId, onDeleted }: {
  leadId: string
  leadName: string
  supabaseId: string | null
  teamId: string | null
  onDeleted: () => Promise<void> | void
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${leadId}`, {
        method: "DELETE",
        headers: {
          ...(supabaseId ? { "x-supabase-user-id": supabaseId } : {}),
          ...(teamId ? { "x-team-id": teamId } : {}),
        },
      });
      if (!response.ok) throw new Error("Erro ao excluir lead");
      toast.success("Lead excluído.");
      setOpen(false);
      await onDeleted();
    } catch (error) {
      console.error("[LeadDeleteAction] Erro ao excluir lead:", error);
      toast.error("Não foi possível excluir o lead. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive max-lg:min-h-11"
        onClick={() => setOpen(true)}
      >
        <Trash2 data-icon="inline-start" aria-hidden />
        Excluir
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => { if (!isDeleting) setOpen(next); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este lead?</AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {leadName} sai do funil junto com o histórico. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="max-lg:min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 max-lg:min-h-11"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {isDeleting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Excluir lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
