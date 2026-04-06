import type { PortfolioStatus } from '@prisma/client';

export interface PortfolioFilters {
  teamId: string;
  profileId: string;
  isManager: boolean;
  isCloser: boolean;
  search?: string;
  portfolioStatus?: PortfolioStatus;
  sdrId?: string;
  closerId?: string;
  page: number;
  pageSize: number;
}

export interface UpdatePortfolioData {
  portfolioStatus?: PortfolioStatus;
  note?: string | null;
  lastContactAt?: Date | null;
}

export interface PortfolioRow {
  portfolioId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  portfolioStatus: PortfolioStatus;
  note: string | null;
  lastContactAt: Date | null;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  ticket: number | null;
  currentValue: number | null;
  saleValue: number;
  contractDueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioListResult {
  rows: PortfolioRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export interface IPortfolioService {
  listPortfolio(filters: PortfolioFilters): Promise<PortfolioListResult>;
  updatePortfolioEntry(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    data: UpdatePortfolioData
  ): Promise<PortfolioRow>;
}
