export const WHATSAPP_UNREAD_CHANGED_EVENT = 'whatsapp-unread-changed'

export function dispatchWhatsAppUnreadChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WHATSAPP_UNREAD_CHANGED_EVENT))
}
