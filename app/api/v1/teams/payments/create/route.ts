import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasApi, asaasFetch, asaasHeaders } from "@/lib/asaas";
import { asaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";
import { getBillingSummary, BILLING_PRICES } from "@/app/api/services/billing/TeamBillingService";

const formatTeamName = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const teamName = formatTeamName(body?.name);
    const billingType = body?.billingType as string | undefined;
    const creditCard = body?.creditCard as any | undefined;

    if (!teamName || teamName.length < 2) {
      return NextResponse.json(
        new Output(false, [], ["Nome do time deve ter pelo menos 2 caracteres"], null),
        { status: 400 }
      );
    }

    if (!billingType || !["PIX", "BOLETO", "CREDIT_CARD"].includes(billingType)) {
      return NextResponse.json(
        new Output(false, [], ["Forma de pagamento invalida"], null),
        { status: 400 }
      );
    }

    if (billingType === "CREDIT_CARD" && !creditCard) {
      return NextResponse.json(
        new Output(false, [], ["Dados do cartao sao obrigatorios"], null),
        { status: 400 }
      );
    }

    const master = await prisma.profile.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        fullName: true,
        email: true,
        isMaster: true,
        hasPermanentSubscription: true,
        cpfCnpj: true,
        phone: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        complement: true,
        asaasCustomerId: true,
        subscriptionStatus: true,
      },
    });

    if (!master) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), {
        status: 404,
      });
    }

    if (!master.isMaster) {
      return NextResponse.json(new Output(false, [], ["Apenas masters podem criar times"], null), {
        status: 403,
      });
    }

    if (master.hasPermanentSubscription) {
      return NextResponse.json(
        new Output(false, [], ["Assinatura permanente ativa. Nenhum pagamento é necessário."], null),
        { status: 400 }
      );
    }

    if (!master.subscriptionStatus || master.subscriptionStatus === "canceled") {
      return NextResponse.json(
        new Output(false, [], ["Master nao possui assinatura ativa"], null),
        { status: 400 }
      );
    }

    const currentSummary = await getBillingSummary(master.id);
    const nextTeams = currentSummary.teamCount + 1;
    const nextBillableTeams = Math.max(0, nextTeams - 1);
    const nextTotal =
      currentSummary.basePrice +
      nextBillableTeams * BILLING_PRICES.extraTeam +
      currentSummary.billableUsers * BILLING_PRICES.extraUser;

    const amount = Number((nextTotal - currentSummary.totalPrice).toFixed(2));

    if (amount <= 0) {
      return NextResponse.json(
        new Output(false, [], ["Nenhuma cobrança adicional é necessária."], null),
        { status: 400 }
      );
    }

    if (!master.cpfCnpj) {
      return NextResponse.json(
        new Output(false, [], ["CPF/CNPJ do master nao informado"], null),
        { status: 400 }
      );
    }

    const pendingAction = await prisma.pendingAction.create({
      data: {
        masterId: master.id,
        actionType: "create_team",
        status: "pending",
        payload: { name: teamName },
      },
      select: { id: true },
    });

    const createCustomer = async () => {
      const customer = await asaasCustomerService.createCustomer({
        name: master.fullName || master.email,
        email: master.email,
        cpfCnpj: master.cpfCnpj || "",
        phone: master.phone || undefined,
        postalCode: master.postalCode || undefined,
        address: master.address || undefined,
        addressNumber: master.addressNumber || undefined,
        complement: master.complement || undefined,
        province: master.neighborhood || undefined,
        externalReference: master.id,
      });

      await prisma.profile.update({
        where: { id: master.id },
        data: { asaasCustomerId: customer.customerId },
      });

      return customer.customerId;
    };

    let customerId = master.asaasCustomerId;
    if (customerId) {
      const customerCheck = await fetch(`${asaasApi.customers}/${customerId}`, {
        headers: {
          ...asaasHeaders,
        },
        cache: "no-store",
      });

      if (!customerCheck.ok) {
        console.warn(
          "[POST /api/v1/teams/payments/create] Customer do master invalido no Asaas, recriando...",
          { customerId, status: customerCheck.status }
        );
        customerId = await createCustomer();
      }
    } else {
      customerId = await createCustomer();
    }

    if (billingType === "CREDIT_CARD") {
      if (!master.postalCode || !master.addressNumber || !master.phone) {
        return NextResponse.json(
          new Output(false, [], ["Dados do master incompletos para cartao"], null),
          { status: 400 }
        );
      }
    }

    const dueDate = new Date().toISOString().slice(0, 10);
    const paymentPayload: any = {
      customer: customerId,
      billingType,
      value: amount,
      dueDate,
      description: `Time adicional - ${teamName}`,
      externalReference: `pending-action-${pendingAction.id}`,
    };

    if (billingType === "CREDIT_CARD") {
      paymentPayload.creditCard = creditCard;
      paymentPayload.creditCardHolderInfo = {
        name: master.fullName || master.email,
        email: master.email,
        cpfCnpj: master.cpfCnpj,
        postalCode: master.postalCode,
        addressNumber: master.addressNumber,
        addressComplement: master.complement || null,
        phone: master.phone,
        mobilePhone: master.phone,
      };
    }

    const payment = await asaasFetch(asaasApi.payments, {
      method: "POST",
      body: JSON.stringify(paymentPayload),
    });

    await prisma.pendingAction.update({
      where: { id: pendingAction.id },
      data: { paymentId: payment.id },
    });

    const result: any = {
      pendingActionId: pendingAction.id,
      paymentId: payment.id,
      paymentStatus: payment.status || "PENDING",
      amount,
    };

    if (billingType === "PIX") {
      const pix = await AsaasSubscriptionService.getPixQrCode(payment.id);
      result.pix = {
        encodedImage: pix.encodedImage,
        payload: pix.payload,
        expirationDate: pix.expirationDate,
      };
    }

    if (billingType === "BOLETO") {
      const boletoIdentification = await AsaasSubscriptionService.getBoletoIdentificationField(payment.id);
      result.boleto = {
        bankSlipUrl: payment.bankSlipUrl || payment.invoiceUrl,
        identificationField: boletoIdentification.identificationField,
        barCode: boletoIdentification.barCode,
        dueDate: payment.dueDate,
      };
    }

    return NextResponse.json(new Output(true, ["Pagamento criado com sucesso"], [], result), {
      status: 201,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/teams/payments/create] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao criar pagamento"], null),
      { status: 500 }
    );
  }
}

