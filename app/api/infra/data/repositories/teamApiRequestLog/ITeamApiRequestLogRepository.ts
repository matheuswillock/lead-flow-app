export type TeamApiRequestLogInput = {
  teamId: string;
  resourceSlug: string;
  activationId: string;
  statusCode: number;
  errorCode: string | null;
  /** Texto recebido em `date`, truncado: serve para o time ver qual dia o parceiro consultou. */
  requestedDate: string | null;
  durationMs: number;
};

export type TeamApiRequestLogRow = {
  id: string;
  statusCode: number;
  errorCode: string | null;
  requestedDate: string | null;
  durationMs: number | null;
  createdAt: Date;
};

export interface ITeamApiRequestLogRepository {
  record(input: TeamApiRequestLogInput): Promise<void>;
  listRecent(teamId: string, resourceSlug: string, limit: number): Promise<TeamApiRequestLogRow[]>;
  /** Apaga os registros anteriores ao corte e devolve quantos foram. */
  purgeOlderThan(cutoff: Date): Promise<number>;
}
