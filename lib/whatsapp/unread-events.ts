export const WHATSAPP_UNREAD_CHANGED_EVENT = 'whatsapp-unread-changed'
export const WHATSAPP_CONFIG_CHANGED_EVENT = 'whatsapp-config-changed'

export function dispatchWhatsAppUnreadChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WHATSAPP_UNREAD_CHANGED_EVENT))
}

export function dispatchWhatsAppConfigChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WHATSAPP_CONFIG_CHANGED_EVENT))
}
