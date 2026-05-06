import { Output } from "@/lib/output";
import { pendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { asaas } from "@/lib/asaas";
import type {
  AddOnCheckoutPaymentInput,
  CheckoutDetailsResponse,
  IAddOnCheckoutUseCase,
  PaymentStatusResponse,
} from "./IAddOnCheckoutUseCase";

const CHECKOUT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function isCheckoutExpired(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > CHECKOUT_TOKEN_TTL_MS;
}

export class AddOnCheckoutUseCase implements IAddOnCheckoutUseCase {
  async getCheckoutDetails(pendingActionId: string): Promise<Output> {
    try {
      const pendingAction = await pendingActionRepository.findById(pendingActionId);

      if (!pendingAction) {
        return new Output(
          false,
          [],
          ["Ação pendente não encontrada"],
          null
        );
      }

      if (pendingAction.status === "pending" && isCheckoutExpired(pendingAction.createdAt)) {
        await pendingActionRepository.updateStatus(pendingActionId, "canceled");
        return new Output(false, [], ["Checkout expirado. Gere um novo link de pagamento."], null);
      }

      const payload = pendingAction.payload as Record<string, unknown>;
      const requesterName =
        (payload.requesterName as string | undefined) ??
        (payload.requestedByName as string | undefined);

      const inferredAddonType =
        pendingAction.actionType === "create_team" ? "team" : "user";
      const inferredAddonLabel =
        pendingAction.actionType === "create_team" ? "Time adicional" : "Licença Usuário";
      const inferredAddonDetail =
        pendingAction.actionType === "create_team"
          ? ((payload.teamName as string | undefined) ?? "")
          : `${((payload.operatorName as string | undefined) ?? (payload.name as string | undefined) ?? "").trim()} (${((payload.operatorEmail as string | undefined) ?? (payload.email as string | undefined) ?? "").trim()})`;

      const addonType = (payload.addonType as "user" | "team" | undefined) ?? inferredAddonType;
      const addonLabel = (payload.addonLabel as string | undefined) ?? inferredAddonLabel;
      const addonDetail = (payload.addonDetail as string | undefined) ?? inferredAddonDetail;
      const presetBillingType =
        payload.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

      const m = pendingAction.master as Record<string, any>;
      const checkoutDetails: CheckoutDetailsResponse = {
        pendingActionId,
        presetBillingType,
        addonType,
        addonLabel,
        addonDetail,
        pricing: {
          monthlyPrice: (payload.monthlyPrice as number) ?? (payload.billingDelta as number) ?? 0,
          remainingMonths: (payload.remainingMonths as number) ?? 1,
          totalCharge: (payload.totalCharge as number) ?? 0,
          maxInstallments: (payload.maxInstallments as number) ?? 1,
        },
        status: pendingAction.status as "pending" | "applied" | "failed" | "canceled",
        masterName: pendingAction.master.fullName || pendingAction.master.email,
        requesterName,
        alreadyPaid: pendingAction.status === "applied",
        defaultBillingData: {
          fullName: m.fullName ?? "",
          email: m.email ?? "",
          phone: m.phone ?? "",
          cpfCnpj: m.cpfCnpj ?? "",
          postalCode: m.postalCode ?? "",
          address: m.address ?? "",
          addressNumber: m.addressNumber ?? "",
          neighborhood: m.neighborhood ?? "",
          complement: m.complement ?? "",
          city: m.city ?? "",
          state: m.state ?? "",
        },
      };

      return new Output(true, [], [], checkoutDetails);
    } catch (error: any) {
      console.error("[AddOnCheckoutUseCase][getCheckoutDetails]", error);
      return new Output(
        false,
        [],
        ["Erro ao buscar detalhes do checkout"],
        null
      );
    }
  }

  async createPayment(pendingActionId: string, input: AddOnCheckoutPaymentInput): Promise<Output> {
    try {
      const pendingAction = await pendingActionRepository.findById(pendingActionId);

      if (!pendingAction) {
        return new Output(false, [], ["Ação pendente não encontrada"], null);
      }

      if (pendingAction.status === "pending" && isCheckoutExpired(pendingAction.createdAt)) {
        await pendingActionRepository.updateStatus(pendingActionId, "canceled");
        return new Output(false, [], ["Checkout expirado. Gere um novo link de pagamento."], null);
      }

      if (pendingAction.status !== "pending") {
        return new Output(false, [], ["Esta ação já foi processada"], null);
      }

      const payload = pendingAction.payload as Record<string, unknown>;
      const totalCharge = (payload.totalCharge as number) ?? 0;
      const presetBillingType =
        payload.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

      if (input.billingType !== presetBillingType) {
        return new Output(false, [], ["Forma de pagamento invalida para este checkout"], null);
      }

      const addonLabel = pendingAction.actionType === "create_team"
        ? `Time adicional: ${payload.teamName}`
        : `Licença Usuário: ${payload.operatorName ?? payload.name ?? ""}`;

      const chargeResult = await incrementalBillingService.createIncrementalCharge({
        master: pendingAction.master as any,
        pendingActionId,
        amount: totalCharge,
        description: addonLabel,
        billingType: input.billingType,
        customerOverride: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          cpfCnpj: input.cpfCnpj,
          postalCode: input.postalCode,
          address: input.address,
          addressNumber: input.addressNumber,
          neighborhood: input.neighborhood,
          complement: input.complement,
          city: input.city,
          state: input.state,
        },
        creditCard: input.creditCard,
        installments: input.installments,
        remoteIp: input.remoteIp,
      });

      if (!chargeResult) {
        return new Output(
          false,
          [],
          ["Erro ao criar cobrança"],
          null
        );
      }

      const paymentId = chargeResult.paymentId;

      await pendingActionRepository.updatePaymentId(pendingActionId, paymentId);

      const response: Record<string, unknown> = {
        paymentId: chargeResult.paymentId,
        paymentStatus: chargeResult.paymentStatus,
        billingType: chargeResult.billingType,
        amount: chargeResult.amount,
        dueDate: chargeResult.dueDate,
      };

      if (chargeResult.billingType === "PIX" && chargeResult.pix) {
        response.pix = {
          encodedImage: chargeResult.pix.encodedImage,
          payload: chargeResult.pix.payload,
          expirationDate: chargeResult.pix.expirationDate,
        };
        response.invoiceUrl = chargeResult.invoiceUrl || null;
      }

      if (chargeResult.billingType === "BOLETO" && chargeResult.boleto) {
        response.boleto = {
          bankSlipUrl: chargeResult.boleto.bankSlipUrl,
          identificationField: chargeResult.boleto.identificationField,
          barCode: chargeResult.boleto.barCode,
          dueDate: chargeResult.boleto.dueDate,
        };
      }

      return new Output(true, ["Cobrança criada com sucesso"], [], response);
    } catch (error: any) {
      console.error("[AddOnCheckoutUseCase][createPayment]", error);
      return new Output(
        false,
        [],
        ["Erro ao criar cobrança"],
        null
      );
    }
  }

  async checkPaymentStatus(pendingActionId: string): Promise<Output> {
    try {
      const pendingAction = await pendingActionRepository.findByIdSimple(pendingActionId);

      if (!pendingAction) {
        return new Output(
          false,
          [],
          ["Ação pendente não encontrada"],
          null
        );
      }

      if (pendingAction.status === "pending" && isCheckoutExpired(pendingAction.createdAt)) {
        await pendingActionRepository.updateStatus(pendingActionId, "canceled");
        return new Output(false, [], ["Checkout expirado. Gere um novo link de pagamento."], null);
      }

      if (!pendingAction.paymentId) {
        return new Output(
          false,
          [],
          ["Nenhum pagamento foi iniciado ainda"],
          null
        );
      }

      const payment = await asaas(`/payments/${pendingAction.paymentId}`);

      if (!payment) {
        return new Output(
          false,
          [],
          ["Erro ao buscar status do pagamento"],
          null
        );
      }

      // Check if payment was received/confirmed
      // Asaas status: PENDING, RECEIVED, CONFIRMED, FAILED, EXPIRED, CANCELED
      const wasConfirmed = payment.status === "RECEIVED" || payment.status === "CONFIRMED";

      // If payment was confirmed and PendingAction is still pending, mark as applied
      let currentStatus = pendingAction.status;
      if (wasConfirmed && pendingAction.status === "pending") {
        await pendingActionRepository.updateStatus(pendingActionId, "applied");
        currentStatus = "applied";
      }

      const statusResponse: PaymentStatusResponse = {
        paymentId: pendingAction.paymentId,
        status: payment.status,
        amount: payment.value,
        dueDate: payment.dueDate,
        pendingActionStatus: currentStatus as "pending" | "applied" | "failed" | "canceled",
      };

      return new Output(
        true,
        wasConfirmed && currentStatus === "applied" ? ["Pagamento confirmado com sucesso"] : [],
        [],
        statusResponse
      );
    } catch (error: any) {
      console.error("[AddOnCheckoutUseCase][checkPaymentStatus]", error);
      return new Output(
        false,
        [],
        ["Erro ao verificar status do pagamento"],
        null
      );
    }
  }
}

export const addOnCheckoutUseCase = new AddOnCheckoutUseCase();
