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

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateBound(value: string | undefined, bound: 'start' | 'end'): Date | undefined {
  if (!value) return undefined;

  if (ISO_DATE_ONLY_REGEX.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const base = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (bound === 'end') {
      base.setUTCDate(base.getUTCDate() + 1);
    }
    return base;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

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
    contractDateStart: parseDateBound(contractDateStart, 'start'),
    contractDateEnd: parseDateBound(contractDateEnd, 'end'),
    dueDateStart: parseDateBound(dueDateStart, 'start'),
    dueDateEnd: parseDateBound(dueDateEnd, 'end'),
    documentSearch,
    page,
    pageSize,
  });

  return NextResponse.json(result, { status: result.isValid ? 200 : 500 });
}
