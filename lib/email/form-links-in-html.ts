/**
 * Fonte única do reconhecimento de links `/forms/{uuid}` dentro de HTML de
 * e-mail — compartilhada entre a injeção de `cs_el`
 * (`append-email-log-to-form-urls`) e a troca de host para o domínio de
 * formulários do time (`rewrite-form-urls-to-team-domain`).
 */

export const FORM_PUBLIC_ID_PATTERN_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

/**
 * Regex nova a cada chamada: instância com flag `g` guarda `lastIndex`, e um
 * singleton compartilhado entre módulos vira estado global acidental.
 */
export function createFormHrefPattern(): RegExp {
  return new RegExp(
    `(href\\s*=\\s*)(["'])([^"']*?\\/forms\\/${FORM_PUBLIC_ID_PATTERN_SOURCE}[^"']*)\\2`,
    "gi",
  )
}

/** publicIds únicos (lowercase) presentes em hrefs `/forms/{uuid}` do HTML. */
export function extractFormPublicIdsFromHtml(html: string): string[] {
  if (!html.includes("/forms/")) return []

  const idPattern = new RegExp(`\\/forms\\/(${FORM_PUBLIC_ID_PATTERN_SOURCE})`, "gi")
  const ids = new Set<string>()
  for (const match of html.matchAll(idPattern)) {
    ids.add(match[1].toLowerCase())
  }
  return [...ids]
}

/** publicId do formulário dentro de uma URL (absoluta ou relativa), se houver. */
export function extractFormPublicIdFromUrl(rawUrl: string): string | null {
  const match = new RegExp(`\\/forms\\/(${FORM_PUBLIC_ID_PATTERN_SOURCE})`, "i").exec(rawUrl)
  return match ? match[1].toLowerCase() : null
}
