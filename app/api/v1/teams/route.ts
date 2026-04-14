import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getBillingSummary, BILLING_PRICES } from "@/app/api/services/billing/TeamBillingService";
import { z } from "zod";
import {
  getTeamAccess,
  hasDelegatedTeamManagementAccess,
} from "@/app/api/v1/utils/teamAccess";

const CreateTeamSchema = z.object({
  name: z.string().min(2, "Nome do time deve ter pelo menos 2 caracteres"),
});

async function createTeamForAccount(args: {
  teamName: string;
  masterId: string;
  requesterProfileId: string;
  masterFunctions: ("SDR" | "CLOSER")[];
  requesterFunctions: ("SDR" | "CLOSER")[];
}) {
  const team = await prisma.team.create({
    data: {
      name: args.teamName,
      masterId: args.masterId,
      isDefault: false,
    },
  });

  await prisma.teamMember.upsert({
    where: {
      teamId_profileId: {
        teamId: team.id,
        profileId: args.masterId,
      },
    },
    update: {
      role: "manager",
    },
    create: {
      teamId: team.id,
      profileId: args.masterId,
      role: "manager",
      functions: args.masterFunctions,
    },
  });

  if (args.requesterProfileId !== args.masterId) {
    await prisma.teamMember.upsert({
      where: {
        teamId_profileId: {
          teamId: team.id,
          profileId: args.requesterProfileId,
        },
      },
      update: {
        role: "manager",
        functions: args.requesterFunctions,
      },
      create: {
        teamId: team.id,
        profileId: args.requesterProfileId,
        role: "manager",
        functions: args.requesterFunctions,
      },
    });
  }

  return team;
}

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

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { profileId, managerId, teamMember, isMaster } = teamAccess.access;
    if (!hasDelegatedTeamManagementAccess(teamAccess.access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager delegado pode criar times"], null),
        { status: 403 }
      );
    }

    const [profile, billingOwner] = await Promise.all([
      prisma.profile.findUnique({
        where: { supabaseId },
        select: { id: true, fullName: true, email: true, functions: true },
      }),
      prisma.profile.findUnique({
        where: { id: managerId },
        select: { id: true, hasPermanentSubscription: true, functions: true },
      }),
    ]);

    if (!profile || !billingOwner) {
      return NextResponse.json(
        new Output(false, [], ["Perfil não encontrado"], null),
        { status: 404 }
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

    if (billingOwner.hasPermanentSubscription) {
      const team = await createTeamForAccount({
        teamName: validatedData.name,
        masterId: managerId,
        requesterProfileId: profileId,
        masterFunctions: billingOwner.functions ?? [],
        requesterFunctions: isMaster ? profile.functions ?? [] : teamMember.functions ?? [],
      });

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso"], [], { teamId: team.id }),
        { status: 201 }
      );
    }

    const currentSummary = await getBillingSummary(managerId);
    const nextTeams = currentSummary.teamCount + 1;
    const nextBillableTeams = Math.max(0, nextTeams - 1);
    const nextTotal = currentSummary.basePrice +
      nextBillableTeams * BILLING_PRICES.extraTeam +
      currentSummary.billableUsers * BILLING_PRICES.extraUser;

    const delta = Number((nextTotal - currentSummary.totalPrice).toFixed(2));

    if (delta <= 0) {
      const team = await createTeamForAccount({
        teamName: validatedData.name,
        masterId: managerId,
        requesterProfileId: profileId,
        masterFunctions: billingOwner.functions ?? [],
        requesterFunctions: isMaster ? profile.functions ?? [] : teamMember.functions ?? [],
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
