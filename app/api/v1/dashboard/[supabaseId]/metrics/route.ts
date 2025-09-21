import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { DashboardUseCase } from "@/app/api/useCases/dashboard/DashboardUseCase";
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

// Instâncias dos casos de uso
const leadRepository = new LeadRepository();
const dashboardUseCase = new DashboardUseCase(leadRepository, profileRepository);

/**
 * GET /api/v1/dashboard/[supabaseId]/metrics
 * Retorna métricas do dashboard para um usuário específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get('x-supabase-user-id');
    const { supabaseId } = await params;
    
    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    // Verificar se o usuário está acessando seus próprios dados
    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode acessar seus próprios dados"], null);
      return NextResponse.json(output, { status: 403 });
    }

    // Buscar métricas do dashboard
    const result = await dashboardUseCase.getDashboardMetrics(supabaseId);
    
    const status = result.isValid ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error("Erro ao buscar métricas do dashboard:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}