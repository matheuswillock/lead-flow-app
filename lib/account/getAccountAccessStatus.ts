import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { isAccountSubscriptionActive } from "@/lib/subscription/isAccountSubscriptionActive";
import { isAccountMasterBanned } from "@/lib/account/isAccountMasterBanned";
import { backofficeTermsAcceptanceRepository } from "@/app/api/infra/data/repositories/backoffice/termsAcceptance/BackofficeTermsAcceptanceRepository";

export type AccountAccessStatus = {
  subscriptionActive: boolean;
  banned: boolean;
  termsAcceptanceGranted: boolean;
};

/**
 * Status de acesso da conta (assinatura ativa + ban) com cache curto.
 * Chamado em todo request autenticado via getTeamAccess; o cache evita
 * 3 queries por request. Invalidado por updateTag nos pontos de escrita
 * (webhook Asaas e mutações de ban/assinatura do backoffice).
 */
export async function getAccountAccessStatus(
  accountMasterId: string
): Promise<AccountAccessStatus> {
  "use cache";
  cacheTag(cacheTags.accountAccessStatus(accountMasterId));
  cacheLife({ revalidate: 45 });

  const [subscriptionActive, banned, adhesion] = await Promise.all([
    isAccountSubscriptionActive(accountMasterId),
    isAccountMasterBanned(accountMasterId),
    backofficeTermsAcceptanceRepository.findAccessGate(accountMasterId),
  ]);

  return {
    subscriptionActive,
    banned,
    termsAcceptanceGranted: !adhesion?.termsAcceptanceRequired || Boolean(adhesion.termsAcceptance),
  };
}
