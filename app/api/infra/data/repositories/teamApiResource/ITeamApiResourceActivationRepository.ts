import type { TeamApiResourceStatus } from "@prisma/client";

export type TeamApiResourceActivationRow = {
  id: string;
  teamId: string;
  resourceSlug: string;
  status: TeamApiResourceStatus;
  tokenPreview: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Linha de autenticação: inclui o que só o servidor usa para decidir (nunca sai em resposta). */
export type TeamApiResourceActivationAuthRow = TeamApiResourceActivationRow;

export interface ITeamApiResourceActivationRepository {
  /** Autenticação por token (SPEC 14, DA2): o time vem daqui, nunca da URL. */
  findByTokenHash(tokenHash: string): Promise<TeamApiResourceActivationAuthRow | null>;
  findByTeamAndSlug(teamId: string, resourceSlug: string): Promise<TeamApiResourceActivationRow | null>;
  /** Ativa (ou rotaciona o token de) um recurso do time; devolve a linha sem o hash. */
  upsertActivation(input: {
    teamId: string;
    resourceSlug: string;
    tokenHash: string;
    tokenPreview: string;
    profileId: string;
  }): Promise<TeamApiResourceActivationRow>;
  /** Liga/desliga sem apagar o token (reativar volta a aceitar o mesmo token). */
  setStatus(input: {
    teamId: string;
    resourceSlug: string;
    status: TeamApiResourceStatus;
    profileId: string;
  }): Promise<TeamApiResourceActivationRow | null>;
  touchLastUsed(activationId: string, now: Date): Promise<void>;
}
