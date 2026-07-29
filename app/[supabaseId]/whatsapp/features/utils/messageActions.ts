export type MessageActionKind =
  | "REPLY"
  | "COPY"
  | "REACT"
  | "FORWARD"
  | "PIN"
  | "UNPIN"
  | "FAVORITE"
  | "UNFAVORITE"
  | "DELETE_FOR_ME"
  | "DELETE_FOR_EVERYONE"

export type MessageActionCapability = "LOCAL" | "SUPPORTED" | "UNAVAILABLE"

export interface MessageActionCapabilities {
  reply: boolean
  forward: boolean
  react: boolean
  deleteForEveryone: boolean
}

export interface MessageActionDefinition {
  kind: MessageActionKind
  label: string
  capability: MessageActionCapability
  enabled: boolean
  group: "primary" | "react" | "organize" | "danger"
}

export interface MessageActionContext {
  isOutbound: boolean
  hasTextOrCaption: boolean
  isDeletedForEveryone: boolean
  isHiddenForMe: boolean
  isPinned: boolean
  isFavorite: boolean
  caps: MessageActionCapabilities
}

const DEFAULT_CAPS: MessageActionCapabilities = {
  reply: true,
  forward: true,
  react: false,
  deleteForEveryone: false,
}

export function getMessageActions(
  ctx: MessageActionContext
): MessageActionDefinition[] {
  const caps = ctx.caps ?? DEFAULT_CAPS
  if (ctx.isDeletedForEveryone || ctx.isHiddenForMe) {
    return []
  }

  const items: MessageActionDefinition[] = [
    {
      kind: "REPLY",
      label: "Responder",
      capability: caps.reply ? "SUPPORTED" : "UNAVAILABLE",
      enabled: caps.reply,
      group: "primary",
    },
    {
      kind: "COPY",
      label: "Copiar",
      capability: "LOCAL",
      enabled: ctx.hasTextOrCaption,
      group: "primary",
    },
    {
      kind: "REACT",
      label: "Reagir",
      capability: caps.react ? "SUPPORTED" : "UNAVAILABLE",
      enabled: caps.react,
      group: "react",
    },
    {
      kind: "FORWARD",
      label: "Encaminhar",
      capability: caps.forward ? "SUPPORTED" : "UNAVAILABLE",
      enabled: caps.forward,
      group: "primary",
    },
    {
      kind: ctx.isPinned ? "UNPIN" : "PIN",
      label: ctx.isPinned ? "Desafixar" : "Fixar",
      capability: "LOCAL",
      enabled: true,
      group: "organize",
    },
    {
      kind: ctx.isFavorite ? "UNFAVORITE" : "FAVORITE",
      label: ctx.isFavorite ? "Remover dos favoritos" : "Favoritar",
      capability: "LOCAL",
      enabled: true,
      group: "organize",
    },
    {
      kind: "DELETE_FOR_ME",
      label: "Apagar para mim",
      capability: "LOCAL",
      enabled: true,
      group: "danger",
    },
    {
      kind: "DELETE_FOR_EVERYONE",
      label: "Apagar para todos",
      capability: caps.deleteForEveryone ? "SUPPORTED" : "UNAVAILABLE",
      enabled: caps.deleteForEveryone && ctx.isOutbound,
      group: "danger",
    },
  ]

  return items.filter((item) => item.enabled || item.capability === "UNAVAILABLE")
}

export function formatMessageDayLabel(date: Date, now = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const messageDay = startOfDay(date).getTime()
  const today = startOfDay(now).getTime()
  const yesterday = today - 24 * 60 * 60 * 1000

  if (messageDay === today) return "Hoje"
  if (messageDay === yesterday) return "Ontem"

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: messageDay < today - 180 * 24 * 60 * 60 * 1000 ? "numeric" : undefined,
  }).format(date)
}

export function isSameMessageDay(a: Date | string | null | undefined, b: Date | string | null | undefined): boolean {
  if (!a || !b) return false
  const da = typeof a === "string" ? new Date(a) : a
  const db = typeof b === "string" ? new Date(b) : b
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}
