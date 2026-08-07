import { NextRequest, NextResponse, connection } from "next/server";
import { z } from 'zod';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { portfolioUseCase } from '@/app/api/useCases/portfolio/PortfolioUseCase';
import { invalidatePortfolioCache } from '@/lib/cache/invalidation';
import type { PortfolioFilters } from '@/app/api/services/Portfolio/IPortfolioService';

const dependentSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().datetime(),
  parentesco: z.string().min(1),
  document: z.string().nullish().transform((val) => val || undefined),
});

const holderSchema = z.object({
  name: z.string().min(1),
  razaoSocial: z.string().nullish().transform((val) => val || undefined),
  birthDate: z.string().datetime(),
  document: z.string().nullish().transform((val) => val || undefined),
  cnpj: z.string().nullish().transform((val) => val || undefined),
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  cnpj: z.string().nullish().transform((val) => val || undefined),
  source: z.enum(['manual', 'brokerage_transfer']),
  contractType: z.enum(['individual', 'corporate', 'adhesion']),
  amount: z.number().positive(),
  startDateAt: z.string().datetime(),
  finalizedDateAt: z.string().datetime(),
  contractDueDate: z.string().datetime().nullish().transform((val) => val || undefined),
  closerId: z.string().uuid(),
  operadora: z.string().min(1),
  productName: z.string().nullish().transform((val) => val || undefined),
  soldPlan: z.string().nullish().transform((val) => val || undefined),
  notes: z.string().nullish().transform((val) => val || undefined),
  holder: holderSchema,
  dependents: z.array(dependentSchema).optional(),
}).superRefine((data, ctx) => {
  const holderDocument = data.holder.document?.trim() ?? '';
  const holderRazaoSocial = data.holder.razaoSocial?.trim() ?? '';
  const holderCnpj = data.holder.cnpj?.trim() ?? '';

  if (data.contractType === 'corporate') {
    if (!holderRazaoSocial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A Razão Social é obrigatória para contratos empresariais',
        path: ['holder', 'razaoSocial'],
      });
    }
    if (!holderCnpj) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O CNPJ é obrigatório para contratos empresariais',
        path: ['holder', 'cnpj'],
      });
    }
    return;
  }

  if (!holderDocument) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O CPF do titular é obrigatório',
      path: ['holder', 'document'],
    });
  }
});

const listSchema = z.object({
  search: z.string().optional(),
  portfolioStatuses: z.string().optional(),
  sdrIds: z.string().optional(),
  closerIds: z.string().optional(),
  sources: z.string().optional(),
  operadoras: z.string().optional(),
  contractDateStart: z.string().optional(),
  contractDateEnd: z.string().optional(),
  dueDateStart: z.string().optional(),
  dueDateEnd: z.string().optional(),
  documentSearch: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SOURCES = new Set(['crm', 'manual', 'brokerage_transfer']);

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
  await connection();

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
    sources: sourcesRaw,
    operadoras: operadorasRaw,
    contractDateStart,
    contractDateEnd,
    dueDateStart,
    dueDateEnd,
    documentSearch,
    page,
    pageSize,
  } = parsed.data;

  const splitCSV = (val?: string) => val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const parseSources = (val?: string) => {
    const values = splitCSV(val);
    if (!values || values.length === 0) return undefined;
    return values.filter((value): value is 'crm' | 'manual' | 'brokerage_transfer' => VALID_SOURCES.has(value));
  };

  const result = await portfolioUseCase.listPortfolio({
    teamId,
    profileId,
    isManager,
    isCloser,
    search,
    portfolioStatuses: splitCSV(portfolioStatusesRaw) as PortfolioFilters['portfolioStatuses'],
    sdrIds: splitCSV(sdrIdsRaw),
    closerIds: splitCSV(closerIdsRaw),
    sources: parseSources(sourcesRaw) as PortfolioFilters['sources'],
    operadoras: splitCSV(operadorasRaw),
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

export async function POST(request: NextRequest) {
  console.info('[PortfolioRoute][POST] Received request');

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const { profileId, teamId, teamMember } = teamAccess.access;
  const isManager = isManagerLikeRole(teamMember.role);
  const isCloser = teamMember.functions.includes('CLOSER');

  if (!isManager && !isCloser) {
    return NextResponse.json(
      new Output(false, [], ['Acesso negado: somente managers ou closers podem adicionar clientes na carteira'], null),
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], [parsed.error.issues[0]?.message ?? 'Dados inválidos'], null),
      { status: 400 }
    );
  }

  const result = await portfolioUseCase.createPortfolioEntry(teamId, profileId, parsed.data);
  if (!result.isValid) {
    const message = result.errorMessages[0] ?? '';
    const status = message.includes('Acesso negado') ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  invalidatePortfolioCache({ teamId });
  return NextResponse.json(result, { status: 201 });
}
