import type { PortfolioSource, PortfolioStatus, RenewalStatus } from '@prisma/client';

export type { RenewalStatus };

export interface PortfolioFilters {
  teamId: string;
  profileId: string;
  isManager: boolean;
  isCloser: boolean;
  search?: string;
  portfolioStatuses?: PortfolioStatus[];
  sdrIds?: string[];
  closerIds?: string[];
  sources?: PortfolioSource[];
  operadoras?: string[];
  contractDateStart?: Date;
  contractDateEnd?: Date;
  dueDateStart?: Date;
  dueDateEnd?: Date;
  documentSearch?: string;
  page: number;
  pageSize: number;
}

export interface CreatePortfolioDependentPayload {
  name: string;
  birthDate: string;
  parentesco: string;
  document?: string | null;
}

export interface CreatePortfolioHolderPayload {
  name: string;
  birthDate: string;
  document: string;
  cnpj?: string | null;
}

export interface CreatePortfolioEntryPayload {
  name: string;
  email: string;
  phone: string;
  cnpj?: string | null;
  source: Exclude<PortfolioSource, 'crm'>;
  amount: number;
  startDateAt: string;
  finalizedDateAt: string;
  contractDueDate?: string | null;
  closerId: string;
  operadora: string;
  productName?: string | null;
  soldPlan?: string | null;
  notes?: string | null;
  holder: CreatePortfolioHolderPayload;
  dependents?: CreatePortfolioDependentPayload[];
}

export interface UpdatePortfolioDetailPayload {
  operadora?: string | null;
  productName?: string | null;
  amount?: number;
  startDateAt?: string;
  finalizedDateAt?: string;
  contractDueDate?: string | null;
  soldPlan?: string | null;
  notes?: string | null;
  holder?: {
    name: string;
    birthDate: string;
    document: string;
    cnpj?: string | null;
  } | null;
  dependents?: Array<{
    id?: string;
    name: string;
    birthDate: string;
    parentesco: string;
    document?: string | null;
  }>;
}

export interface UpdatePortfolioData {
  portfolioStatus?: PortfolioStatus;
  renewalStatus?: RenewalStatus;
  renewalAmount?: number | null;
  note?: string | null;
  lastContactAt?: Date | null;
}

export interface PortfolioRow {
  portfolioId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  source: PortfolioSource;
  portfolioStatus: PortfolioStatus;
  renewalStatus: RenewalStatus;
  renewalAmount: number | null;
  note: string | null;
  lastContactAt: Date | null;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  operadora: string | null;
  contractStartDate: Date | null;
  ticket: number | null;
  currentValue: number | null;
  saleValue: number;
  contractDueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioListResult {
  rows: PortfolioRow[];
  availableOperadoras: string[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export interface PortfolioDetailAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  uploaderName: string | null;
}

export interface PortfolioDetailResult {
  portfolioId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  source: PortfolioSource;
  saleValue: number;
  portfolioStatus: PortfolioStatus;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  contractDueDate: Date | null;
  contract: {
    operadora: string | null;
    productName: string | null;
    amount: number;
    startDateAt: Date;
    finalizedDateAt: Date;
    contractFileUrl: string | null;
    notes: string | null;
    closerName: string | null;
  } | null;
  holder: {
    name: string;
    birthDate: Date;
    document: string;
    cnpj: string | null;
  } | null;
  dependents: Array<{
    id: string;
    name: string;
    birthDate: Date;
    parentesco: string;
    document: string | null;
  }>;
  attachments: PortfolioDetailAttachment[];
}

export interface IPortfolioService {
  createPortfolioEntry(
    teamId: string,
    profileId: string,
    data: CreatePortfolioEntryPayload
  ): Promise<PortfolioDetailResult>;
  listPortfolio(filters: PortfolioFilters): Promise<PortfolioListResult>;
  updatePortfolioEntry(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    data: UpdatePortfolioData
  ): Promise<PortfolioRow>;
  getPortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean
  ): Promise<PortfolioDetailResult>;
  updatePortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    payload: UpdatePortfolioDetailPayload
  ): Promise<PortfolioDetailResult>;
}
