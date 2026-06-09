import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { getBillingSummary } from "@/app/api/services/billing/TeamBillingService";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";
import { asaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService";
import { createClient } from "@supabase/supabase-js";

const transferSchema = z.object({
  newMasterId: z.string().uuid(),
  password: z.string().min(1, "Senha é obrigatória"),
});

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("[Supabase Admin] Credenciais não configuradas");
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const body = await request.json();
    let payload: z.infer<typeof transferSchema>;
    try {
      payload = transferSchema.parse(body);
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => err.message) || [error.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const requesterProfile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, email: true },
    });

    if (!requesterProfile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, masterId: true },
    });

    if (!team) {
      return NextResponse.json(new Output(false, [], ["Time não encontrado"], null), { status: 404 });
    }

    if (team.masterId !== requesterProfile.id) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master atual pode transferir este time"], null),
        { status: 403 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        new Output(false, [], ["Erro ao validar senha"], null),
        { status: 500 }
      );
    }

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: requesterProfile.email,
      password: payload.password,
    });

    if (signInError) {
      return NextResponse.json(new Output(false, [], ["Senha incorreta"], null), { status: 401 });
    }

    const newMaster = await prisma.profile.findFirst({
      where: { id: payload.newMasterId },
      select: {
        id: true,
        email: true,
        fullName: true,
        cpfCnpj: true,
        phone: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        complement: true,
        neighborhood: true,
        isMaster: true,
        supabaseId: true,
        subscription: {
          select: {
            asaasCustomerId: true,
            asaasSubscriptionId: true,
            hasPermanentSubscription: true,
          },
        },
      },
    });

    if (!newMaster) {
      return NextResponse.json(new Output(false, [], ["Novo master não encontrado"], null), { status: 404 });
    }

    const newMasterSubscription = newMaster.subscription;

    if (newMaster.id === team.masterId) {
      return NextResponse.json(
        new Output(false, [], ["O novo master deve ser diferente do master atual"], null),
        { status: 400 }
      );
    }

    if (!newMaster.supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["O novo master precisa ter conta ativa"], null),
        { status: 400 }
      );
    }

    const belongsToAccount = await prisma.teamMember.findFirst({
      where: {
        profileId: newMaster.id,
        team: { masterId: team.masterId },
      },
      select: { id: true },
    });

    if (!belongsToAccount) {
      return NextResponse.json(
        new Output(false, [], ["O novo master precisa pertencer a sua conta"], null),
        { status: 400 }
      );
    }

    if (!newMasterSubscription?.hasPermanentSubscription && !newMasterSubscription?.asaasCustomerId && !newMaster.cpfCnpj) {
      return NextResponse.json(
        new Output(false, [], ["Novo master precisa ter CPF/CNPJ para criar assinatura"], null),
        { status: 400 }
      );
    }

    const oldMasterId = team.masterId;

    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: teamId },
        data: { masterId: newMaster.id },
      });

      const existingMembership = await tx.teamMember.findUnique({
        where: {
          teamId_profileId: {
            teamId,
            profileId: newMaster.id,
          },
        },
      });

      if (existingMembership) {
        await tx.teamMember.update({
          where: {
            teamId_profileId: {
              teamId,
              profileId: newMaster.id,
            },
          },
          data: { role: "manager" },
        });
      } else {
        await tx.teamMember.create({
          data: {
            teamId,
            profileId: newMaster.id,
            role: "manager",
            functions: [],
          },
        });
      }

      if (!newMaster.isMaster) {
        await tx.profile.update({
          where: { id: newMaster.id },
          data: { isMaster: true },
        });
      }

      const remainingTeams = await tx.team.count({
        where: { masterId: oldMasterId },
      });

      if (remainingTeams === 0) {
        await tx.profile.update({
          where: { id: oldMasterId },
          data: { isMaster: false },
        });
      }
    });

    const oldSummary = await getBillingSummary(oldMasterId);
    if (!oldSummary.hasPermanentSubscription && oldSummary.totalPrice >= 0) {
      const oldMasterProfile = await prisma.profile.findUnique({
        where: { id: oldMasterId },
        select: {
          subscription: {
            select: {
              asaasSubscriptionId: true,
              hasPermanentSubscription: true,
            },
          },
        },
      });

      const oldMasterSubscription = oldMasterProfile?.subscription;

      if (oldMasterSubscription?.asaasSubscriptionId && !oldMasterSubscription.hasPermanentSubscription) {
        await AsaasSubscriptionService.updateSubscription(oldMasterSubscription.asaasSubscriptionId, {
          value: oldSummary.totalPrice,
        });
      }
    }

    const newSummary = await getBillingSummary(newMaster.id);
    if (!newSummary.hasPermanentSubscription) {
      let customerId = newMasterSubscription?.asaasCustomerId ?? null;

      if (!customerId && newMaster.cpfCnpj) {
        const created = await asaasCustomerService.createCustomer({
          name: newMaster.fullName || newMaster.email,
          email: newMaster.email,
          cpfCnpj: newMaster.cpfCnpj,
          phone: newMaster.phone || undefined,
          postalCode: newMaster.postalCode || undefined,
          address: newMaster.address || undefined,
          addressNumber: newMaster.addressNumber || undefined,
          complement: newMaster.complement || undefined,
          province: newMaster.neighborhood || undefined,
          externalReference: newMaster.id,
        });

        customerId = created.customerId;
        await prisma.profileSubscription.upsert({
          where: { profileId: newMaster.id },
          create: {
            profile: { connect: { id: newMaster.id } },
            asaasCustomerId: customerId,
          },
          update: { asaasCustomerId: customerId },
        });
      }

      if (newMasterSubscription?.asaasSubscriptionId) {
        await AsaasSubscriptionService.updateSubscription(newMasterSubscription.asaasSubscriptionId, {
          value: newSummary.totalPrice,
        });
      } else if (customerId) {
        const createdSubscription = await AsaasSubscriptionService.createSubscription({
          customer: customerId,
          billingType: "BOLETO",
          cycle: "MONTHLY",
          value: newSummary.totalPrice,
          description: "Lead Flow - Plano Team",
        } as any);

        if (createdSubscription?.subscriptionId) {
          await prisma.profileSubscription.upsert({
            where: { profileId: newMaster.id },
            create: {
              profile: { connect: { id: newMaster.id } },
              asaasCustomerId: customerId,
              asaasSubscriptionId: createdSubscription.subscriptionId,
              subscriptionStatus: "active",
            },
            update: {
              asaasCustomerId: customerId,
              asaasSubscriptionId: createdSubscription.subscriptionId,
              subscriptionStatus: "active",
            },
          });
          await prisma.profile.update({
            where: { id: newMaster.id },
            data: { subscriptionId: createdSubscription.subscriptionId },
          });
        }
      }
    }

    return NextResponse.json(
      new Output(true, ["Time transferido com sucesso"], [], { teamId, newMasterId: newMaster.id }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro ao transferir time:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro interno ao transferir time"], null),
      { status: 500 }
    );
  }
}
