export interface EmailTemplateRecipient {
  email: string
  name?: string | null
  customFields?: Record<string, unknown> | null
}

/**
 * Built-in variable names recognized by the interpolation engine.
 * Used to display available variables in the template editor.
 */
export const BUILTIN_EMAIL_VARIABLES = [
  { key: "nome", description: "Nome do destinatário" },
  { key: "nome_do_lead", description: "Nome do destinatário (alias)" },
  { key: "name", description: "Nome do destinatário (alias em inglês)" },
  { key: "email", description: "Endereço de e-mail do destinatário" },
] as const

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Replaces {{variable}} tokens in a template string with recipient data.
 *
 * Resolution order:
 *   1. Built-in variables: {{nome}}, {{nome_do_lead}}, {{name}}, {{email}}
 *   2. Custom fields from the contact's CSV columns (case-insensitive key match)
 *   3. Team global variables' default values (case-insensitive key match)
 *
 * Unknown tokens are left as-is.
 */
export function interpolateEmailTemplate(
  template: string,
  recipient: EmailTemplateRecipient,
  globalDefaults?: Record<string, string | null | undefined> | null
): string {
  let result = template

  // Built-in variables
  const name = recipient.name ?? ""
  result = result.replace(/\{\{nome_do_lead\}\}/gi, name)
  result = result.replace(/\{\{nome\}\}/gi, name)
  result = result.replace(/\{\{name\}\}/gi, name)
  result = result.replace(/\{\{email\}\}/gi, recipient.email)

  // Custom fields from CSV columns
  if (recipient.customFields) {
    for (const [key, raw] of Object.entries(recipient.customFields)) {
      const value = raw != null ? String(raw) : ""
      result = result.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "gi"), value)
    }
  }

  // Team global variables (default values) — only fill tokens still present.
  if (globalDefaults) {
    for (const [key, raw] of Object.entries(globalDefaults)) {
      if (raw == null) continue
      result = result.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "gi"), String(raw))
    }
  }

  return result
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Extracts the distinct variable keys referenced as {{key}} in a template string.
 * Used by the editor to evaluate used vs declared variables.
 */
export function extractTemplateVariableKeys(template: string): string[] {
  const keys = new Set<string>()
  for (const match of template.matchAll(TOKEN_RE)) {
    if (match[1]) keys.add(match[1])
  }
  return Array.from(keys)
}
