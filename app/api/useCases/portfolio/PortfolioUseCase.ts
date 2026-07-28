import { cacheLife, cacheTag } from 'next/cache';
import { Output } from '@/lib/output';
import { cacheTags } from '@/lib/cache/cacheTags';
import { portfolioService } from '@/app/api/services/Portfolio/PortfolioService';
import { syncPortfolioToRadarInline } from '@/app/api/useCases/radar/syncPortfolioToRadarInline';
import type { IPortfolioUseCase } from './IPortfolioUseCase';
import type {
  CreatePortfolioEntryPayload,
  PortfolioDetailResult,
  PortfolioFilters,
  PortfolioListResult,
  UpdatePortfolioData,
  UpdatePortfolioDetailPayload,
} from '@/app/api/services/Portfolio/IPortfolioService';
import type { PortfolioSource, PortfolioStatus } from '@prisma/client';

async function getCachedPortfolioList(
  teamId: string,
  profileId: string,
  isManager: boolean,
  isCloser: boolean,
  search: string,
  portfolioStatuses: string,
  sdrIds: string,
  closerIds: string,
  sources: string,
  healthPlans: string,
  contractDateStart: string,
  contractDateEnd: string,
  dueDateStart: string,
  dueDateEnd: string,
  documentSearch: string,
  page: number,
  pageSize: number,
): Promise<PortfolioListResult> {
  "use cache";
  cacheTag(cacheTags.portfolio(teamId));
  cacheLife({ revalidate: 60 });

  const splitCSV = (val: string) => val ? val.split(",") : undefined;
  const parseDate = (val: string) => val ? new Date(val) : undefined;

  return portfolioService.listPortfolio({
    teamId,
    profileId,
    isManager,
    isCloser,
    search: search || undefined,
    portfolioStatuses: splitCSV(portfolioStatuses) as PortfolioStatus[] | undefined,
    sdrIds: splitCSV(sdrIds),
    closerIds: splitCSV(closerIds),
    sources: splitCSV(sources) as PortfolioSource[] | undefined,
    operadoras: splitCSV(healthPlans) as string[] | undefined,
    contractDateStart: parseDate(contractDateStart),
    contractDateEnd: parseDate(contractDateEnd),
    dueDateStart: parseDate(dueDateStart),
    dueDateEnd: parseDate(dueDateEnd),
    documentSearch: documentSearch || undefined,
    page,
    pageSize,
  });
}

async function getCachedPortfolioDetail(
  leadId: string,
  teamId: string,
  profileId: string,
  isManager: boolean,
  isCloser: boolean,
): Promise<PortfolioDetailResult> {
  "use cache";
  cacheTag(cacheTags.portfolioDetail(leadId));
  cacheTag(cacheTags.portfolio(teamId));
  cacheLife({ revalidate: 60 });

  return portfolioService.getPortfolioEntryDetail(leadId, teamId, profileId, isManager, isCloser);
}

export class PortfolioUseCase implements IPortfolioUseCase {
  async createPortfolioEntry(
    teamId: string,
    profileId: string,
    data: CreatePortfolioEntryPayload
  ): Promise<Output> {
    try {
      const result = await portfolioService.createPortfolioEntry(teamId, profileId, data);
      syncPortfolioToRadarInline(result.portfolioId, teamId);
      return new Output(true, ['Cliente adicionado na carteira com sucesso'], [], result);
    } catch (error) {
      console.error('[PortfolioUseCase] Erro ao criar cliente na carteira:', error);
      const message =
        error instanceof Error ? error.message : 'Erro ao criar cliente na carteira';
      return new Output(false, [], [message], null);
    }
  }

  async listPortfolio(filters: PortfolioFilters): Promise<Output> {
    try {
      const result = await getCachedPortfolioList(
        filters.teamId,
        filters.profileId,
        filters.isManager,
        filters.isCloser,
        filters.search ?? "",
        (filters.portfolioStatuses ?? []).join(","),
        (filters.sdrIds ?? []).join(","),
        (filters.closerIds ?? []).join(","),
        (filters.sources ?? []).join(","),
        (filters.operadoras ?? []).join(","),
        filters.contractDateStart?.toISOString() ?? "",
        filters.contractDateEnd?.toISOString() ?? "",
        filters.dueDateStart?.toISOString() ?? "",
        filters.dueDateEnd?.toISOString() ?? "",
        filters.documentSearch ?? "",
        filters.page,
        filters.pageSize,
      );
      return new Output(true, ['Carteira obtida com sucesso'], [], result);
    } catch (error) {
      console.error('[PortfolioUseCase] Erro ao listar carteira:', error);
      return new Output(false, [], ['Erro ao listar carteira'], null);
    }
  }

  async updatePortfolioEntry(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    data: UpdatePortfolioData
  ): Promise<Output> {
    try {
      const result = await portfolioService.updatePortfolioEntry(
        leadId,
        teamId,
        profileId,
        isManager,
        isCloser,
        data
      );
      syncPortfolioToRadarInline(result.portfolioId, teamId);
      return new Output(true, ['Carteira atualizada com sucesso'], [], result);
    } catch (error) {
      console.error('[PortfolioUseCase] Erro ao atualizar carteira:', error);
      const message =
        error instanceof Error ? error.message : 'Erro ao atualizar carteira';
      const status = message.includes('Acesso negado') || message.includes('não encontrada')
        ? message
        : 'Erro ao atualizar carteira';
      return new Output(false, [], [status], null);
    }
  }

  async getPortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean
  ): Promise<Output> {
    try {
      const result = await getCachedPortfolioDetail(leadId, teamId, profileId, isManager, isCloser);
      return new Output(true, ['Detalhe obtido com sucesso'], [], result);
    } catch (error) {
      console.error('[PortfolioUseCase] Erro ao buscar detalhe:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar detalhe';
      const isNotFound = message.includes('não encontrada');
      const isAccessDenied = message.includes('Acesso negado');
      return new Output(false, [], [isNotFound || isAccessDenied ? message : 'Erro ao buscar detalhe'], null);
    }
  }

  async updatePortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    payload: UpdatePortfolioDetailPayload
  ): Promise<Output> {
    try {
      const result = await portfolioService.updatePortfolioEntryDetail(
        leadId,
        teamId,
        profileId,
        isManager,
        isCloser,
        payload
      );
      syncPortfolioToRadarInline(result.portfolioId, teamId);
      return new Output(true, ['Dados atualizados com sucesso'], [], result);
    } catch (error) {
      console.error('[PortfolioUseCase] Erro ao atualizar detalhe:', error);
      const message = error instanceof Error ? error.message : 'Erro ao atualizar dados';
      const isNotFound = message.includes('não encontrada');
      const isAccessDenied = message.includes('Acesso negado');
      return new Output(false, [], [isNotFound || isAccessDenied ? message : 'Erro ao atualizar dados'], null);
    }
  }
}

export const portfolioUseCase = new PortfolioUseCase();
