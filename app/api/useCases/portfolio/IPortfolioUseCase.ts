import { Output } from '@/lib/output';
import type { PortfolioFilters, UpdatePortfolioData } from '@/app/api/services/Portfolio/IPortfolioService';

export interface IPortfolioUseCase {
  listPortfolio(filters: PortfolioFilters): Promise<Output>;
  updatePortfolioEntry(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    data: UpdatePortfolioData
  ): Promise<Output>;
}
