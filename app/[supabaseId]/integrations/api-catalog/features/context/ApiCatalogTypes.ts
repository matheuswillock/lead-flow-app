import type { ApiResourceActivation, ApiResourceUsageItem } from "../services/IApiResourcesService";

export type ApiCatalogState = {
  supabaseId: string;
  loading: boolean;
  error: string | null;
  activation: ApiResourceActivation | null;
  /** Token recém-gerado. Fica só na memória desta tela; some ao sair ou ao dispensar. */
  revealedToken: string | null;
  pending: boolean;
  activate: () => Promise<void>;
  toggleStatus: () => Promise<void>;
  dismissToken: () => void;
  reload: () => Promise<void>;
  /** Últimas consultas do parceiro ao recurso (SPEC 14, A-E4). */
  usage: ApiResourceUsageItem[];
  usageLoading: boolean;
  usageError: string | null;
  reloadUsage: () => Promise<void>;
};
