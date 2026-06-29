import { formatDisplayPhone } from '@/lib/cdp/normalization'

export type WhatsAppChatKind = 'individual' | 'group' | 'lid' | 'unknown'

export function getChatKind(externalChatId: string | null | undefined): WhatsAppChatKind {
  if (!externalChatId) return 'unknown'
  if (externalChatId.endsWith('@g.us')) return 'group'
  if (externalChatId.endsWith('@lid')) return 'lid'
  if (externalChatId.endsWith('@s.whatsapp.net')) return 'individual'
  return 'unknown'
}

export function getConversationDisplayName(input: {
  contactName: string | null
  contactPhone: string
  externalChatId?: string | null
}): string {
  const kind = getChatKind(input.externalChatId)
  if (input.contactName?.trim()) return input.contactName.trim()
  if (kind === 'group') return 'Grupo'
  if (kind === 'lid') return 'Contato'
  const formatted = formatDisplayPhone(input.contactPhone)
  if (formatted && !formatted.includes('@')) return formatted
  return 'Contato'
}

export function getConversationSubtitle(input: {
  contactPhone: string
  externalChatId?: string | null
}): string | null {
  const kind = getChatKind(input.externalChatId)
  if (kind === 'group') return 'Grupo'
  if (kind === 'lid') return 'Contato vinculado'
  if (kind === 'individual') {
    const formatted = formatDisplayPhone(input.contactPhone)
    return formatted || null
  }
  return null
}
