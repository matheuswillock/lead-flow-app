import { Output } from "@/lib/output";
import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";
import { logSubscriptionChange } from "@/lib/billing/logSubscriptionChange";

export type TransitionSubscriptionLevelInput = {
  profileId: string;
  targetUserTypeSlug?: string;
  targetProductSlugs?: string[];
  actorProfileId: string;
  source?: string;
};

export class TransitionSubscriptionLevelUseCase {
  async execute(input: TransitionSubscriptionLevelInput): Promise<Output> {
    const { profileId, targetUserTypeSlug, targetProductSlugs, actorProfileId } = input;
    const source = input.source ?? "backoffice_transition";

    if (!profileId) {
      return new Output(false, [], ["profileId é obrigatório"], null);
    }
    if (!targetUserTypeSlug && (!targetProductSlugs || targetProductSlugs.length === 0)) {
      return new Output(false, [], ["Informe targetUserTypeSlug e/ou targetProductSlugs"], null);
    }

    const profile = await billingEngineRepository.findProfileForTransition(profileId);
    if (!profile) {
      return new Output(false, [], ["Profile não encontrado"], null);
    }

    const before = {
      userType: profile.userTypeAssignment?.userType?.slug ?? null,
      productId: profile.subscription?.productId ?? null,
    };

    const asaasId =
      profile.subscription?.asaasSubscriptionId ||
      profile.asaasSubscriptionId ||
      profile.subscriptionId;

    if (asaasId && targetProductSlugs && targetProductSlugs.length > 0) {
      console.info("[TransitionSubscriptionLevelUseCase] transição com Asaas", {
        profileId,
        asaasId,
        targetProductSlugs,
      });
    }

    try {
      if (targetUserTypeSlug) {
        const userType = await billingEngineRepository.findUserTypeBySlug(targetUserTypeSlug);
        if (!userType) {
          return new Output(false, [], [`User type não encontrado: ${targetUserTypeSlug}`], null);
        }
        await billingEngineRepository.upsertUserTypeAssignment({
          profileId,
          userTypeId: userType.id,
          assignedByProfileId: actorProfileId,
        });
      }

      if (targetProductSlugs && targetProductSlugs.length > 0) {
        const products = await billingEngineRepository.findProductsByFeatureSlugs(targetProductSlugs);
        for (const product of products) {
          await billingEngineRepository.upsertUserProductSubscription({
            profileId,
            productId: product.id,
          });
        }
        const primary = products[0];
        if (primary) {
          await billingEngineRepository.upsertProfileSubscriptionProduct({
            profileId,
            productId: primary.id,
          });
        }
      }
    } catch (error) {
      console.error("[TransitionSubscriptionLevelUseCase] erro na transição", error);
      return new Output(false, [], ["Erro ao transicionar nível de assinatura"], null);
    }

    const after = {
      userType: targetUserTypeSlug ?? before.userType,
      productSlugs: targetProductSlugs ?? null,
    };

    await logSubscriptionChange({
      profileId,
      source,
      actorProfileId,
      eventType: "level_transition",
      before,
      after,
    });

    console.info("[TransitionSubscriptionLevelUseCase] transição concluída", {
      profileId,
      before,
      after,
      actorProfileId,
    });

    return new Output(true, ["Nível de assinatura atualizado"], [], { before, after });
  }
}

export const transitionSubscriptionLevelUseCase = new TransitionSubscriptionLevelUseCase();
