/**
 * Escape de HTML e sanitização de `href` para templates de e-mail.
 *
 * SPEC 13 (Agenda na Criação de Lead), DA8 — V4: qualquer dado vindo de fora
 * (nome do lead, telefone, título e notas da reunião, nome do closer, link)
 * precisa passar por `escapeHtml`/`escapeHtmlAttribute` antes de entrar no
 * HTML do e-mail. `href` só aceita `https:` — qualquer outro esquema
 * (`javascript:`, `data:`, `http:`, etc.) é descartado por `sanitizeEmailHref`.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
}

/** Escapa `&`, `<`, `>`, `"` e `'` para uso seguro em texto ou atributo HTML. */
export function escapeHtml(value?: string | null): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char)
}

/** Alias semântico de `escapeHtml` para uso em valores de atributo (`href`, `title`, …). */
export function escapeHtmlAttribute(value?: string | null): string {
  return escapeHtml(value)
}

/** `true` só quando `value` é uma URL absoluta com esquema `https:`. */
export function isSafeHttpsUrl(value?: string | null): boolean {
  const trimmed = value?.trim()
  if (!trimmed) return false
  try {
    return new URL(trimmed).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Devolve um valor pronto para `href="…"` (já escapado) quando `value` é uma
 * URL `https:` válida, ou `null` quando não é — nunca deixa `javascript:`,
 * `data:` ou outro esquema virar link clicável.
 */
export function sanitizeEmailHref(value?: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed || !isSafeHttpsUrl(trimmed)) return null
  return escapeHtmlAttribute(trimmed)
}
