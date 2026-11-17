"use client"

import { useParams, usePathname } from "next/navigation"

import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"
import { useOptionalTeamContext } from "@/app/context/TeamContext"
import { useOptionalFeatureAccess } from "@/app/context/FeatureAccessContext"
import { AccountAccessPausedScreen } from "./AccountAccessPausedScreen"
import { BillingGraceBanner } from "./BillingGraceBanner"
import { getAccessPausedAction, getPaymentRecoveryHref, isPaymentRecoveryPath } from "./accountAccessRecovery"
import { getReadOnlyHomeHref, isReadOnlyAllowedPath } from "./accountAccessReadOnly"
import { ReadOnlyRedirect } from "./ReadOnlyRedirect"

type AccountAccessGateProps = {
  decision: AccountAccessDecision | null | undefined
  decisionResolved?: boolean
  children: React.ReactNode
}

function billingOwnerOf(
  isTeamMaster: boolean | undefined,
  decision: AccountAccessDecision | null | undefined,
): boolean {
  if (isTeamMaster !== undefined) return isTeamMaster
  return Boolean(decision && "isBillingOwner" in decision && decision.isBillingOwner)
}

export function AccountAccessGate({ decision, decisionResolved = false, children }: AccountAccessGateProps) {
  const teamContext = useOptionalTeamContext()
  // Falha fechado: sem o provedor montado (não deveria acontecer em produção,
  // já que FeatureAccessProvider envolve este gate em layout.tsx), nenhuma rota
  // com slug exigido é liberada — só a de pagamento e as sem slug nenhum.
  const hasAccess = useOptionalFeatureAccess()?.hasAccess ?? (() => false)
  const pathname = usePathname()
  const params = useParams<{ supabaseId: string }>()
  const supabaseId = params?.supabaseId
  const effectiveDecision = teamContext ? teamContext.accountAccessDecision : decision
  const isBillingOwner = billingOwnerOf(teamContext?.isTeamMaster, effectiveDecision)
  const reactivateHref = supabaseId ? getPaymentRecoveryHref(supabaseId) : undefined
  const isOnRegularization = isPaymentRecoveryPath(pathname)

  if (!effectiveDecision && decisionResolved) {
    return (
      <AccountAccessPausedScreen
        reason="subscription_unavailable"
        isBillingOwner={isBillingOwner}
        reactivateHref={reactivateHref}
      />
    )
  }

  // read_only (carência expirada, sem corte fixo de dias): continua tudo que a conta já
  // tinha contratado, só em visualização, e a página de pagamento para o master. As
  // gravações são barradas na camada de rotas da API.
  if (effectiveDecision?.state === "read_only") {
    if (!supabaseId) {
      return <AccountAccessPausedScreen reason={effectiveDecision.reason} isBillingOwner={isBillingOwner} />
    }

    if (isReadOnlyAllowedPath(pathname, isBillingOwner, hasAccess)) return children

    return <ReadOnlyRedirect href={getReadOnlyHomeHref(supabaseId)} />
  }

  if (effectiveDecision?.state === "restricted" && !teamContext?.isSwitchingTeam) {
    // Conta pausada: só o master que pode pagar entra na regularização; o resto vê a tela de pausa.
    if (getAccessPausedAction(effectiveDecision.reason, isBillingOwner) === "payment" && isOnRegularization) {
      return children
    }

    return (
      <AccountAccessPausedScreen
        isBillingOwner={isBillingOwner}
        reason={effectiveDecision.reason}
        reactivateHref={reactivateHref}
      />
    )
  }

  // Carência: a conta venceu, mas o acesso segue até o fim da tolerância. Aviso fixo no topo.
  if (effectiveDecision?.state === "allowed" && effectiveDecision.billingGraceUntil) {
    return (
      <>
        <BillingGraceBanner
          graceUntil={effectiveDecision.billingGraceUntil}
          isBillingOwner={isBillingOwner}
          regularizeHref={isOnRegularization ? undefined : reactivateHref}
        />
        {children}
      </>
    )
  }

  return children
}
