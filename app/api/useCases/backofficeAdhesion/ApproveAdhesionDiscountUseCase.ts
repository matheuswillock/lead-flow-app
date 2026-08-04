import { Output } from "@/lib/output";
import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";

/** Teto padrão de desconto sem aprovação (Estágio 10 / D10). Override via env. */
export const ADHESION_DISCOUNT_AUTO_APPROVE_MAX_PERCENT = Number(
  process.env.ADHESION_DISCOUNT_AUTO_APPROVE_MAX_PERCENT ?? "10"
);

export class ApproveAdhesionDiscountUseCase {
  async execute(params: {
    adhesionId: string;
    actorProfileId: string;
  }): Promise<Output> {
    const adhesion = await billingEngineRepository.findAdhesionDiscount(params.adhesionId);

    if (!adhesion) {
      return new Output(false, [], ["Adesão não encontrada"], null);
    }

    const percent = adhesion.discountPercent ? Number(adhesion.discountPercent) : 0;
    if (percent <= 0) {
      return new Output(false, [], ["Adesão sem desconto pendente"], null);
    }

    const updated = await billingEngineRepository.updateAdhesionDiscount(adhesion.id, {
      discountStatus: "approved",
      discountApprovedByProfileId: params.actorProfileId,
      discountApprovedAt: new Date(),
    });

    console.info("[ApproveAdhesionDiscountUseCase] desconto aprovado", {
      adhesionId: updated.id,
      actorProfileId: params.actorProfileId,
      discountPercent: updated.discountPercent,
    });

    return new Output(true, ["Desconto aprovado"], [], updated);
  }

  async applyDiscount(params: {
    adhesionId: string;
    discountPercent: number;
    actorProfileId: string;
  }): Promise<Output> {
    const { adhesionId, discountPercent, actorProfileId } = params;
    if (discountPercent < 0 || discountPercent > 100) {
      return new Output(false, [], ["discountPercent inválido"], null);
    }

    const adhesion = await billingEngineRepository.findAdhesionDiscount(adhesionId);
    if (!adhesion) {
      return new Output(false, [], ["Adesão não encontrada"], null);
    }

    const total = Number(adhesion.totalAmount);
    const negotiated = Number((total * (1 - discountPercent / 100)).toFixed(2));
    const needsApproval = discountPercent > ADHESION_DISCOUNT_AUTO_APPROVE_MAX_PERCENT;

    const updated = await billingEngineRepository.updateAdhesionDiscount(adhesionId, {
      discountPercent,
      negotiatedTotalAmount: negotiated,
      discountStatus: needsApproval ? "pending" : "approved",
      discountApprovedByProfileId: needsApproval ? null : actorProfileId,
      discountApprovedAt: needsApproval ? null : new Date(),
    });

    return new Output(
      true,
      [
        needsApproval
          ? "Desconto acima do teto — aguardando aprovação"
          : "Desconto aplicado",
      ],
      [],
      updated
    );
  }
}

export const approveAdhesionDiscountUseCase = new ApproveAdhesionDiscountUseCase();
