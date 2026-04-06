import { Output } from '@/lib/output';
import { portfolioService } from '@/app/api/services/Portfolio/PortfolioService';
import type { IPortfolioUseCase } from './IPortfolioUseCase';
import type { PortfolioFilters, UpdatePortfolioData } from '@/app/api/services/Portfolio/IPortfolioService';

export class PortfolioUseCase implements IPortfolioUseCase {
  async listPortfolio(filters: PortfolioFilters): Promise<Output> {
    try {
      const result = await portfolioService.listPortfolio(filters);
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
}

export const portfolioUseCase = new PortfolioUseCase();
