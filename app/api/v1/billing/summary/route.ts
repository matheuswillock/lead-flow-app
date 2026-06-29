import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getBillingSummary } from "@/app/api/services/billing/TeamBillingService";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null), { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, isMaster: true },
    });

    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    if (!profile.isMaster) {
      return NextResponse.json(new Output(false, [], ["Apenas masters podem visualizar o resumo de cobrança"], null), { status: 403 });
    }

    const summary = await getBillingSummary(profile.id);

    return NextResponse.json(new Output(true, [], [], summary), { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao buscar resumo de cobrança:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
