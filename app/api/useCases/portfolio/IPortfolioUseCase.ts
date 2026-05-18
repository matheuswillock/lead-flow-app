import { Output } from '@/lib/output';
import type {
  CreatePortfolioEntryPayload,
  PortfolioFilters,
  UpdatePortfolioData,
  UpdatePortfolioDetailPayload,
} from '@/app/api/services/Portfolio/IPortfolioService';

export interface IPortfolioUseCase {
  createPortfolioEntry(
    teamId: string,
    profileId: string,
    data: CreatePortfolioEntryPayload
  ): Promise<Output>;
  listPortfolio(filters: PortfolioFilters): Promise<Output>;
  updatePortfolioEntry(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    data: UpdatePortfolioData
  ): Promise<Output>;
  getPortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean
  ): Promise<Output>;
  updatePortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    payload: UpdatePortfolioDetailPayload
  ): Promise<Output>;
}
