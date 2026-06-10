export type PortfolioStatusValue = 'active' | 'pending' | 'canceled';

export type RenewalStatus = 'to_renew' | 'contacted' | 'proposal' | 'renewed' | 'lost';

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  to_renew:  'A renovar',
  contacted: 'Contatado',
  proposal:  'Proposta enviada',
  renewed:   'Renovado',
  lost:      'Perdido',
};

export const OPERADORA_COLORS: Record<string, string> = {
  'Hapvida':    'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'Unimed':     'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Amil':       'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  'Bradesco':   'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'SulAmérica': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  'Porto':      'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
};

export const RENEWAL_STATUS_COLORS: Record<RenewalStatus, string> = {
  to_renew:  'bg-muted text-muted-foreground border-border',
  contacted: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  proposal:  'bg-[var(--semantic-warning-surface)] text-[var(--semantic-warning)] border-[var(--semantic-warning-border)]',
  renewed:   'bg-[var(--semantic-success-surface)] text-[var(--semantic-success)] border-[var(--semantic-success-border)]',
  lost:      'bg-[var(--semantic-danger-surface)] text-[var(--semantic-danger)] border-[var(--semantic-danger-border)]',
};
export type PortfolioSourceValue = 'crm' | 'manual' | 'brokerage_transfer';

export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatusValue, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  canceled: 'Cancelado',
};

export const PORTFOLIO_SOURCE_LABELS: Record<PortfolioSourceValue, string> = {
  crm: 'CRM',
  manual: 'Manual',
  brokerage_transfer: 'Transferência de corretagem',
};

export interface CarteiraFiltersState {
  search: string;
  portfolioStatuses: string[];
  sources: string[];
  sdrIds: string[];
  closerIds: string[];
  operadoras: string[];
  contractDateStart: string;
  contractDateEnd: string;
  dueDateStart: string;
  dueDateEnd: string;
  documentSearch: string;
  page: number;
  pageSize: number;
}

export type CarteiraTableColumnKey =
  | 'client'
  | 'operadora'
  | 'source'
  | 'contractDate'
  | 'value'
  | 'dueDate'
  | 'status'
  | 'sdr'
  | 'closer';

export const CARTEIRA_TABLE_COLUMN_OPTIONS: ReadonlyArray<{
  key: CarteiraTableColumnKey;
  label: string;
}> = [
  { key: 'client', label: 'Cliente' },
  { key: 'operadora', label: 'Operadora' },
  { key: 'source', label: 'Origem' },
  { key: 'contractDate', label: 'Data de Contrato' },
  { key: 'value', label: 'Valor' },
  { key: 'dueDate', label: 'Vencimento' },
  { key: 'status', label: 'Status' },
  { key: 'sdr', label: 'SDR' },
  { key: 'closer', label: 'Closer' },
];

export const DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY: Record<CarteiraTableColumnKey, boolean> = {
  client: true,
  operadora: true,
  source: true,
  contractDate: true,
  value: true,
  dueDate: true,
  status: true,
  sdr: true,
  closer: true,
};

export const DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER: CarteiraTableColumnKey[] = [
  'client',
  'operadora',
  'source',
  'contractDate',
  'value',
  'dueDate',
  'status',
  'sdr',
  'closer',
];

export const DEFAULT_CARTEIRA_FILTERS: CarteiraFiltersState = {
  search: '',
  portfolioStatuses: [],
  sources: [],
  sdrIds: [],
  closerIds: [],
  operadoras: [],
  contractDateStart: '',
  contractDateEnd: '',
  dueDateStart: '',
  dueDateEnd: '',
  documentSearch: '',
  page: 1,
  pageSize: 20,
};

export function isCarteiraFiltersChanged(filters: CarteiraFiltersState): boolean {
  return (
    !!filters.search ||
    filters.portfolioStatuses.length > 0 ||
    filters.sources.length > 0 ||
    filters.sdrIds.length > 0 ||
    filters.closerIds.length > 0 ||
    filters.operadoras.length > 0 ||
    !!filters.contractDateStart ||
    !!filters.contractDateEnd ||
    !!filters.dueDateStart ||
    !!filters.dueDateEnd ||
    !!filters.documentSearch
  );
}

export interface CarteiraRow {
  portfolioId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  source: PortfolioSourceValue;
  portfolioStatus: PortfolioStatusValue;
  renewalStatus: RenewalStatus;
  renewalAmount: number | null;
  note: string | null;
  lastContactAt: string | null;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  operadora: string | null;
  contractStartDate: string | null;
  ticket: number | null;
  currentValue: number | null;
  saleValue: number;
  contractDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarteiraPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface CarteiraData {
  rows: CarteiraRow[];
  availableOperadoras: string[];
  pagination: CarteiraPagination;
}

export interface UpdateCarteiraData {
  portfolioStatus?: PortfolioStatusValue;
  renewalStatus?: RenewalStatus;
  renewalAmount?: number | null;
  note?: string | null;
  lastContactAt?: string | null;
}

export interface CreateCarteiraDependentPayload {
  name: string;
  birthDate: string;
  parentesco: string;
  document?: string | null;
}

export interface CreateCarteiraIdentityStepPayload {
  name: string;
  email: string;
  phone: string;
  cnpj?: string | null;
  source: Exclude<PortfolioSourceValue, 'crm'>;
}

export interface CreateCarteiraContractStepPayload {
  amount: number;
  startDateAt: string;
  finalizedDateAt: string;
  contractDueDate?: string | null;
  closerId: string;
  operadora: string;
  productName?: string | null;
  soldPlan?: string | null;
  notes?: string | null;
  holder: {
    name: string;
    birthDate: string;
    document: string;
    cnpj?: string | null;
  };
  dependents?: CreateCarteiraDependentPayload[];
}

export interface CreatePortfolioFromStepsPayload {
  identity: CreateCarteiraIdentityStepPayload;
  contract: CreateCarteiraContractStepPayload;
}

export interface CreateCarteiraPayload {
  name: string;
  email: string;
  phone: string;
  cnpj?: string | null;
  source: Exclude<PortfolioSourceValue, 'crm'>;
  amount: number;
  startDateAt: string;
  finalizedDateAt: string;
  contractDueDate?: string | null;
  closerId: string;
  operadora: string;
  productName?: string | null;
  soldPlan?: string | null;
  notes?: string | null;
  holder: {
    name: string;
    birthDate: string;
    document: string;
    cnpj?: string | null;
  };
  dependents?: CreateCarteiraDependentPayload[];
}

export interface UpdateCarteiraDetailPayload {
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

export interface CarteiraDetailAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploaderName: string | null;
}

export interface CarteiraDetailContract {
  operadora: string | null;
  productName: string | null;
  amount: number;
  startDateAt: string;
  finalizedDateAt: string;
  contractFileUrl: string | null;
  notes: string | null;
  closerName: string | null;
}

export interface CarteiraDetailHolder {
  name: string;
  birthDate: string;
  document: string;
  cnpj: string | null;
}

export interface CarteiraDetailDependent {
  id: string;
  name: string;
  birthDate: string;
  parentesco: string;
  document: string | null;
}

export interface CarteiraDetailData {
  portfolioId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  source: PortfolioSourceValue;
  saleValue: number;
  portfolioStatus: PortfolioStatusValue;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
  soldPlan: string | null;
  contractDueDate: string | null;
  contract: CarteiraDetailContract | null;
  holder: CarteiraDetailHolder | null;
  dependents: CarteiraDetailDependent[];
  attachments: CarteiraDetailAttachment[];
}
