import { DISPOSABLE_EMAIL_DOMAINS } from "./disposable-email-domains.data"

/**
 * Descartável = provedor de e-mail temporário (10minutemail, mailinator…).
 * Endereço assim nunca representa um lead real: ou expira em minutos (vira
 * bounce) ou é caixa de teste. O gate de importação rejeita na entrada — o
 * motor de supressão só aprenderia DEPOIS do primeiro bounce, e o estrago de
 * reputação já teria acontecido (incidente de 01–15/09: ~10,6 mil bounces de
 * listas importadas sujas).
 */
const DISPOSABLE_DOMAIN_SET: ReadonlySet<string> = new Set(DISPOSABLE_EMAIL_DOMAINS)

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.+$/, "")
}

/**
 * Cobre também subdomínios: `algo.mailinator.com` é descartável porque
 * `mailinator.com` está na lista. O laço para no sufixo de 2 rótulos — TLD
 * sozinho nunca é consultado.
 */
export function isDisposableEmailDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  if (!normalized || !normalized.includes(".")) return false

  const labels = normalized.split(".")
  for (let start = 0; start <= labels.length - 2; start += 1) {
    if (DISPOSABLE_DOMAIN_SET.has(labels.slice(start).join("."))) {
      return true
    }
  }
  return false
}

/** Tamanho da lista embarcada — exposto para teste e telemetria. */
export function disposableEmailDomainCount(): number {
  return DISPOSABLE_DOMAIN_SET.size
}
