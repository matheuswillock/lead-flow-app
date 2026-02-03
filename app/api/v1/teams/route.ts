import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getBillingSummary, BILLING_PRICES } from "@/app/api/services/billing/TeamBillingService";
import { z } from "zod";

const CreateTeamSchema = z.object({
  name: z.string().min(2, "Nome do time deve ter pelo menos 2 caracteres"),
});

export async function GET(request: NextRequest) {
  try {
    const supabaseIdHeader = request.headers.get("x-supabase-user-id");
    const supabaseIdLegacy = request.headers.get("supabaseid");
    const supabaseIdQuery = new URL(request.url).searchParams.get("supabaseId");
    const supabaseId = supabaseIdHeader || supabaseIdLegacy || supabaseIdQuery;

    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Supabase ID is required"], null),
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, activeTeamId: true }
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ["Profile not found"], null),
        { status: 404 }
      );
    }

    const memberships = await prisma.teamMember.findMany({
      where: { profileId: profile.id },
      include: { team: true },
      orderBy: { createdAt: "asc" }
    });

    const teams = memberships.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      masterId: membership.team.masterId,
      isDefault: membership.team.isDefault,
      role: membership.role,
      functions: membership.functions,
      membershipCreatedAt: membership.createdAt
    }));

    return NextResponse.json(
      new Output(true, [], [], { teams, activeTeamId: profile.activeTeamId }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/v1/teams:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, fullName: true, email: true, isMaster: true, hasPermanentSubscription: true, functions: true, asaasCustomerId: true },
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ["Perfil não encontrado"], null),
        { status: 404 }
      );
    }

    if (!profile.isMaster) {
      return NextResponse.json(
        new Output(false, [], ["Apenas masters podem criar times"], null),
        { status: 403 }
      );
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = CreateTeamSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    if (profile.hasPermanentSubscription) {
      const team = await prisma.team.create({
        data: {
          name: validatedData.name,
          masterId: profile.id,
          isDefault: false,
        },
      });

      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          profileId: profile.id,
          role: "manager",
          functions: profile.functions ?? [],
        },
      });

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso"], [], { teamId: team.id }),
        { status: 201 }
      );
    }

    const currentSummary = await getBillingSummary(profile.id);
    const nextTeams = currentSummary.teamCount + 1;
    const nextBillableTeams = Math.max(0, nextTeams - 1);
    const nextTotal = currentSummary.basePrice +
      nextBillableTeams * BILLING_PRICES.extraTeam +
      currentSummary.billableUsers * BILLING_PRICES.extraUser;

    const delta = Number((nextTotal - currentSummary.totalPrice).toFixed(2));

    if (delta <= 0) {
      const team = await prisma.team.create({
        data: {
          name: validatedData.name,
          masterId: profile.id,
          isDefault: false,
        },
      });

      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          profileId: profile.id,
          role: "manager",
          functions: profile.functions ?? [],
        },
      });

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso"], [], { teamId: team.id }),
        { status: 201 }
      );
    }

    return NextResponse.json(
      new Output(true, ["Pagamento necessário para criar time"], [], {
        requiresPayment: true,
        amount: delta,
        teamName: validatedData.name,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/v1/teams:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}
