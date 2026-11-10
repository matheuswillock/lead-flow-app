"use client"

import { useParams, usePathname } from "next/navigation"

import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"
import { useOptionalTeamContext } from "@/app/context/TeamContext"
import { AccountAccessPausedScreen } from "./AccountAccessPausedScreen"
import { BillingGraceBanner } from "./BillingGraceBanner"

/** Rota de regularização: o master de uma conta pausada precisa chegar nela para pagar. */
const BILLING_REGULARIZATION_SEGMENT = "/billing-grace-payment"

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
  const pathname = usePathname()
  const params = useParams<{ supabaseId: string }>()
  const effectiveDecision = teamContext ? teamContext.accountAccessDecision : decision
  const isBillingOwner = billingOwnerOf(teamContext?.isTeamMaster, effectiveDecision)
  const reactivateHref = params?.supabaseId ? `/${params.supabaseId}${BILLING_REGULARIZATION_SEGMENT}` : undefined
  const isOnRegularization = Boolean(pathname?.endsWith(BILLING_REGULARIZATION_SEGMENT))

  if (!effectiveDecision && decisionResolved) {
    return (
      <AccountAccessPausedScreen
        reason="subscription_unavailable"
        isBillingOwner={isBillingOwner}
        reactivateHref={reactivateHref}
      />
    )
  }

  // read_only: allow children to render; writes are blocked at the route layer
  if (effectiveDecision?.state === "read_only") {
    return children
  }

  if (effectiveDecision?.state === "restricted" && !teamContext?.isSwitchingTeam) {
    // Conta pausada: só o master entra na regularização; o resto vê a tela de pausa.
    if (isOnRegularization && isBillingOwner && effectiveDecision.reason !== "banned") return children
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
