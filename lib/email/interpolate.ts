import { DEFAULT_TZ, formatIntimezone, formatLocalDateValue, formatLocalTimeValue, nowInTz } from "@/lib/dates"
import { EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY } from "@/lib/email/unsubscribe-link-embed"

export interface EmailTemplateRecipient {
  email: string
  name?: string | null
  customFields?: Record<string, unknown> | null
}

export type EmailTemplateVariableKind = "variable" | "function"

export type EmailTemplateFunctionOperator =
  | "current_year"
  | "current_month"
  | "current_day"
  | "current_date"
  | "current_time"
  | "current_date_time"
  | "sum"
  | "subtract"
  | "multiply"
  | "divide"
  | "concat"

export interface EmailTemplateFunctionDefinition {
  operator: EmailTemplateFunctionOperator
  arguments?: string[] | null
  separator?: string | null
  timezone?: string | null
}

export interface EmailTemplateVariableDefinition {
  key: string
  kind?: EmailTemplateVariableKind
  type?: "string" | "number"
  fallbackValue?: string | null
  reviewStatus?: "pending" | "reviewed"
  definition?: EmailTemplateFunctionDefinition | null
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
  {
    key: EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY,
    description: "Link de descadastro do destinatário (substituído automaticamente no envio)",
  },
] as const

export const BUILTIN_EMAIL_FUNCTIONS = [
  {
    key: "currentYear",
    description: "Ano atual",
    definition: { operator: "current_year" as const },
  },
  {
    key: "currentMonth",
    description: "Mês atual",
    definition: { operator: "current_month" as const },
  },
  {
    key: "currentDay",
    description: "Dia atual",
    definition: { operator: "current_day" as const },
  },
  {
    key: "currentDate",
    description: "Data atual",
    definition: { operator: "current_date" as const },
  },
  {
    key: "currentTime",
    description: "Horário atual",
    definition: { operator: "current_time" as const },
  },
  {
    key: "currentDateTime",
    description: "Data e horário atual",
    definition: { operator: "current_date_time" as const },
  },
] as const

export const BUILTIN_EMAIL_FUNCTION_KEYS = new Set(
  BUILTIN_EMAIL_FUNCTIONS.map((fn) => fn.key.toLowerCase())
)

function normalizeKey(key: string): string {
  return key.trim().toLowerCase()
}

function normalizeTokenReference(value: string): string {
  const trimmed = value.trim()
  const match = /^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/.exec(trimmed)
  return match?.[1] ?? trimmed
}

function isNumericLiteral(value: string): boolean {
  return /^-?\d+(?:[.,]\d+)?$/.test(value.trim())
}

function parseNumericLiteral(value: string): number | null {
  if (!isNumericLiteral(value)) return null
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumericResult(value: number): string {
  if (!Number.isFinite(value)) return ""
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(4))
  return String(rounded)
}

function resolveTimezone(timezone?: string | null): string {
  if (!timezone?.trim()) return DEFAULT_TZ
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return timezone
  } catch {
    return DEFAULT_TZ
  }
}

function resolveArgumentValue(value: string, resolvedMap: Record<string, string>, asNumber: boolean): string | number | null {
  const token = normalizeTokenReference(value)
  const normalizedToken = normalizeKey(token)
  const resolved = resolvedMap[normalizedToken]

  if (resolved != null && resolved !== "") {
    if (asNumber) {
      const parsedResolved = parseNumericLiteral(resolved)
      if (parsedResolved != null) return parsedResolved
    } else {
      return resolved
    }
  }

  const parsedLiteral = parseNumericLiteral(token)
  if (parsedLiteral != null) return parsedLiteral

  if (asNumber) {
    return null
  }

  return token
}

function resolveBuiltInFunction(
  definition: EmailTemplateFunctionDefinition,
  timezoneInput?: string | null
): string | null {
  const timezone = resolveTimezone(definition.timezone ?? timezoneInput)
  const now = nowInTz(timezone)

  switch (definition.operator) {
    case "current_year":
      return String(now.getFullYear())
    case "current_month":
      return String(now.getMonth() + 1).padStart(2, "0")
    case "current_day":
      return String(now.getDate()).padStart(2, "0")
    case "current_date":
      return formatLocalDateValue(now, timezone)
    case "current_time":
      return formatLocalTimeValue(now, timezone)
    case "current_date_time":
      return formatIntimezone(now, "dd/MM/yyyy HH:mm", timezone)
    default:
      return null
  }
}

function resolveCustomFunction(
  definition: EmailTemplateFunctionDefinition,
  resolvedMap: Record<string, string>
): string | null {
  const args = definition.arguments ?? []

  switch (definition.operator) {
    case "sum": {
      if (args.length === 0) return null
      let total = 0
      for (const arg of args) {
        const resolved = resolveArgumentValue(arg, resolvedMap, true)
        if (typeof resolved !== "number") return null
        total += resolved
      }
      return formatNumericResult(total)
    }
    case "subtract": {
      if (args.length === 0) return null
      const first = resolveArgumentValue(args[0], resolvedMap, true)
      if (typeof first !== "number") return null
      let total = first
      for (const arg of args.slice(1)) {
        const resolved = resolveArgumentValue(arg, resolvedMap, true)
        if (typeof resolved !== "number") return null
        total -= resolved
      }
      return formatNumericResult(total)
    }
    case "multiply": {
      if (args.length === 0) return null
      let total = 1
      for (const arg of args) {
        const resolved = resolveArgumentValue(arg, resolvedMap, true)
        if (typeof resolved !== "number") return null
        total *= resolved
      }
      return formatNumericResult(total)
    }
    case "divide": {
      if (args.length === 0) return null
      const first = resolveArgumentValue(args[0], resolvedMap, true)
      if (typeof first !== "number") return null
      let total = first
      for (const arg of args.slice(1)) {
        const resolved = resolveArgumentValue(arg, resolvedMap, true)
        if (typeof resolved !== "number" || resolved === 0) return null
        total /= resolved
      }
      return formatNumericResult(total)
    }
    case "concat": {
      if (args.length === 0) return null
      const separator = definition.separator ?? ""
      const parts = args
        .map((arg) => resolveArgumentValue(arg, resolvedMap, false))
        .filter((value): value is string | number => value != null)
        .map((value) => String(value))
      return parts.join(separator)
    }
    default:
      return null
  }
}

function buildResolvedValueMap(
  recipient: EmailTemplateRecipient,
  globalDefaults?: Record<string, string | null | undefined> | null,
  definitions?: EmailTemplateVariableDefinition[] | null,
  authoritativeDefaults?: Record<string, string | null | undefined> | null,
): Record<string, string> {
  const values: Record<string, string> = {}

  const name = recipient.name ?? ""
  values.nome = name
  values.nome_do_lead = name
  values.name = name
  values.email = recipient.email

  if (recipient.customFields) {
    for (const [key, raw] of Object.entries(recipient.customFields)) {
      const value = raw != null ? String(raw) : ""
      values[normalizeKey(key)] = value
    }
  }

  if (globalDefaults) {
    for (const [key, raw] of Object.entries(globalDefaults)) {
      if (raw == null) continue
      const value = String(raw).trim()
      if (!value) continue
      const normalizedKey = normalizeKey(key)
      if (values[normalizedKey] == null || values[normalizedKey] === "") {
        values[normalizedKey] = value
      }
    }
  }

  if (definitions) {
    for (const definition of definitions) {
      if (!definition?.key?.trim()) continue
      if (definition.kind === "function") continue
      const normalizedKey = normalizeKey(definition.key)
      if ((values[normalizedKey] == null || values[normalizedKey] === "") && definition.fallbackValue?.trim()) {
        values[normalizedKey] = definition.fallbackValue.trim()
      }
    }
  }

  for (const builtinFunction of BUILTIN_EMAIL_FUNCTIONS) {
    const normalizedKey = normalizeKey(builtinFunction.key)
    if (values[normalizedKey] == null || values[normalizedKey] === "") {
      const resolved = resolveBuiltInFunction(builtinFunction.definition)
      if (resolved != null) {
        values[normalizedKey] = resolved
      }
    }
  }

  if (definitions && definitions.length > 0) {
    const unresolvedFunctions = definitions.filter((definition) => definition?.kind === "function" && definition.definition)

    for (let round = 0; round < 6 && unresolvedFunctions.length > 0; round++) {
      let changed = false

      for (const definition of unresolvedFunctions) {
        if (!definition.definition) continue
        const normalizedKey = normalizeKey(definition.key)
        if (values[normalizedKey] != null && values[normalizedKey] !== "") continue

        const resolved =
          definition.definition.operator.startsWith("current_")
            ? resolveBuiltInFunction(definition.definition, definition.definition.timezone)
            : resolveCustomFunction(definition.definition, values)

        if (resolved != null && resolved !== "") {
          values[normalizedKey] = resolved
          changed = true
        }
      }

      if (!changed) break
    }
  }

  if (authoritativeDefaults) {
    for (const [key, raw] of Object.entries(authoritativeDefaults)) {
      if (raw == null) continue
      const value = String(raw).trim()
      if (!value) continue
      values[normalizeKey(key)] = value
    }
  }

  return values
}

/**
 * Replaces {{variable}} tokens in a template string with recipient data.
 *
 * Resolution order:
 *   1. Built-in variables: {{nome}}, {{nome_do_lead}}, {{name}}, {{email}}
 *   2. Custom fields from the contact's CSV columns (case-insensitive key match)
 *   3. Team global variables' default values (case-insensitive key match)
 *   4. Template variable fallbacks (when provided)
 *   5. Built-in functions like {{currentYear}} and custom function definitions
 *   6. Authoritative defaults (always win, e.g. reserved dispatch tokens)
 *
 * Unknown tokens are left as-is.
 */
export function interpolateEmailTemplate(
  template: string,
  recipient: EmailTemplateRecipient,
  globalDefaults?: Record<string, string | null | undefined> | null,
  definitions?: EmailTemplateVariableDefinition[] | null,
  authoritativeDefaults?: Record<string, string | null | undefined> | null,
): string {
  const values = buildResolvedValueMap(
    recipient,
    globalDefaults,
    definitions,
    authoritativeDefaults,
  )
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, rawKey: string) => {
    const resolved = values[normalizeKey(rawKey)]
    return resolved != null ? resolved : match
  })
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

export function getBuiltinEmailFunctionDefinition(
  key: string
): EmailTemplateFunctionDefinition | null {
  const builtin = BUILTIN_EMAIL_FUNCTIONS.find((fn) => normalizeKey(fn.key) === normalizeKey(key))
  return builtin ? { ...builtin.definition } : null
}

const BUILTIN_RECIPIENT_KEYS = new Set([
  "nome",
  "nome_do_lead",
  "name",
  "email",
  EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY,
])

export function applyMasterTimezoneToTemplateVariables(
  definitions: EmailTemplateVariableDefinition[],
  timezone: string
): EmailTemplateVariableDefinition[] {
  return definitions.map((definition) => {
    if (definition.kind !== "function" || !definition.definition) return definition
    if (!definition.definition.operator.startsWith("current_")) return definition
    if (definition.definition.timezone?.trim()) return definition
    return {
      ...definition,
      definition: {
        ...definition.definition,
        timezone,
      },
    }
  })
}

export function findUnresolvedEmailTemplateTokens(
  subject: string,
  html: string,
  recipient: EmailTemplateRecipient,
  globalDefaults?: Record<string, string | null | undefined> | null,
  definitions?: EmailTemplateVariableDefinition[] | null
): string[] {
  const renderedSubject = interpolateEmailTemplate(subject, recipient, globalDefaults, definitions)
  const renderedHtml = interpolateEmailTemplate(html, recipient, globalDefaults, definitions)
  return extractTemplateVariableKeys(`${renderedSubject}\n${renderedHtml}`).filter(
    (token) => !BUILTIN_RECIPIENT_KEYS.has(token.toLowerCase())
  )
}
