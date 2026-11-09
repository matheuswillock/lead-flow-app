"use client";

import type { ReactNode } from "react";
import { ClipboardList, Clock, LoaderCircle, Mail, Sparkles, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type SimpleAction = { disabled?: boolean; busy?: boolean; onClick: () => void };

/**
 * Ações do domínio à vista (antes no menu "⋯"): verificar, copiar instruções do DNS, copiar como
 * prompt de IA, enviar por e-mail e remover (com confirmação).
 */
export function DomainActionsBar({
  verify,
  verifyLabel = "Verificar agora",
  copyInstructions,
  copyPrompt,
  sendByEmail,
  remove,
}: {
  verify?: SimpleAction
  verifyLabel?: string
  copyInstructions: SimpleAction
  copyPrompt: SimpleAction
  sendByEmail?: SimpleAction
  remove: {
    label: string
    title: string
    description: ReactNode
    confirmLabel: string
    disabled?: boolean
    onConfirm: () => void
  }
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {verify ? (
        <Button type="button" variant="outline" size="sm" className="max-lg:min-h-11" disabled={verify.disabled} onClick={verify.onClick}>
          {verify.busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Clock data-icon="inline-start" />}
          {verifyLabel}
        </Button>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="max-lg:min-h-11" disabled={copyInstructions.disabled} onClick={copyInstructions.onClick}>
        <ClipboardList data-icon="inline-start" />
        Copiar instruções
      </Button>
      <Button type="button" variant="outline" size="sm" className="max-lg:min-h-11" disabled={copyPrompt.disabled} onClick={copyPrompt.onClick}>
        <Sparkles data-icon="inline-start" />
        Copiar como prompt de IA
      </Button>
      {sendByEmail ? (
        <Button type="button" variant="outline" size="sm" className="max-lg:min-h-11" disabled={sendByEmail.disabled} onClick={sendByEmail.onClick}>
          <Mail data-icon="inline-start" />
          Enviar por e-mail
        </Button>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive max-lg:min-h-11 sm:ml-auto"
            disabled={remove.disabled}
          >
            <Trash2 data-icon="inline-start" />
            {remove.label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{remove.title}</AlertDialogTitle>
            <AlertDialogDescription>{remove.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove.onConfirm}>{remove.confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
