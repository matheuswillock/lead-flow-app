import { cacheLife, cacheTag } from 'next/cache';
import { Output } from '@/lib/output';
import { cacheTags } from '@/lib/cache/cacheTags';
import { performanceService } from '@/app/api/services/Performance/PerformanceService';
import { createEmailService } from '@/lib/email/create-email-service';
import {
  buildCsvFiles,
  buildExcelFile,
  buildZipBufferFromFiles,
  normalizeExportSections,
} from '@/lib/performance/exportPerformanceFiles';
import type { IPerformanceUseCase, SendPerformanceExportEmailInput } from './IPerformanceUseCase';
import type { PerformanceSalesFilters, PerformanceSalesResult } from '@/app/api/services/Performance/IPerformanceService';

async function getCachedSalesPerformance(
  teamId: string,
  teamIdsJSON: string,
  profileId: string,
  isManager: boolean,
  isCloser: boolean,
  isSdr: boolean,
  startDateISO: string,
  endDateISO: string,
  sdrId: string,
  closerId: string,
  search: string,
  page: number,
  pageSize: number,
): Promise<PerformanceSalesResult> {
  "use cache";
  const teamIds: string[] = JSON.parse(teamIdsJSON);
  if (teamIds.length > 1) {
    cacheTag(cacheTags.teamPerformance(teamIds.join(',')));
  } else {
    cacheTag(cacheTags.teamPerformance(teamId));
  }
  cacheLife({ stale: 60, revalidate: 180, expire: 300 });

  return performanceService.getSalesPerformance({
    teamId,
    teamIds,
    profileId,
    isManager,
    isCloser,
    isSdr,
    startDate: new Date(startDateISO),
    endDate: new Date(endDateISO),
    sdrId: sdrId || undefined,
    closerId: closerId || undefined,
    search: search || undefined,
    page,
    pageSize,
  });
}
import { addDaysInTz, endOfDayInTz, startOfDayInTz, DEFAULT_TZ } from '@/lib/dates';

export class PerformanceUseCase implements IPerformanceUseCase {
  static resolvePresetToDates(preset: string, tz: string = DEFAULT_TZ): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = endOfDayInTz(now, tz);
    let startDate: Date;
    switch (preset) {
      case '1d':
        startDate = startOfDayInTz(addDaysInTz(now, -1, tz), tz);
        break;
      case '7d':
        startDate = startOfDayInTz(addDaysInTz(now, -7, tz), tz);
        break;
      case '15d':
        startDate = startOfDayInTz(addDaysInTz(now, -15, tz), tz);
        break;
      case '3m':
        startDate = startOfDayInTz(addDaysInTz(now, -90, tz), tz);
        break;
      case '1m':
      default:
        startDate = startOfDayInTz(addDaysInTz(now, -30, tz), tz);
    }
    return { startDate, endDate };
  }

  async getSalesPerformance(filters: PerformanceSalesFilters): Promise<Output> {
    try {
      const teamIds = filters.teamIds ?? [filters.teamId];
      const result = await getCachedSalesPerformance(
        filters.teamId,
        JSON.stringify(teamIds),
        filters.profileId,
        filters.isManager,
        filters.isCloser,
        filters.isSdr,
        filters.startDate.toISOString(),
        filters.endDate.toISOString(),
        filters.sdrId ?? "",
        filters.closerId ?? "",
        filters.search ?? "",
        filters.page,
        filters.pageSize,
      );
      return new Output(true, ['Performance de vendas obtida com sucesso'], [], result);
    } catch (error) {
      console.error('[PerformanceUseCase] Erro ao buscar performance de vendas:', error);
      return new Output(false, [], ['Erro ao buscar performance de vendas'], null);
    }
  }

  async sendSalesPerformanceExportEmail(input: SendPerformanceExportEmailInput): Promise<Output> {
    try {
      const sections = normalizeExportSections(input.sections);
      const selectedCount = Object.values(sections).filter(Boolean).length;
      if (selectedCount === 0) {
        return new Output(false, [], ['Selecione ao menos uma seção para exportar'], null);
      }

      const data = await performanceService.getSalesPerformance(input.filters);
      const files =
        input.format === 'excel'
          ? [buildExcelFile(data, sections)]
          : buildCsvFiles(data, sections);

      const zipData = await buildZipBufferFromFiles(files);
      const today = new Date();
      const dateTag = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const zipFileName = `performance-${input.presetLabel}-${dateTag}.zip`;
      const emailService = createEmailService();

      const sendResult = await emailService.sendEmail({
        to: [input.requesterEmail],
        subject: `Relatório de Performance (${input.presetLabel})`,
        html: `
          <p>Olá, ${input.requesterName}.</p>
          <p>Seu relatório de performance foi gerado com sucesso.</p>
          <p>O arquivo zipado está anexado neste e-mail.</p>
        `,
        text: `Olá, ${input.requesterName}. Seu relatório de performance foi gerado com sucesso. O arquivo zipado está anexado neste e-mail.`,
        attachments: [
          {
            filename: zipFileName,
            content: Buffer.from(zipData),
            contentType: 'application/zip',
          },
        ],
        tracking: {
          teamId: input.filters.teamId,
          category: "transactional",
          sourceType: "performance_export",
        },
      });

      if (!sendResult.success) {
        return new Output(false, [], [sendResult.error || 'Erro ao enviar relatório por e-mail'], null);
      }

      return new Output(true, ['Relatório enviado por e-mail com sucesso'], [], null);
    } catch (error) {
      console.error('[PerformanceUseCase] Erro ao enviar exportação por e-mail:', error);
      return new Output(false, [], ['Erro ao enviar exportação por e-mail'], null);
    }
  }
}

export const performanceUseCase = new PerformanceUseCase();
