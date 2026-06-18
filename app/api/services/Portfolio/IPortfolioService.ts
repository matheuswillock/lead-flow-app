import type { ContractType, PortfolioSource, PortfolioStatus, RenewalStatus } from '@prisma/client';

export type { RenewalStatus, ContractType };

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
  razaoSocial?: string | null;
  birthDate: string;
  document?: string | null;
  cnpj?: string | null;
}

export interface CreatePortfolioImportEntryPayload {
  name: string;
  email?: string | null;
  phone: string;
  cnpj?: string | null;
  source: Exclude<PortfolioSource, 'crm'>;
  contractType?: ContractType;
  amount: number;
  startDateAt: Date;
  finalizedDateAt: Date;
  contractDueDate?: Date | null;
  closerId: string;
  operadora: string;
  productName?: string | null;
  notes?: string | null;
  holder?: { name: string; razaoSocial?: string | null; birthDate: Date; document: string } | null;
}

export interface PortfolioImportTarget {
  masterId: string;
}

export interface PortfolioImportConflictLead {
  id: string;
  email: string | null;
  cnpj: string | null;
}

export interface CreatePortfolioEntryPayload {
  name: string;
  email: string;
  phone: string;
  cnpj?: string | null;
  source: Exclude<PortfolioSource, 'crm'>;
  contractType: ContractType;
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
  contractType?: ContractType;
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
    razaoSocial?: string | null;
    birthDate: string;
    document?: string | null;
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

export interface PortfolioStats {
  totalClients: number;
  totalValue: number;
  activeCount: number;
  dueSoonCount: number;
}

export interface PortfolioListResult {
  rows: PortfolioRow[];
  renewals: PortfolioRow[];
  stats: PortfolioStats;
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
  contractType: ContractType;
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
    razaoSocial: string | null;
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
  getImportTarget(teamId: string, closerId: string): Promise<PortfolioImportTarget>;
  findImportConflicts(
    teamId: string,
    emails: string[],
    cnpjs: string[]
  ): Promise<PortfolioImportConflictLead[]>;
  createPortfolioEntryFromImport(
    teamId: string,
    masterId: string,
    profileId: string,
    data: CreatePortfolioImportEntryPayload
  ): Promise<string>;
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
