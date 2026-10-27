export type ApiResourceActivation = {
  id: string;
  resourceSlug: string;
  status: "active" | "inactive";
  tokenPreview: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Uma consulta ao recurso: só metadados, nunca o token. */
export type ApiResourceUsageItem = {
  id: string;
  statusCode: number;
  errorCode: string | null;
  requestedDate: string | null;
  durationMs: number | null;
  createdAt: string;
};

export type ApiResourceState = {
  activation: ApiResourceActivation | null;
};

export interface IApiResourcesService {
  get(supabaseId: string, teamId: string, slug: string): Promise<ApiResourceState>;
  /** Ativa ou rotaciona o token. O token só existe nesta resposta. */
  activate(supabaseId: string, teamId: string, slug: string): Promise<{ activation: ApiResourceActivation; token: string }>;
  /** Últimas consultas do time ao recurso (SPEC 14, A-E4). */
  usage(supabaseId: string, teamId: string, slug: string): Promise<ApiResourceUsageItem[]>;
  setStatus(
    supabaseId: string,
    teamId: string,
    slug: string,
    status: "active" | "inactive",
  ): Promise<ApiResourceActivation>;
}
