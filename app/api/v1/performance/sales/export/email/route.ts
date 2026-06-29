import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { performanceUseCase, PerformanceUseCase } from '@/app/api/useCases/performance/PerformanceUseCase';
import { endOfDayInTz, parseDateKeyToUtc } from '@/lib/dates';
import { normalizeExportSections } from '@/lib/performance/exportPerformanceFiles';

const requestSchema = z
  .object({
    format: z.enum(['csv', 'excel']),
    preset: z.enum(['1d', '7d', '15d', '1m', '3m']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sdrId: z.string().uuid().optional(),
    closerId: z.string().uuid().optional(),
    search: z.string().optional(),
    sections: z
      .object({
        kpis: z.boolean().optional(),
        rankingClosers: z.boolean().optional(),
        rankingSdrs: z.boolean().optional(),
        comparison: z.boolean().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && !data.endDate) return false;
      if (!data.startDate && data.endDate) return false;
      return true;
    },
    { message: 'startDate e endDate devem ser informados juntos' }
  );

export async function POST(request: NextRequest) {
  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const { profileId, profileEmail, profileName, teamId, teamMember, userTimezone } = teamAccess.access;
  const isManager = isManagerLikeRole(teamMember.role);
  const isCloser = teamMember.functions.includes('CLOSER');
  const isSdr = teamMember.functions.includes('SDR');

  if (!isManager && !isCloser && !isSdr) {
    return NextResponse.json(
      new Output(false, [], ['Acesso negado: somente managers, closers ou SDRs podem exportar este recurso'], null),
      { status: 403 }
    );
  }

  if (!profileEmail) {
    return NextResponse.json(
      new Output(false, [], ['Seu perfil não possui e-mail válido para receber a exportação'], null),
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(new Output(false, [], ['Body inválido'], null), { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], [parsed.error.issues[0]?.message ?? 'Parâmetros inválidos'], null),
      { status: 400 }
    );
  }

  const { preset, startDate, endDate, sdrId, closerId, search, sections, format } = parsed.data;
  let resolvedStartDate: Date;
  let resolvedEndDate: Date;

  if (startDate && endDate) {
    resolvedStartDate = parseDateKeyToUtc(startDate, userTimezone);
    resolvedEndDate = endOfDayInTz(parseDateKeyToUtc(endDate, userTimezone), userTimezone);
  } else {
    const dates = PerformanceUseCase.resolvePresetToDates(preset ?? '7d', userTimezone);
    resolvedStartDate = dates.startDate;
    resolvedEndDate = dates.endDate;
  }

  const resolvedCloserId = isCloser && !isManager ? profileId : closerId;
  const resolvedSdrId = isSdr && !isManager ? profileId : sdrId;
  const presetLabel = startDate && endDate ? `${startDate}-${endDate}` : (preset ?? '7d');

  const output = await performanceUseCase.sendSalesPerformanceExportEmail({
    requesterEmail: profileEmail,
    requesterName: profileName ?? profileEmail,
    format,
    sections: normalizeExportSections(sections),
    presetLabel,
    filters: {
      teamId,
      profileId,
      isManager,
      isCloser,
      isSdr,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      sdrId: resolvedSdrId,
      closerId: resolvedCloserId,
      search,
      page: 1,
      pageSize: 100,
    },
  });

  return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
}
