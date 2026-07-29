/**
 * WhatsApp operational metrics without PII (SPEC §15 / T4.5).
 * Emit structured logs suitable for aggregation (Sentry/log drains).
 */

export type WhatsAppSloMetricName =
  | "whatsapp_webhook_to_ui_ms"
  | "whatsapp_outbox_failure"
  | "whatsapp_media_ingest_failure"
  | "whatsapp_send_unknown"
  | "whatsapp_action_capability_unavailable"

export function emitWhatsAppSloMetric(
  name: WhatsAppSloMetricName,
  fields: Record<string, string | number | boolean | null | undefined> = {}
): void {
  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    // Never log phone, text, jid, tokens, or URLs.
    if (/phone|jid|text|token|url|payload|email/i.test(key)) continue
    safe[key] = value
  }
  console.info("[whatsapp.slo]", { metric: name, ...safe })
}
