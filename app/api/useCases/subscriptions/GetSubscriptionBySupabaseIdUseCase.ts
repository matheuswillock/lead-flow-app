import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";
import type { AsaasAccountId } from "@/lib/asaas";

function isAsaasSubscriptionNotFound(errorMessage: string): boolean {
  const normalized = errorMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const notFoundPatterns = [
    "not found",
    "nao encontrado",
    "nao encontrada",
    "inexistente",
    "already deleted",
  ];

  return notFoundPatterns.some((pattern) => normalized.includes(pattern));
}

function isActiveAsaasStatus(status: string | undefined): boolean {
  return (status || "").toUpperCase() === "ACTIVE";
}

export class GetSubscriptionBySupabaseIdUseCase {
  async execute(supabaseId: string): Promise<Output> {
    try {
      if (!supabaseId) {
        return new Output(false, [], ["Supabase ID é obrigatório"], null);
      }

      const profile = await prisma.profile.findUnique({
        where: { supabaseId },
        select: {
          id: true,
          supabaseId: true,
          email: true,
          fullName: true,
          hasPermanentSubscription: true,
          asaasCustomerId: true,
          asaasSubscriptionId: true,
          asaasSubscriptionAccount: true,
          subscriptionId: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionCycle: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          subscriptionNextDueDate: true,
          trialEndDate: true,
        },
      });

      if (!profile) {
        return new Output(false, [], ["Usuário não encontrado"], null);
      }

      const resolvedSubscriptionId =
        profile.asaasSubscriptionId?.trim() || profile.subscriptionId?.trim() || null;

      const localSubscription = {
        asaasCustomerId: profile.asaasCustomerId,
        asaasSubscriptionId: profile.asaasSubscriptionId,
        subscriptionId: profile.subscriptionId,
        subscriptionStatus: profile.subscriptionStatus,
        subscriptionPlan: profile.subscriptionPlan,
        subscriptionCycle: profile.subscriptionCycle,
        subscriptionStartDate: profile.subscriptionStartDate,
        subscriptionEndDate: profile.subscriptionEndDate,
        subscriptionNextDueDate: profile.subscriptionNextDueDate,
        trialEndDate: profile.trialEndDate,
        hasPermanentSubscription: profile.hasPermanentSubscription,
      };

      if (!resolvedSubscriptionId) {
        return new Output(
          true,
          ["Usuário não possui assinatura vinculada no Asaas"],
          [],
          {
            supabaseId: profile.supabaseId,
            profileId: profile.id,
            hasAsaasSubscription: false,
            isActive: false,
            asaasStatus: null,
            resolvedSubscriptionId: null,
            asaasSubscription: null,
            localSubscription,
          }
        );
      }

      // DA2 (20 — Assinaturas — Backend E4): roteia a leitura pela conta do
      // ponteiro — nunca escreve `canceled` aqui (read-only), mas sem isso
      // um `sub_` legado sempre bate 404 na primary durante a janela dual.
      const subscriptionAccount: AsaasAccountId = profile.asaasSubscriptionAccount ?? "primary";

      try {
        const asaasSubscription =
          await AsaasSubscriptionService.getSubscription(resolvedSubscriptionId, subscriptionAccount);
        const isActive = isActiveAsaasStatus(asaasSubscription.status);

        return new Output(true, ["Assinatura consultada com sucesso"], [], {
          supabaseId: profile.supabaseId,
          profileId: profile.id,
          hasAsaasSubscription: true,
          isActive,
          asaasStatus: asaasSubscription.status,
          resolvedSubscriptionId,
          asaasSubscription,
          localSubscription,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (isAsaasSubscriptionNotFound(errorMessage)) {
          return new Output(true, ["Assinatura não encontrada no Asaas"], [], {
            supabaseId: profile.supabaseId,
            profileId: profile.id,
            hasAsaasSubscription: true,
            isActive: false,
            asaasStatus: "NOT_FOUND",
            resolvedSubscriptionId,
            asaasSubscription: null,
            asaasErrorMessage: errorMessage,
            localSubscription,
          });
        }

        console.error("❌ [GetSubscriptionBySupabaseIdUseCase] Erro ao consultar assinatura no Asaas", {
          supabaseId,
          profileId: profile.id,
          resolvedSubscriptionId,
          errorMessage,
        });

        return new Output(false, [], ["Falha ao consultar assinatura no Asaas"], {
          supabaseId,
          profileId: profile.id,
          resolvedSubscriptionId,
          errorMessage,
          localSubscription,
        });
      }
    } catch (error) {
      console.error("❌ [GetSubscriptionBySupabaseIdUseCase] Erro inesperado:", error);
      return new Output(false, [], ["Erro interno ao consultar assinatura"], null);
    }
  }
}

export const getSubscriptionBySupabaseIdUseCase =
  new GetSubscriptionBySupabaseIdUseCase();
