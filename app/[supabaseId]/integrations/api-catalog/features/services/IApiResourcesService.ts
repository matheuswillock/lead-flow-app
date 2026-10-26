export type ApiResourceActivation = {
  id: string;
  resourceSlug: string;
  status: "active" | "inactive";
  tokenPreview: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiResourceState = {
  activation: ApiResourceActivation | null;
};

export interface IApiResourcesService {
  get(supabaseId: string, teamId: string, slug: string): Promise<ApiResourceState>;
  /** Ativa ou rotaciona o token. O token só existe nesta resposta. */
  activate(supabaseId: string, teamId: string, slug: string): Promise<{ activation: ApiResourceActivation; token: string }>;
  setStatus(
    supabaseId: string,
    teamId: string,
    slug: string,
    status: "active" | "inactive",
  ): Promise<ApiResourceActivation>;
}
