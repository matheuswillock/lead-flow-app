import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { portfolioUseCase } from '@/app/api/useCases/portfolio/PortfolioUseCase';
import type { PortfolioFilters } from '@/app/api/services/Portfolio/IPortfolioService';

const listSchema = z.object({
  search: z.string().optional(),
  portfolioStatuses: z.string().optional(),
  sdrIds: z.string().optional(),
  closerIds: z.string().optional(),
  operadora: z.string().optional(),
  contractDateStart: z.string().optional(),
  contractDateEnd: z.string().optional(),
  dueDateStart: z.string().optional(),
  dueDateEnd: z.string().optional(),
  documentSearch: z.string().optional(),
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

  const {
    search,
    portfolioStatuses: portfolioStatusesRaw,
    sdrIds: sdrIdsRaw,
    closerIds: closerIdsRaw,
    operadora,
    contractDateStart,
    contractDateEnd,
    dueDateStart,
    dueDateEnd,
    documentSearch,
    page,
    pageSize,
  } = parsed.data;

  const splitCSV = (val?: string) => val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  const result = await portfolioUseCase.listPortfolio({
    teamId,
    profileId,
    isManager,
    isCloser,
    search,
    portfolioStatuses: splitCSV(portfolioStatusesRaw) as PortfolioFilters['portfolioStatuses'],
    sdrIds: splitCSV(sdrIdsRaw),
    closerIds: splitCSV(closerIdsRaw),
    operadora,
    contractDateStart: contractDateStart ? new Date(contractDateStart) : undefined,
    contractDateEnd: contractDateEnd ? new Date(contractDateEnd) : undefined,
    dueDateStart: dueDateStart ? new Date(dueDateStart) : undefined,
    dueDateEnd: dueDateEnd ? new Date(dueDateEnd) : undefined,
    documentSearch,
    page,
    pageSize,
  });

  return NextResponse.json(result, { status: result.isValid ? 200 : 500 });
}
