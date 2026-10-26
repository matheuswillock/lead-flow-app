/**
 * Escolha do próximo SDR no rodízio de um webhook v2 (SPEC 11, DA11).
 *
 * Função pura: a escrita atômica do ponteiro (`lastAssignedProfileId`) é responsabilidade do
 * repositório, que chama esta função dentro de uma transação com o webhook travado. Assim dez eventos
 * simultâneos para três SDRs distribuem 4, 3 e 3.
 */
export function pickNextAssignee(input: {
  /** Lista ordenada de SDRs padrão do webhook. */
  ordered: readonly string[];
  /** Quem recebeu o último lead pelo webhook; `null` no primeiro uso. */
  lastAssignedId: string | null;
  /** SDRs que ainda são membros ativos do time. */
  validIds: ReadonlySet<string>;
}): string | null {
  const { ordered, lastAssignedId, validIds } = input;
  if (ordered.length === 0) return null;

  const lastIndex = lastAssignedId ? ordered.indexOf(lastAssignedId) : -1;

  for (let step = 1; step <= ordered.length; step += 1) {
    const candidate = ordered[(lastIndex + step + ordered.length) % ordered.length];
    if (candidate && validIds.has(candidate)) return candidate;
  }

  return null;
}
