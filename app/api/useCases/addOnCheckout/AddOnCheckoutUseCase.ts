import { Output } from "@/lib/output";
import { pendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository";
import { pendingActionUseCase } from "@/app/api/useCases/pendingActions/PendingActionUseCase";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { asaas, createAsaasClient, type AsaasAccountId } from "@/lib/asaas";
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

function normalizeBillingType(value: unknown): "PIX" | "CREDIT_CARD" | null {
  if (value === "PIX" || value === "CREDIT_CARD") {
    return value;
  }
  return null;
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

      const isTeamAction = pendingAction.actionType === "create_team";
      const isCreditAction = pendingAction.actionType === "update_subscription_credits";
      const inferredAddonType = isTeamAction ? "team" : "user";
      const inferredAddonLabel = isTeamAction
        ? "Time adicional"
        : isCreditAction
          ? "Créditos de assinatura"
          : "Licença Usuário";
      const inferredAddonDetail = isTeamAction
        ? ((payload.teamName as string | undefined) ?? "")
        : isCreditAction
          ? ((payload.addonDetail as string | undefined) ?? "")
          : `${((payload.operatorName as string | undefined) ?? (payload.name as string | undefined) ?? "").trim()} (${((payload.operatorEmail as string | undefined) ?? (payload.email as string | undefined) ?? "").trim()})`;

      const addonType = (payload.addonType as "user" | "team" | undefined) ?? inferredAddonType;
      const addonLabel = (payload.addonLabel as string | undefined) ?? inferredAddonLabel;
      const addonDetail = (payload.addonDetail as string | undefined) ?? inferredAddonDetail;
      const presetBillingType =
        payload.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

      const m = pendingAction.master as Record<string, any>;
      const checkoutDetails: CheckoutDetailsResponse = {
        pendingActionId,
        paymentId: pendingAction.paymentId ?? null,
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

      if (pendingAction.paymentId) {
        const existingPayment = await asaas(`/payments/${pendingAction.paymentId}`);
        if (!existingPayment) {
          return new Output(false, [], ["Erro ao recuperar pagamento existente"], null);
        }
        const existingResponse: Record<string, unknown> = {
          paymentId: existingPayment.id,
          paymentStatus: existingPayment.status,
          billingType: existingPayment.billingType,
          amount: existingPayment.value,
          dueDate: existingPayment.dueDate,
        };
        if (existingPayment.billingType === "PIX") {
          const pixData = await asaas(`/payments/${pendingAction.paymentId}/pixQrCode`);
          if (pixData) {
            existingResponse.pix = {
              encodedImage: pixData.encodedImage,
              payload: pixData.payload,
              expirationDate: pixData.expirationDate,
            };
          }
          existingResponse.invoiceUrl = existingPayment.invoiceUrl || null;
        }
        return new Output(true, ["Cobrança já criada"], [], existingResponse);
      }

      const payload = pendingAction.payload as Record<string, unknown>;
      const totalCharge = (payload.totalCharge as number) ?? 0;
      const presetBillingType =
        payload.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

      if (input.billingType !== presetBillingType) {
        return new Output(false, [], ["Forma de pagamento invalida para este checkout"], null);
      }

      const addonLabel =
        pendingAction.actionType === "create_team"
          ? `Time adicional: ${payload.teamName}`
          : pendingAction.actionType === "update_subscription_credits"
            ? `Créditos de assinatura: ${payload.addonDetail ?? ""}`
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

      // Achado Codex (PR #1137, P1): persiste a conta ONDE a cobrança
      // nasceu de fato (a do master neste instante) — não deriva depois,
      // porque o master pode migrar de conta (E4, checkout de operador).
      await pendingActionRepository.updatePaymentId(
        pendingActionId,
        paymentId,
        (pendingAction.master as { asaasCustomerAccount: AsaasAccountId }).asaasCustomerAccount
      );

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
      // E6 (C32/DA4): findApplicableById traz o master junto — precisamos
      // da conta dele para rotear o GET e ter algo pra propagar ao aplicar
      // a ação (findByIdSimple não carrega essa relação).
      const pendingAction = await pendingActionRepository.findApplicableById(pendingActionId);

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

      // Achado Codex (PR #1137, P1): usa a conta PERSISTIDA no instante em
      // que a cobrança nasceu (pendingAction.asaasAccount) — nunca deriva
      // de pendingAction.master.asaasCustomerAccount, que pode ter mudado
      // desde então (E4, checkout de operador migra o master de conta).
      const account = pendingAction.asaasAccount;
      let payment: { status?: string; value?: number; dueDate?: string } | null = null;

      try {
        const client = createAsaasClient(account);
        payment = await client.request(`${client.endpoints.payments}/${pendingAction.paymentId}`, {
          method: "GET",
        });
      } catch (error) {
        // E6/DA4: o provedor caindo (ou um pay_ legado 404 na janela) não
        // pode virar "pendente para sempre" nem 500 — degrada para o
        // status persistido pelo webhook (última verdade conhecida).
        console.error(
          "[AddOnCheckoutUseCase][checkPaymentStatus] Asaas indisponível, usando status persistido",
          { pendingActionId, paymentId: pendingAction.paymentId, account, error }
        );

        const persistedStatus =
          pendingAction.status === "applied"
            ? "CONFIRMED"
            : pendingAction.status === "canceled"
              ? "CANCELED"
              : "PENDING";

        const degradedResponse: PaymentStatusResponse = {
          paymentId: pendingAction.paymentId,
          status: persistedStatus,
          amount: null,
          dueDate: null,
          pendingActionStatus: pendingAction.status as "pending" | "applied" | "failed" | "canceled",
        };

        return new Output(true, [], [], degradedResponse);
      }

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

      // If payment was confirmed and PendingAction is still pending, run the full apply flow
      // (creates team/user and syncs recurring subscription — not just a status update)
      let currentStatus = pendingAction.status;
      if (wasConfirmed && pendingAction.status === "pending") {
        await pendingActionUseCase.applyPendingActionByPaymentId(pendingAction.paymentId, account);
        currentStatus = "applied";
      }

      const statusResponse: PaymentStatusResponse = {
        paymentId: pendingAction.paymentId,
        status: payment.status ?? "PENDING",
        amount: payment.value ?? null,
        dueDate: payment.dueDate ?? null,
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

  async updateBillingType(pendingActionId: string, billingType: unknown): Promise<Output> {
    try {
      const nextBillingType = normalizeBillingType(billingType);
      if (!nextBillingType) {
        return new Output(false, [], ["Forma de pagamento invalida"], null);
      }

      const pendingAction = await pendingActionRepository.findByIdSimple(pendingActionId);
      if (!pendingAction) {
        return new Output(false, [], ["Ação pendente não encontrada"], null);
      }

      if (pendingAction.status !== "pending") {
        return new Output(false, [], ["Esta ação já foi processada"], null);
      }

      const currentPayload = (pendingAction.payload as Record<string, unknown>) || {};
      const currentBillingType = normalizeBillingType(currentPayload.billingType) ?? "PIX";
      if (currentBillingType === nextBillingType) {
        return new Output(true, ["Forma de pagamento já está atualizada"], [], {
          pendingActionId,
          billingType: nextBillingType,
        });
      }

      if (pendingAction.paymentId) {
        const payment = await asaas(`/payments/${pendingAction.paymentId}`);
        const paymentStatus = String(payment?.status ?? "PENDING");
        if (paymentStatus === "PENDING") {
          await asaas(`/payments/${pendingAction.paymentId}`, { method: "DELETE" });
        }
      }

      await pendingActionRepository.updatePayload(pendingActionId, {
        ...currentPayload,
        billingType: nextBillingType,
      });

      await pendingActionRepository.clearPaymentId(pendingActionId);

      return new Output(true, ["Forma de pagamento atualizada com sucesso"], [], {
        pendingActionId,
        billingType: nextBillingType,
      });
    } catch (error) {
      console.error("[AddOnCheckoutUseCase][updateBillingType]", error);
      return new Output(false, [], ["Erro ao atualizar forma de pagamento"], null);
    }
  }
}

export const addOnCheckoutUseCase = new AddOnCheckoutUseCase();
