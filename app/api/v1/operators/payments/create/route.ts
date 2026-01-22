import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import { asaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";

const OPERATOR_PRICE = 19.9;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { managerId, operatorData, billingType, creditCard } = body;

    if (!managerId || !operatorData) {
      return NextResponse.json(
        new Output(false, [], ["Dados incompletos"], null),
        { status: 400 }
      );
    }

    if (!operatorData.name || !operatorData.email) {
      return NextResponse.json(
        new Output(false, [], ["Nome e e-mail do operador sao obrigatorios"], null),
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

    const manager = await prisma.profile.findUnique({
      where: { supabaseId: managerId },
    });

    if (!manager || manager.role !== "manager") {
      return NextResponse.json(
        new Output(false, [], ["Manager nao encontrado"], null),
        { status: 404 }
      );
    }

    if (!manager.subscriptionStatus || manager.subscriptionStatus === "canceled") {
      return NextResponse.json(
        new Output(false, [], ["Manager nao possui assinatura ativa"], null),
        { status: 400 }
      );
    }

    const existingUser = await prisma.profile.findFirst({
      where: { email: operatorData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        new Output(false, [], ["Email ja esta em uso"], null),
        { status: 400 }
      );
    }

    const existingPending = await prisma.pendingOperator.findFirst({
      where: { email: operatorData.email, operatorCreated: false },
    });

    if (existingPending) {
      return NextResponse.json(
        new Output(false, [], ["Ja existe um operador pendente para este email"], null),
        { status: 400 }
      );
    }

    const pendingOperator = await prisma.pendingOperator.create({
      data: {
        managerId: manager.id,
        name: operatorData.name,
        email: operatorData.email,
        role: operatorData.role || "operator",
        paymentId: null,
        subscriptionId: null,
        paymentStatus: "PENDING",
        paymentMethod: billingType,
      },
    });

    let customerId = manager.asaasCustomerId;
    if (!customerId) {
      const customer = await asaasCustomerService.createCustomer({
        name: manager.fullName || manager.email,
        email: manager.email,
        cpfCnpj: manager.cpfCnpj || "",
        phone: manager.phone || undefined,
        postalCode: manager.postalCode || undefined,
        address: manager.address || undefined,
        addressNumber: manager.addressNumber || undefined,
        complement: manager.complement || undefined,
        province: manager.neighborhood || undefined,
        externalReference: manager.id,
      });
      customerId = customer.customerId;
      await prisma.profile.update({
        where: { id: manager.id },
        data: { asaasCustomerId: customerId },
      });
    }

    if (billingType === "CREDIT_CARD") {
      if (!manager.cpfCnpj || !manager.postalCode || !manager.addressNumber || !manager.phone) {
        return NextResponse.json(
          new Output(false, [], ["Dados do manager incompletos para cartao"], null),
          { status: 400 }
        );
      }
    }

    const dueDate = new Date().toISOString().slice(0, 10);
    const paymentPayload: any = {
      customer: customerId,
      billingType,
      value: OPERATOR_PRICE,
      dueDate,
      description: `Licenca Operador - ${operatorData.email}`,
      externalReference: `pending-operator-${pendingOperator.id}`,
    };

    if (billingType === "CREDIT_CARD") {
      paymentPayload.creditCard = creditCard;
      paymentPayload.creditCardHolderInfo = {
        name: manager.fullName || manager.email,
        email: manager.email,
        cpfCnpj: manager.cpfCnpj,
        postalCode: manager.postalCode,
        addressNumber: manager.addressNumber,
        addressComplement: manager.complement || null,
        phone: manager.phone,
        mobilePhone: manager.phone,
      };
    }

    const payment = await asaasFetch(asaasApi.payments, {
      method: "POST",
      body: JSON.stringify(paymentPayload),
    });

    await prisma.pendingOperator.update({
      where: { id: pendingOperator.id },
      data: {
        paymentId: payment.id,
        paymentStatus: payment.status || "PENDING",
      },
    });

    const result: any = {
      pendingOperatorId: pendingOperator.id,
      paymentId: payment.id,
      paymentStatus: payment.status || "PENDING",
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

    return NextResponse.json(
      new Output(true, ["Pagamento criado com sucesso"], [], result),
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/v1/operators/payments/create] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao criar pagamento"], null),
      { status: 500 }
    );
  }
}
