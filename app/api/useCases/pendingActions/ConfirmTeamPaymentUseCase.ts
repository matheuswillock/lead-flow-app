import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import { pendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository";
import type { PendingActionOwnershipLookup } from "@/app/api/infra/data/repositories/pendingAction/IPendingActionRepository";
import { pendingActionUseCase } from "@/app/api/useCases/pendingActions/PendingActionUseCase";
import { createAsaasClient, type AsaasAccountId } from "@/lib/asaas";
import { Output } from "@/lib/output";

export type ConfirmTeamPaymentFailureReason =
  | "profile_not_found"
  | "forbidden"
  | "payment_not_confirmed"
  | "action_not_found"
  | "action_not_owned"
  | "action_canceled";

function failure(reason: ConfirmTeamPaymentFailureReason, message: string): Output {
  return new Output(false, [], [message], { reason });
}

/**
 * Achado Codex/cursor[bot] (PR #1137): esta rota estava listada em
 * prismaInV1RouteAllowlist (Prisma direto na v1) — tocá-la exigiu o
 * refactor DIP completo na mesma mudança (agents.md). A conta Asaas usada
 * para o preflight e para applyPendingActionByPaymentId vem da
 * PendingAction (action.asaasAccount, persistida no instante em que o
 * paymentId nasceu — C33), nunca do estado atual do master.
 */
export class ConfirmTeamPaymentUseCase {
  async confirmTeamPayment(params: { supabaseId: string; paymentId: string }): Promise<Output> {
    const { supabaseId, paymentId } = params;

    const profile = await profileRepository.findBySupabaseId(supabaseId);
    if (!profile) {
      return failure("profile_not_found", "Perfil não encontrado");
    }

    const activeMembership = profile.activeTeamId
      ? await teamMembersRepository.findMembership(profile.activeTeamId, profile.id)
      : null;

    const canConfirmTeamPayment =
      profile.isMaster ||
      (activeMembership?.role === "manager" && activeMembership.canManageAccountTeams === true);

    if (!canConfirmTeamPayment) {
      return failure(
        "forbidden",
        "Apenas o master ou um manager delegado pode confirmar pagamento de time"
      );
    }

    const billingOwnerId = profile.isMaster ? profile.id : profile.managerId;

    let action: PendingActionOwnershipLookup | null = billingOwnerId
      ? await pendingActionRepository.findByPaymentIdAndMasterId(paymentId, billingOwnerId)
      : null;

    // Sem a action ainda (paymentId pode ter chegado via externalReference
    // do Asaas, não via campo próprio) — a conta atual do master é o
    // melhor palpite disponível só para ESTA tentativa de descoberta.
    const lookupAccount: AsaasAccountId =
      action?.asaasAccount ??
      (billingOwnerId ? (await profileRepository.findById(billingOwnerId))?.asaasCustomerAccount : undefined) ??
      "primary";

    const client = createAsaasClient(lookupAccount);
    const payment = await client.request(`${client.endpoints.payments}/${paymentId}`, {
      method: "GET",
    });

    const status = payment?.status as string | undefined;
    if (status !== "CONFIRMED" && status !== "RECEIVED") {
      return failure("payment_not_confirmed", "Pagamento ainda não foi confirmado");
    }

    const externalReference = payment?.externalReference as string | undefined;
    if (!action && externalReference?.startsWith("pending-action-")) {
      const actionId = externalReference.replace("pending-action-", "");
      const found = await pendingActionRepository.findByIdSimple(actionId);
      action = found;
    }

    if (!action) {
      return failure("action_not_found", "Ação pendente não encontrada");
    }

    if (action.masterId !== billingOwnerId) {
      return failure("action_not_owned", "Ação não pertence a este master");
    }

    if (action.status === "canceled") {
      return failure("action_canceled", "Ação cancelada");
    }

    return pendingActionUseCase.applyPendingActionByPaymentId(paymentId, action.asaasAccount);
  }
}

export const confirmTeamPaymentUseCase = new ConfirmTeamPaymentUseCase();
