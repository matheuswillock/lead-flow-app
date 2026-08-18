/**
 * Quando a lista de campanhas deve virar skeleton.
 *
 * Skeleton no primeiro load (sem linhas) e numa passada após Disparado até o
 * GET devolver sending. Poll de 4s com linhas já visíveis não esconde o progresso.
 */
export function shouldShowCampaignListSkeleton(params: {
  hasExistingRows: boolean
  isAwaitingSendingAfterDispatch: boolean
}): boolean {
  if (params.isAwaitingSendingAfterDispatch) return true
  return !params.hasExistingRows
}
