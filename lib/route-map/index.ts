/**
 * Route Map — slug público para a base da API
 *
 * O slug substitui o prefixo /api/v1 nas chamadas client-side,
 * de modo que o Network do browser exibe /api/q/[slug]/...
 * em vez de /api/v1/... Isso oculta a convenção de versionamento
 * e dificulta o mapeamento estrutural da API por terceiros.
 *
 * O slug não é um segredo criptográfico; a segurança real está
 * na autenticação obrigatória em cada Route Handler.
 */

/** Prefixo público que substitui /api/v1 nas chamadas do browser. */
export const API_CLIENT_SLUG = 'q' as const;

/**
 * Base path a ser usado em todos os serviços client-side.
 * Substitui /api/v1 nas chamadas fetch do browser.
 *
 * @example
 * // Antes
 * fetch(`/api/v1/leads`)
 *
 * // Depois
 * fetch(`${API_CLIENT_BASE}/leads`)
 */
export const API_CLIENT_BASE = `/api/${API_CLIENT_SLUG}` as const;

/**
 * Token do prefixo interno real. Nunca exportar para o client bundle.
 * Usado apenas pelo middleware (server-only).
 * @internal
 */
export const INTERNAL_API_PREFIX = '/api/v1' as const;
