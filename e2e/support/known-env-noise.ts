/**
 * Ruído de ambiente sem relação com a página testada. Realtime fica desligado no Postgres "db-only"
 * (`/api/v1/realtime/auth-token` 401), o script do Vercel Analytics não existe fora de um deploy Vercel
 * (`/_vercel/insights` 404) e o tunnelRoute do Sentry (`/monitoring`, só em build de produção) devolve 401
 * com o DSN placeholder do `.env.test`. Qualquer outra resposta >= 400 continua reprovando o teste.
 */
const KNOWN_NOISE_URL_PATTERNS = ["realtime/auth-token", "_vercel/insights", "/monitoring?"];

export function isKnownNoiseUrl(url: string): boolean {
  return KNOWN_NOISE_URL_PATTERNS.some((pattern) => url.includes(pattern));
}

/** Eco genérico de um recurso que falhou: a falha em si é conferida pelo status da resposta. */
export function isGenericResourceLoadMessage(message: string): boolean {
  return message.startsWith("Failed to load resource:") || message.startsWith("Refused to execute script");
}
