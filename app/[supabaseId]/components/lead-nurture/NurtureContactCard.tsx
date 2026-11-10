"use client"

import { BadgeCheck, Lightbulb, MessageCircle, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NurtureContact } from "./meetingNurtureService"

/** Um contato da nutrição: quando, o objetivo, a dica e a mensagem sugerida pronta para o WhatsApp. */
export function NurtureContactCard({
  contact,
  dueLabel,
  message,
  whatsAppLink,
  canEdit,
  onRemove,
}: {
  contact: NurtureContact
  dueLabel: string
  message: string
  whatsAppLink: string | null
  canEdit: boolean
  onRemove: () => void
}) {
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border border-border/60 p-3", contact.done && "bg-muted/40")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-medium">{contact.title}</p>
          <p className="text-xs text-muted-foreground first-letter:uppercase">
            {dueLabel} · {contact.whenLabel}
          </p>
        </div>
        {contact.done ? (
          <Badge variant="outline" className="gap-1 border-semantic-success/30 text-semantic-success">
            <BadgeCheck className="size-3" aria-hidden />
            Tarefa criada
          </Badge>
        ) : (
          <Badge variant="outline">Agendado</Badge>
        )}
      </div>

      <p className="flex gap-1.5 text-xs text-muted-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-semantic-warning" aria-hidden />
        <span>{contact.tip}</span>
      </p>

      <blockquote className="whitespace-pre-line rounded-md bg-muted/60 px-3 py-2 text-xs text-foreground [overflow-wrap:anywhere]">
        {message}
      </blockquote>

      <div className="flex flex-wrap items-center gap-2">
        {whatsAppLink ? (
          <Button asChild size="sm" variant="outline" className="max-lg:min-h-11">
            <a href={whatsAppLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle data-icon="inline-start" aria-hidden />
              Enviar no WhatsApp
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Cadastre o telefone do lead para enviar pelo WhatsApp.</p>
        )}
        {contact.isCustom && !contact.done && canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive max-lg:min-h-11"
            onClick={onRemove}
          >
            <Trash2 data-icon="inline-start" aria-hidden />
            Remover
          </Button>
        ) : null}
      </div>
    </li>
  )
}
