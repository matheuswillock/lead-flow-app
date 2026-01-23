import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import { asaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService";
import { getFullUrl } from "@/lib/utils/app-url";

const PLAN_PRICE = 59.9;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      supabaseId,
      fullName,
      email,
      cpfCnpj,
      phone,
      postalCode,
      address,
      addressNumber,
      complement,
      province,
      city: _city,
      state: _state,
    } = body;

    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["supabaseId obrigatorio"], null), { status: 400 });
    }

    if (!fullName || !email || !cpfCnpj) {
      return NextResponse.json(new Output(false, [], ["Dados obrigatorios ausentes"], null), { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
    });

    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil nao encontrado"], null), { status: 404 });
    }

    const sanitizedCpfCnpj = String(cpfCnpj).replace(/\D/g, "");
    const sanitizedPhone = String(phone || "").replace(/\D/g, "");
    const sanitizedPostalCode = String(postalCode || "").replace(/\D/g, "");

    let customerId = profile.asaasCustomerId || null;

    if (!customerId) {
      const customer = await asaasCustomerService.createCustomer({
        name: profile.fullName || fullName,
        email: profile.email || email,
        cpfCnpj: profile.cpfCnpj || sanitizedCpfCnpj,
        phone: profile.phone || sanitizedPhone,
        postalCode: profile.postalCode || sanitizedPostalCode,
        address: profile.address || address,
        addressNumber: profile.addressNumber || addressNumber,
        complement: profile.complement || complement,
        province: profile.neighborhood || province,
        externalReference: profile.id,
      });

      customerId = customer.customerId;

      await prisma.profile.update({
        where: { id: profile.id },
        data: { asaasCustomerId: customerId },
      });
    }

    const dueDate = new Date().toISOString().slice(0, 10);
    const deleteUserUrl = getFullUrl(`/sign-up?deleteUser=${supabaseId}`);

    const payment = await asaasFetch(asaasApi.payments, {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: PLAN_PRICE,
        dueDate,
        description: "Lead Flow - Plano Manager",
        externalReference: profile.id,
        callback: {
          successUrl: getFullUrl("/checkout-return"),
          cancelUrl: deleteUserUrl,
          expiredUrl: deleteUserUrl,
          autoRedirect: true,
        },
      }),
    });

    const output = new Output(
      true,
      ["Pagamento criado com sucesso"],
      [],
      {
        invoiceUrl: payment.invoiceUrl,
        paymentId: payment.id,
      }
    );

    return NextResponse.json(output, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/v1/payments/create-card] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao criar pagamento"], null),
      { status: 500 }
    );
  }
}
