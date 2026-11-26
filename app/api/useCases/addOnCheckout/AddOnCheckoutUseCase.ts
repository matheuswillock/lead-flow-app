import { Output } from "@/lib/output";
import { pendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository";
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository";
import { pendingActionUseCase } from "@/app/api/useCases/pendingActions/PendingActionUseCase";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { validateRequestedInstallments } from "@/app/api/services/billing/proportionalAddonCharge";
import { createAsaasClient } from "@/lib/asaas";
import {
  assertCardChoiceAllowedForMaster,
  resolveAvailableBillingTypesForMaster,
} from "@/app/api/services/billing/ExistingCardSubscriberService";
import {
  PaymentMethodUnavailableError,
  readConfiguredAbacatePublicKey,
} from "@/lib/payment-methods/availability";
import { markedUnavailableOutput } from "@/lib/payment-methods/route-guard";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/legal-document-types";
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

// Achado Codex (PR #1407, P2): a cobrança AbacatePay não existe no Asaas; devolve a tentativa guardada.
async function storedAbacatePayCharge(input: {
  attemptId: string | null;
  paymentId: string;
  billingType: "PIX" | "CREDIT_CARD";
  amount: number;
}): Promise<Output> {
  const attempt = input.attemptId
    ? await paymentProviderSessionRepository.findAttemptById(input.attemptId)
    : null;
  if (!attempt) {
    return new Output(false, [], ["Tentativa de pagamento não encontrada"], null);
  }
  const response: Record<string, unknown> = {
    paymentId: input.paymentId,
    paymentStatus: attempt.status,
    billingType: input.billingType,
    amount: input.amount,
    dueDate: null,
  };
  if (attempt.paymentInstructions) {
    response.pix = {
      encodedImage: attempt.paymentInstructions.brCodeBase64,
      payload: attempt.paymentInstructions.brCode,
      expirationDate: attempt.paymentInstructions.expiresAt,
    };
    response.invoiceUrl = attempt.externalId ? `https://pay.abacate.app/invoice/${attempt.externalId}` : null;
  }
  return new Output(true, ["Cobrança já criada"], [], response);
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
      const availableBillingTypes = await resolveAvailableBillingTypesForMaster(m);
      // Achado Codex (PR #1407, P2): sem a chave pública o cartão não é tokenizado e a cobrança é recusada.
      const cardPublicKey = availableBillingTypes.includes("CREDIT_CARD")
        ? await readConfiguredAbacatePublicKey()
        : null;
      const checkoutDetails: CheckoutDetailsResponse = {
        pendingActionId,
        paymentId: pendingAction.paymentId ?? null,
        presetBillingType,
        availableBillingTypes,
        cardCheckout: cardPublicKey ? { provider: "ABACATE_PAY", publicKey: cardPublicKey } : null,
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
        if (pendingAction.provider === "ABACATE_PAY") {
          const storedPayload = pendingAction.payload as Record<string, unknown>;
          return storedAbacatePayCharge({
            attemptId: pendingAction.providerAttemptId ?? null,
            paymentId: pendingAction.paymentId,
            billingType: normalizeBillingType(storedPayload.billingType) ?? "PIX",
            amount: (storedPayload.totalCharge as number) ?? 0,
          });
        }
        // Achado Codex (PR #1137, P2): pendingAction.asaasAccount é a conta
        // PERSISTIDA no instante em que este paymentId nasceu — nunca o
        // helper asaas() legado (sempre primary), que devolvia 404 para
        // uma cobrança já criada na legacy (C33/E6).
        const existingPaymentClient = createAsaasClient(pendingAction.asaasAccount ?? "primary");
        const existingPayment = await existingPaymentClient.request(
          `${existingPaymentClient.endpoints.payments}/${pendingAction.paymentId}`
        );
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
          const pixData = await existingPaymentClient.request(
            `${existingPaymentClient.endpoints.payments}/${pendingAction.paymentId}/pixQrCode`
          );
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

      await assertCardChoiceAllowedForMaster(input.billingType, pendingAction.master);

      // O limite foi gravado no payload a partir do ciclo do contrato; PIX é sempre à vista.
      const installments = input.billingType === "CREDIT_CARD" ? (input.installments ?? 1) : 1;
      const installmentsError = validateRequestedInstallments(
        installments,
        Math.max(1, Math.floor(Number(payload.maxInstallments) || 1)),
      );
      if (installmentsError) {
        return new Output(false, [], [installmentsError], null);
      }

      // Carimbo do aceite no próprio payload da ação pendente (JSON), sem coluna nova.
      await pendingActionRepository.updatePayload(pendingActionId, {
        ...payload,
        termsAcceptedAt: new Date().toISOString(),
        termsVersion: LEGAL_DOCUMENTS_VERSION,
      });

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
        cardToken: input.cardToken,
        installments,
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

      // A cobrança nasce sempre no provedor roteado (createIncrementalCharge): não há conta Asaas.
      await pendingActionRepository.updatePaymentId(pendingActionId, paymentId, null);

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
      if (error instanceof PaymentMethodUnavailableError) {
        return markedUnavailableOutput(error);
      }
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

      const isAbacatePay = pendingAction.provider === "ABACATE_PAY";

      if (!isAbacatePay && !pendingAction.paymentId) {
        return new Output(
          false,
          [],
          ["Nenhum pagamento foi iniciado ainda"],
          null
        );
      }

      const paymentId = pendingAction.paymentId ?? `provider-${pendingAction.providerExternalId}`;

      let payment: { status?: string; value?: number; dueDate?: string } | null = null;
      let wasConfirmed = false;

      if (isAbacatePay) {
        // Buscar status da tentativa no PaymentProviderSessionRepository
        if (!pendingAction.providerAttemptId) {
          return new Output(
            false,
            [],
            ["Tentativa de pagamento não foi registrada"],
            null
          );
        }

        try {
          const attempt = await paymentProviderSessionRepository.findAttemptById(
            pendingAction.providerAttemptId
          );
          if (!attempt) {
            return new Output(
              false,
              [],
              ["Tentativa de pagamento não encontrada"],
              null
            );
          }

          // Status da tentativa: CREATED, PENDING, CONFIRMED, FAILED, REFUNDED, etc.
          wasConfirmed = attempt.status === "CONFIRMED";
          payment = { status: attempt.status };
        } catch (error) {
          console.error(
            "[AddOnCheckoutUseCase][checkPaymentStatus] Erro ao buscar status AbacatePay",
            { pendingActionId, providerAttemptId: pendingAction.providerAttemptId, error }
          );

          // Degradação: usar status persistido
          const persistedStatus =
            pendingAction.status === "applied"
              ? "CONFIRMED"
              : pendingAction.status === "canceled"
                ? "CANCELED"
                : "PENDING";

          const degradedResponse: PaymentStatusResponse = {
            paymentId,
            status: persistedStatus,
            amount: null,
            dueDate: null,
            pendingActionStatus: pendingAction.status as "pending" | "applied" | "failed" | "canceled",
          };

          return new Output(true, [], [], degradedResponse);
        }
      } else {
        // Fluxo Asaas (padrão)
        // Achado Codex (PR #1137, P1): usa a conta PERSISTIDA no instante em
        // que a cobrança nasceu (pendingAction.asaasAccount) — nunca deriva
        // de pendingAction.master.asaasCustomerAccount, que pode ter mudado
        // desde então (E4, checkout de operador migra o master de conta).
        const account = pendingAction.asaasAccount ?? "primary";

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
            paymentId,
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
        wasConfirmed = payment.status === "RECEIVED" || payment.status === "CONFIRMED";
      }

      // If payment was confirmed and PendingAction is still pending, run the full apply flow
      // (creates team/user and syncs recurring subscription — not just a status update)
      let currentStatus = pendingAction.status;
      if (wasConfirmed && pendingAction.status === "pending") {
        if (isAbacatePay) {
          await pendingActionUseCase.applyPendingActionById(pendingAction.id);
        } else if (pendingAction.paymentId) {
          await pendingActionUseCase.applyPendingActionByPaymentId(
            pendingAction.paymentId,
            pendingAction.asaasAccount ?? "primary"
          );
        }
        currentStatus = "applied";
      }

      const statusResponse: PaymentStatusResponse = {
        paymentId,
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

      if (pendingAction.provider === "ABACATE_PAY" && pendingAction.providerAttemptId) {
        const attempt = await paymentProviderSessionRepository.findAttemptById(pendingAction.providerAttemptId);
        if (attempt?.status === "CONFIRMED") {
          return new Output(false, [], ["Pagamento já confirmado; a forma de pagamento não pode ser trocada"], null);
        }
      }

      if (nextBillingType === "CREDIT_CARD") {
        const withMaster = await pendingActionRepository.findById(pendingActionId);
        await assertCardChoiceAllowedForMaster(nextBillingType, withMaster?.master);
      }

      const currentPayload =(pendingAction.payload as Record<string, unknown>) || {};
      const currentBillingType = normalizeBillingType(currentPayload.billingType) ?? "PIX";
      if (currentBillingType === nextBillingType) {
        return new Output(true, ["Forma de pagamento já está atualizada"], [], {
          pendingActionId,
          billingType: nextBillingType,
        });
      }

      // Cobrança AbacatePay já criada não tem cancelamento neste fluxo: trocar deixaria o PIX antigo
      // pagável junto com o cartão. providerExternalId vem antes do paymentId (attachProviderAttempt → updatePaymentId).
      // O id "provider-…" não existe no Asaas, então não se consulta lá.
      if (pendingAction.provider === "ABACATE_PAY" && (pendingAction.paymentId || pendingAction.providerExternalId)) {
        return new Output(false, [], ["Cobrança AbacatePay já criada; a forma de pagamento não pode ser trocada"], null);
      }

      if (pendingAction.paymentId) {
        // Mesmo achado Codex (PR #1137, P2) de createPayment: a conta
        // persistida em pendingAction.asaasAccount, não o helper asaas()
        // legado (sempre primary).
        const billingTypeClient = createAsaasClient(pendingAction.asaasAccount ?? "primary");
        const payment = await billingTypeClient.request(
          `${billingTypeClient.endpoints.payments}/${pendingAction.paymentId}`
        );
        const paymentStatus = String(payment?.status ?? "PENDING");
        if (paymentStatus === "PENDING") {
          await billingTypeClient.request(
            `${billingTypeClient.endpoints.payments}/${pendingAction.paymentId}`,
            { method: "DELETE" }
          );
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
      if (error instanceof PaymentMethodUnavailableError) {
        return markedUnavailableOutput(error);
      }
      console.error("[AddOnCheckoutUseCase][updateBillingType]", error);
      return new Output(false, [], ["Erro ao atualizar forma de pagamento"], null);
    }
  }
}

export const addOnCheckoutUseCase = new AddOnCheckoutUseCase();
