import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { portfolioUseCase } from '@/app/api/useCases/portfolio/PortfolioUseCase';

const dependentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  birthDate: z.string(),
  parentesco: z.string().min(1),
  document: z.string().nullable().optional(),
});

const holderSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string(),
  document: z.string().min(1),
  cnpj: z.string().nullable().optional(),
});

const updateDetailSchema = z.object({
  operadora: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  startDateAt: z.string().optional(),
  finalizedDateAt: z.string().optional(),
  contractDueDate: z.string().nullable().optional(),
  soldPlan: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  holder: holderSchema.nullable().optional(),
  dependents: z.array(dependentSchema).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  console.info('[PortfolioLeadDetailRoute][GET] Received request');

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

  const { leadId } = await params;

  const result = await portfolioUseCase.getPortfolioEntryDetail(
    leadId,
    teamId,
    profileId,
    isManager,
    isCloser
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  console.info('[PortfolioLeadDetailRoute][PATCH] Received request');

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
  const parsed = updateDetailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], [parsed.error.issues[0]?.message ?? 'Dados inválidos'], null),
      { status: 400 }
    );
  }

  const result = await portfolioUseCase.updatePortfolioEntryDetail(
    leadId,
    teamId,
    profileId,
    isManager,
    isCloser,
    parsed.data
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
