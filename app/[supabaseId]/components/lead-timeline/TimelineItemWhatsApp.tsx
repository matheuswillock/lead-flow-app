import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { renderActivityBodyWithMentions } from "./TimelineActivityReactions"

type WhatsAppPayload = {
  conversationId?: string
  milestone?: string
  preview?: string
}

type TimelineItemWhatsAppProps = {
  body?: string | null
  payload?: unknown
  supabaseId: string
  mentionRegex: RegExp | null
}

export function TimelineItemWhatsApp({
  body,
  payload,
  supabaseId,
  mentionRegex,
}: TimelineItemWhatsAppProps) {
  const whatsappPayload =
    payload && typeof payload === "object" ? (payload as WhatsAppPayload) : null
  const conversationId = whatsappPayload?.conversationId
  const preview = whatsappPayload?.preview

  return (
    <div className="col-span-2 flex flex-col gap-2">
      {body ? (
        <p className="text-sm font-medium text-foreground">
          {renderActivityBodyWithMentions(body, mentionRegex)}
        </p>
      ) : null}
      {preview ? <p className="text-sm italic text-muted-foreground">{preview}</p> : null}
      {conversationId ? (
        <Link
          href={`/${supabaseId}/whatsapp?conversationId=${encodeURIComponent(conversationId)}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Abrir conversa
        </Link>
      ) : null}
    </div>
  )
}

export function whatsappTimelineIcon() {
  return <MessageCircle className="size-4 text-primary" />
}
