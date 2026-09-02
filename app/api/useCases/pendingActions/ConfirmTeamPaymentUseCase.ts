import {
  profileRepository as defaultProfileRepository,
  type IProfileRepository,
} from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { teamMembersRepository as defaultTeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import type { ITeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository";
import { pendingActionRepository as defaultPendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository";
import type {
  IPendingActionRepository,
  PendingActionOwnershipLookup,
} from "@/app/api/infra/data/repositories/pendingAction/IPendingActionRepository";
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

const ASAAS_ACCOUNTS: AsaasAccountId[] = ["primary", "legacy"];

type AsaasPaymentLookup = { status?: string; externalReference?: string };

/**
 * Achado Codex/cursor[bot] (PR #1137): esta rota estava listada em
 * prismaInV1RouteAllowlist (Prisma direto na v1) — tocá-la exigiu o
 * refactor DIP completo na mesma mudança (agents.md). A conta Asaas usada
 * para o preflight e para applyPendingActionByPaymentId vem da
 * PendingAction (action.asaasAccount, persistida no instante em que o
 * paymentId nasceu — C33), nunca do estado atual do master.
 *
 * Achado Codex round 7 (P1): repositórios injetados via construtor
 * (interface + implementação concreta default), não importados como
 * singletons no corpo da classe — completa o DIP que o achado original
 * exigia.
 */
export class ConfirmTeamPaymentUseCase {
  constructor(
    private readonly profileRepository: IProfileRepository = defaultProfileRepository,
    private readonly teamMembersRepository: ITeamMembersRepository = defaultTeamMembersRepository,
    private readonly pendingActionRepository: IPendingActionRepository = defaultPendingActionRepository
  ) {}

  async confirmTeamPayment(params: { supabaseId: string; paymentId: string }): Promise<Output> {
    const { supabaseId, paymentId } = params;

    const profile = await this.profileRepository.findBySupabaseId(supabaseId);
    if (!profile) {
      return failure("profile_not_found", "Perfil não encontrado");
    }

    const activeMembership = profile.activeTeamId
      ? await this.teamMembersRepository.findMembership(profile.activeTeamId, profile.id)
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
      ? await this.pendingActionRepository.findByPaymentIdAndMasterId(paymentId, billingOwnerId)
      : null;

    let payment: AsaasPaymentLookup | null = null;

    if (action) {
      const client = createAsaasClient(action.asaasAccount);
      payment = await client.request(`${client.endpoints.payments}/${paymentId}`, {
        method: "GET",
      });
    } else {
      // Achado Codex (PR #1137, P2, round 7): sem action achada por
      // masterId (ex.: o Asaas criou o pagamento mas updatePaymentId
      // falhou depois), sonda as DUAS contas em vez de adivinhar uma só a
      // partir do estado atual do master — que pode já ter migrado desde
      // então (E4). Aceita apenas o resultado cujo externalReference
      // resolve para uma action deste billing owner.
      for (const candidateAccount of ASAAS_ACCOUNTS) {
        let candidatePayment: AsaasPaymentLookup | null = null;
        try {
          const client = createAsaasClient(candidateAccount);
          candidatePayment = await client.request(`${client.endpoints.payments}/${paymentId}`, {
            method: "GET",
          });
        } catch {
          continue;
        }

        payment = candidatePayment;

        const externalReference = candidatePayment?.externalReference;
        if (externalReference?.startsWith("pending-action-")) {
          const actionId = externalReference.replace("pending-action-", "");
          const found = await this.pendingActionRepository.findByIdSimple(actionId);
          if (found && found.masterId === billingOwnerId) {
            action = found;
            break;
          }
        }
      }
    }

    if (!payment) {
      return failure("action_not_found", "Ação pendente não encontrada");
    }

    const status = payment.status;
    if (status !== "CONFIRMED" && status !== "RECEIVED") {
      return failure("payment_not_confirmed", "Pagamento ainda não foi confirmado");
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
