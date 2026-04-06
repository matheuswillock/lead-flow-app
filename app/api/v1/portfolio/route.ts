import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { portfolioUseCase } from '@/app/api/useCases/portfolio/PortfolioUseCase';
import type { PortfolioFilters } from '@/app/api/services/Portfolio/IPortfolioService';

const listSchema = z.object({
  search: z.string().optional(),
  portfolioStatus: z.enum(['active', 'pending', 'canceled']).optional(),
  sdrId: z.string().uuid().optional(),
  closerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  console.info('[PortfolioRoute][GET] Received request');

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const { profileId, teamId, teamMember } = teamAccess.access;
  const isManager = isManagerLikeRole(teamMember.role);
  const isCloser = teamMember.functions.includes('CLOSER');

  if (!isManager && !isCloser) {
    return NextResponse.json(
      new Output(false, [], ['Acesso negado: somente managers ou closers podem acessar a carteira'], null),
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], [parsed.error.issues[0]?.message ?? 'Parâmetros inválidos'], null),
      { status: 400 }
    );
  }

  const { search, portfolioStatus, sdrId, closerId, page, pageSize } = parsed.data;

  const result = await portfolioUseCase.listPortfolio({
    teamId,
    profileId,
    isManager,
    isCloser,
    search,
    portfolioStatus: portfolioStatus as PortfolioFilters['portfolioStatus'],
    sdrId,
    closerId,
    page,
    pageSize,
  });

  return NextResponse.json(result, { status: result.isValid ? 200 : 500 });
}
