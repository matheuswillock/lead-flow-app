/**
 * E4 (SPEC 21): o valor unitário exibido ("N × R$ X") tem que ser sempre
 * finito. O bug original dividia o preço total pela quantidade FATURÁVEL
 * (`billableTeams`/`billableUsers`), que pode ser 0 quando o cliente comprou
 * créditos extras e ainda não os usou — produzindo `Infinity` ("R$ ∞").
 * A correção divide pela quantidade CONTRATADA (a mesma que já aparece no
 * rótulo "N ×"), que é sempre > 0 quando este cálculo roda.
 */
export type CreditResourceKind = 'team' | 'user';

const CREDIT_UNIT_PRICE_FALLBACK: Record<CreditResourceKind, number> = {
  team: 29.9,
  user: 19.9,
};

/**
 * DA4 (SubscriptionCreditsDialog): o valor unitário estimado para uma nova
 * compra de créditos usa a MESMA taxa já cobrada pelos créditos contratados
 * atuais (`extraPrice / contractedExtra`, derivado do backend) em vez de uma
 * constante fixa. Só cai no fallback local — sempre logado — quando o
 * backend ainda não tem nenhum crédito contratado desse tipo para derivar a
 * taxa (ex.: primeira compra de time extra).
 */
export function resolveCreditUnitPrice(input: {
  resource: CreditResourceKind;
  contractedExtra: number;
  extraPrice: number | null | undefined;
  onFallback?: (resource: CreditResourceKind, fallback: number) => void;
}): number {
  const fallback = CREDIT_UNIT_PRICE_FALLBACK[input.resource];
  if (
    input.contractedExtra > 0 &&
    typeof input.extraPrice === 'number' &&
    Number.isFinite(input.extraPrice)
  ) {
    return input.extraPrice / input.contractedExtra;
  }
  input.onFallback?.(input.resource, fallback);
  return fallback;
}

export function resolveExtraUnitPrice(input: {
  contractedExtra: number;
  extraPrice: number | null | undefined;
  fallback: number;
  /**
   * DA4: chamado só quando havia quantidade contratada mas o backend não
   * mandou o preço (dado genuinamente faltando) — nunca no caso comum de
   * "0 extras contratados", que não é erro e não deve virar ruído no console.
   */
  onFallback?: (fallback: number) => void;
}): number {
  if (input.contractedExtra <= 0) {
    return input.fallback;
  }
  if (typeof input.extraPrice === 'number' && Number.isFinite(input.extraPrice)) {
    return input.extraPrice / input.contractedExtra;
  }
  input.onFallback?.(input.fallback);
  return input.fallback;
}
