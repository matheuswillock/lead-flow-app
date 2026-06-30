/**
 * Helpers para janela HSM WhatsApp (24h) — v1 usa flag para N8N decidir template.
 */
export function isOutsideWhatsAppWindow(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) {
    return true;
  }
  const windowMs = 24 * 60 * 60 * 1000;
  return Date.now() - lastInboundAt.getTime() > windowMs;
}

export const STUDIO_BOT_HSM_TEMPLATE_AUTH = "bethania_auth_code";
export const STUDIO_BOT_HSM_TEMPLATE_REMINDER = "bethania_meeting_reminder";
