import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { portfolioUseCase } from '@/app/api/useCases/portfolio/PortfolioUseCase';

const patchSchema = z.object({
  portfolioStatus: z.enum(['active', 'pending', 'canceled']).optional(),
  note: z.string().nullable().optional(),
  lastContactAt: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  console.info('[PortfolioLeadRoute][PATCH] Received request');

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const { profileId, teamId, teamMember } = teamAccess.access;
  const isManager = isManagerLikeRole(teamMember.role);
  const isCloser = teamMember.functions.includes('CLOSER');

  if (!isManager && !isCloser) {
    return NextResponse.json(
      new Output(false, [], ['Acesso negado: somente managers ou closers podem editar a carteira'], null),
      { status: 403 }
    );
  }

  const { leadId } = await params;
  const body = await request.json();

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], [parsed.error.issues[0]?.message ?? 'Dados inválidos'], null),
      { status: 400 }
    );
  }

  const { portfolioStatus, note, lastContactAt } = parsed.data;

  const result = await portfolioUseCase.updatePortfolioEntry(
    leadId,
    teamId,
    profileId,
    isManager,
    isCloser,
    {
      portfolioStatus: portfolioStatus as 'active' | 'pending' | 'canceled' | undefined,
      note,
      lastContactAt: lastContactAt === undefined ? undefined : lastContactAt === null ? null : new Date(lastContactAt),
    }
  );

  if (!result.isValid) {
    const errorMsg = result.errorMessages[0] ?? '';
    const isNotFound = errorMsg.includes('não encontrada');
    const isAccessDenied = errorMsg.includes('Acesso negado');
    const status = isNotFound ? 404 : isAccessDenied ? 403 : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
