/**
 * E4 (SPEC 21): o valor unitário exibido ("N × R$ X") tem que ser sempre
 * finito E bater com a taxa que o backend realmente cobra.
 *
 * A fonte da verdade é `buildBillingSummary` (`app/api/shared/billing/billingSummary.ts`):
 *
 *   billableTeams   = Math.max(rawExtraTeams, contractedExtraTeams)
 *   extraTeamsPrice = billableTeams * BILLING_PRICES.extraTeam
 *
 * Duas consequências que definem este módulo:
 *
 * 1. `extraPrice` é derivado da quantidade **faturável**, não da contratada.
 *    Dividir por `contractedExtra` infla o unitário sempre que o uso real
 *    passa dos créditos contratados (2 times faturáveis / 1 contratado
 *    mostraria R$ 59,80/unidade quando o backend cobra R$ 29,90). O divisor
 *    correto — e o multiplicando honesto no rótulo — é a quantidade
 *    faturável. (Achado P1 do Codex no PR #1199.)
 * 2. Como `billableTeams >= contractedExtraTeams`, usar a faturável também
 *    fecha o bug original do "R$ ∞": o divisor é > 0 sempre que a linha é
 *    renderizada, e a guarda abaixo cobre o resto (`hasUnlimitedUsers` zera
 *    `billableUsers`, payload corrompido, etc.).
 */
export type CreditResourceKind = 'team' | 'user';

const CREDIT_UNIT_PRICE_FALLBACK: Record<CreditResourceKind, number> = {
  team: 29.9,
  user: 19.9,
};

/**
 * Taxa unitária efetiva = preço total do recurso / quantidade faturável.
 * Nunca retorna `Infinity`/`NaN`: divisor <= 0 ou preço não finito caem no
 * fallback local.
 *
 * `onFallback` só dispara quando o fallback denuncia **dado faltando**: há
 * quantidade faturável (a linha vai ser renderizada) e mesmo assim o
 * backend não mandou o preço. Quantidade zero não é lacuna — é a assinatura
 * base sem extras, o caso normal. Sinalizar ali fazia toda visita de cliente
 * sem extras virar `console.error` capturado pelo Sentry como erro de
 * cobrança falso (achado P2 da revisão do lote unificado, PR #1207).
 */
export function resolveExtraUnitPrice(input: {
  billableQuantity: number;
  extraPrice: number | null | undefined;
  fallback: number;
  onFallback?: (fallback: number) => void;
}): number {
  if (input.billableQuantity <= 0) {
    return input.fallback;
  }
  if (typeof input.extraPrice === 'number' && Number.isFinite(input.extraPrice)) {
    return input.extraPrice / input.billableQuantity;
  }
  input.onFallback?.(input.fallback);
  return input.fallback;
}

/**
 * DA4 (SubscriptionCreditsDialog): o custo estimado de uma compra nova usa a
 * taxa marginal que o backend já aplica hoje — `extraPrice / billableQuantity`
 * é exatamente `BILLING_PRICES.extraTeam`/`extraUser`. Cai no fallback local
 * quando não há quantidade faturável para derivar a taxa (ex.: primeira
 * compra de time extra, ou plano com usuários ilimitados) — caso normal, que
 * **não** dispara `onFallback`; só dado realmente faltando dispara.
 */
export function resolveCreditUnitPrice(input: {
  resource: CreditResourceKind;
  billableQuantity: number;
  extraPrice: number | null | undefined;
  onFallback?: (resource: CreditResourceKind, fallback: number) => void;
}): number {
  const fallback = CREDIT_UNIT_PRICE_FALLBACK[input.resource];
  return resolveExtraUnitPrice({
    billableQuantity: input.billableQuantity,
    extraPrice: input.extraPrice,
    fallback,
    onFallback: () => input.onFallback?.(input.resource, fallback),
  });
}
