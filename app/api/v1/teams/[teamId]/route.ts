import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { createClient } from "@supabase/supabase-js";
import { getBillingSummary } from "@/app/api/services/billing/TeamBillingService";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";

const updateTeamSchema = z.object({
  name: z.string().min(2, "Nome do time deve ter pelo menos 2 caracteres"),
});

const deleteTeamSchema = z.object({
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

export async function PATCH(
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
    let payload: z.infer<typeof updateTeamSchema>;
    try {
      payload = updateTeamSchema.parse(body);
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => err.message) || [error.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const requester = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!requester) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true },
    });

    if (!team) {
      return NextResponse.json(new Output(false, [], ["Time não encontrado"], null), { status: 404 });
    }

    if (team.masterId !== requester.id) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master pode editar este time"], null),
        { status: 403 }
      );
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { name: payload.name.trim() },
      select: { id: true, name: true },
    });

    return NextResponse.json(
      new Output(true, ["Time atualizado com sucesso"], [], updated),
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao atualizar time:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar time"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    let payload: z.infer<typeof deleteTeamSchema>;
    try {
      payload = deleteTeamSchema.parse(body);
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => err.message) || [error.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const requester = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, email: true, hasPermanentSubscription: true, asaasSubscriptionId: true },
    });

    if (!requester) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true, name: true },
    });

    if (!team) {
      return NextResponse.json(new Output(false, [], ["Time não encontrado"], null), { status: 404 });
    }

    if (team.masterId !== requester.id) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master pode excluir este time"], null),
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
      email: requester.email,
      password: payload.password,
    });

    if (signInError) {
      return NextResponse.json(new Output(false, [], ["Senha incorreta"], null), { status: 401 });
    }

    await prisma.team.delete({ where: { id: teamId } });

    if (!requester.hasPermanentSubscription) {
      const summary = await getBillingSummary(requester.id);
      if (requester.asaasSubscriptionId) {
        await AsaasSubscriptionService.updateSubscription(requester.asaasSubscriptionId, {
          value: summary.totalPrice,
        });
      }
    }

    return NextResponse.json(
      new Output(true, ["Time deletado com sucesso"], [], { teamId }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro ao deletar time:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro interno ao deletar time"], null),
      { status: 500 }
    );
  }
}
