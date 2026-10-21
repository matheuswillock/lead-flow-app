/**
 * Padrões de redaction compartilhados entre o logger e o Sentry (`beforeSend`). Código puro,
 * seguro para edge e browser. Cobre prefixos de chave de provider de pagamento e segredos
 * trafegando em query string de URL (ex.: `?webhookSecret=...` do webhook do Abacate).
 */

export const REDACTED_PLACEHOLDER = "[redacted]"

const SEP = "(?:[_-]|%5f|%2d)?"
const SECRET_PARAM_NAMES = [
  `webhook${SEP}secret`,
  `webhook${SEP}token`,
  "secret",
  "token",
  `api${SEP}key`,
  `access${SEP}token`,
  "signature",
].join("|")

/** Começo da string, `?`, `&`, `;` ou espaço antes do nome; nome em qualquer caixa e com %-encoding. */
export const SECRET_QUERY_PARAM_PATTERN = new RegExp(
  `((?:^|[?&;\\s])(?:${SECRET_PARAM_NAMES})(?:=|%3d))[^&;#\\s"']*`,
  "gi",
)

/** Chaves de objeto cujo valor é segredo (usado na limpeza recursiva de eventos). */
export const SECRET_KEY_NAME_PATTERN =
  /secret|token|api[_-]?key|password|passwd|authorization|cookie|credential|signature/i

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

export const WEBHOOK_PATH_PATTERN = /\/webhooks?(?:\/|$)/i

/** Em URL de webhook a query inteira some (carrega o segredo); nas demais, só os parâmetros secretos. */
export function scrubUrl(url: string): string {
  const queryIndex = url.indexOf("?")
  if (queryIndex === -1) return redactProviderSecrets(url)
  const path = url.slice(0, queryIndex)
  if (isWebhookPath(path)) return redactProviderSecrets(path)
  return redactProviderSecrets(url)
}

/** A requisição é de webhook SOMENTE pelo caminho da URL (nunca por "a URL mudou"). */
export function isWebhookPath(url: string): boolean {
  const withoutQuery = url.split(/[?#]/, 1)[0] ?? ""
  return WEBHOOK_PATH_PATTERN.test(withoutQuery)
}
