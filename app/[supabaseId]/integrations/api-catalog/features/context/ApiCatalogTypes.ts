import type { ApiResourceActivation } from "../services/IApiResourcesService";

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
};
