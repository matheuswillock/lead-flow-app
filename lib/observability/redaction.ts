/**
 * Padrões de redaction compartilhados entre o logger e o Sentry (`beforeSend`). Código puro,
 * seguro para edge e browser. Cobre prefixos de chave de provider de pagamento e segredos
 * trafegando em query string de URL (ex.: `?webhookSecret=...` do webhook do Abacate).
 */

export const REDACTED_PLACEHOLDER = "[redacted]"

export const SECRET_QUERY_PARAM_PATTERN =
  /([?&](?:webhook[_-]?secret|webhook[_-]?token|secret|token|api[_-]?key|access[_-]?token|signature)=)[^&#\s"']*/gi

export const PROVIDER_SECRET_VALUE_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Abacate Pay: abc_dev_..., abc_prod_...
  { pattern: /\babc_(?:dev|prod|live|test)_[A-Za-z0-9_-]+/gi, replacement: "abc_[redacted]" },
  // Asaas: aact_... (com ou sem o "$" do header)
  { pattern: /\$?aact_[A-Za-z0-9_.-]+/g, replacement: "aact_[redacted]" },
  { pattern: SECRET_QUERY_PARAM_PATTERN, replacement: `$1${REDACTED_PLACEHOLDER}` },
]

export function redactProviderSecrets(value: string): string {
  return PROVIDER_SECRET_VALUE_PATTERNS.reduce((result, { pattern, replacement }) => {
    pattern.lastIndex = 0
    return result.replace(pattern, replacement)
  }, value)
}

const WEBHOOK_PATH_PATTERN = /\/webhooks?\//i

/** Em URL de webhook a query inteira some (carrega o segredo); nas demais, só os parâmetros secretos. */
export function scrubUrl(url: string): string {
  const queryIndex = url.indexOf("?")
  if (queryIndex === -1) return redactProviderSecrets(url)
  const path = url.slice(0, queryIndex)
  if (WEBHOOK_PATH_PATTERN.test(path)) return redactProviderSecrets(path)
  return redactProviderSecrets(url)
}
