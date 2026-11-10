"use client"

import { MessageCircle } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

/**
 * Logo depois de registrar a entrevista: avisar o cliente agora pelo WhatsApp do usuário, ou deixar
 * para depois (vira tarefa pendente).
 */
export function InterviewNoticeDialog({
  open,
  clientName,
  whatsAppLink,
  onSend,
  onPostpone,
}: {
  open: boolean
  clientName: string
  whatsAppLink: string | null
  onSend: () => void
  onPostpone: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onPostpone()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Avisar {clientName || "o cliente"} agora?</AlertDialogTitle>
          <AlertDialogDescription>
            {whatsAppLink
              ? "O WhatsApp abre no seu celular ou computador com a mensagem pronta. Se deixar para depois, criamos uma tarefa para você."
              : "O lead está sem telefone válido. Cadastre o telefone para avisar pelo WhatsApp; por enquanto, criamos uma tarefa para você."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Fechar (botão, Esc ou fora) cai em onOpenChange → onPostpone, uma única vez. */}
          <AlertDialogCancel>Agora não</AlertDialogCancel>
          {whatsAppLink ? (
            <Button asChild>
              <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" onClick={onSend}>
                <MessageCircle data-icon="inline-start" aria-hidden />
                Abrir WhatsApp
              </a>
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
