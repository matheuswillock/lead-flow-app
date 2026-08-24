import { cacheLife, cacheTag } from "next/cache";
import type { LeadStatus, UserFunction, UserRole } from "@prisma/client";
import { cacheTags } from "@/lib/cache/cacheTags";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type {
  CustomFieldFilterInput,
  CustomFieldSortInput,
} from "@/lib/leadCustomFields/customFieldQuery";
import { leadUseCase } from "./leadUseCaseInstance";

/**
 * Payload plano do `Output` de listagem de leads.
 *
 * Instancias de `Output` nao atravessam a fronteira de `"use cache"` — o valor
 * cacheado precisa ser serializavel. O `Output` e reconstruido pelo caller.
 */
export type CachedTeamLeadsPayload = {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: unknown;
};

/**
 * Sinaliza que a listagem falhou e que nada deve ser gravado no cache.
 *
 * Lancar e proposital: o Next so grava entrada quando a funcao `"use cache"`
 * retorna. Devolver o Output invalido congelaria o erro pelo TTL inteiro.
 */
export class CachedTeamLeadsUnavailableError extends Error {
  constructor(readonly errorMessages: string[]) {
    super(errorMessages[0] ?? "Erro interno do servidor");
    this.name = "CachedTeamLeadsUnavailableError";
  }
}

/**
 * Reconstrói o `TeamAccess` a partir de primitivos.
 *
 * `getAllLeadsByUserRoleWithCtx` lê apenas `teamId`, `profileId` e
 * `teamMember.role` — ver `leadAccessSurface.test.ts`, que trava essa premissa.
 * Passar o `TeamAccess` inteiro como argumento de cache colocaria e-mail, nome e
 * permissões na chave, fragmentando o cache por usuário sem necessidade.
 */
function rebuildAccess(teamId: string, role: string, scopeProfileId: string): TeamAccess {
  return {
    supabaseId: "",
    teamId,
    profileId: scopeProfileId,
    profileEmail: null,
    profileName: null,
    isMaster: false,
    managerId: "",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "",
    teamMember: { role: role as UserRole, functions: [] as UserFunction[] },
  };
}

async function getCachedTeamLeadsPayload(
  teamId: string,
  role: string,
  scopeProfileId: string,
  status: string,
  assignedTo: string,
  onlyTransfer: boolean,
  calendarWindowStartISO: string,
  calendarWindowEndISO: string,
  customFieldFiltersJSON: string,
  customFieldSortJSON: string
): Promise<CachedTeamLeadsPayload> {
  "use cache";
  cacheTag(cacheTags.teamLeads(teamId));
  // A variante com janela também responde pela página de calendário, que é
  // invalidada por mutações de agendamento (invalidateTeamCalendarCache).
  if (calendarWindowStartISO && calendarWindowEndISO) {
    cacheTag(cacheTags.teamCalendar(teamId));
  }
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const hasCalendarWindow = Boolean(calendarWindowStartISO && calendarWindowEndISO);
  const output = await leadUseCase.getAllLeadsByUserRoleWithCtx(
    rebuildAccess(teamId, role, scopeProfileId),
    {
      ...(status && { status: status as LeadStatus }),
      ...(assignedTo && { assignedTo }),
      ...(onlyTransfer && { onlyTransfer }),
      ...(hasCalendarWindow && {
        calendarWindowStart: new Date(calendarWindowStartISO),
        calendarWindowEnd: new Date(calendarWindowEndISO),
      }),
      ...(customFieldFiltersJSON && {
        customFieldFilters: JSON.parse(customFieldFiltersJSON) as CustomFieldFilterInput[],
      }),
      ...(customFieldSortJSON && {
        customFieldSort: JSON.parse(customFieldSortJSON) as CustomFieldSortInput,
      }),
    }
  );

  // NAO gravar falha no cache.
  //
  // `getAllLeadsByUserRoleWithCtx` engole a excecao e devolve um Output
  // invalido em vez de lancar (LeadUseCase.ts, catch de
  // getAllLeadsByUserRoleWithCtx). Retornar esse payload daqui faria o Next
  // gravar a entrada — uma queda momentanea do banco viraria board com erro
  // para o time inteiro por ate `expire`, sem mutacao nenhuma para disparar
  // revalidateTag e limpar.
  //
  // Lancando, o Next nao grava entrada e o caller decide o fallback. Mesmo
  // desenho de getCachedLandingStats/getLandingStats.
  if (!output.isValid) {
    throw new CachedTeamLeadsUnavailableError(output.errorMessages);
  }

  return {
    isValid: output.isValid,
    successMessages: output.successMessages,
    errorMessages: output.errorMessages,
    result: output.result,
  };
}

export type TeamLeadsCacheArgs = {
  teamId: string;
  /** Papel vindo do `TeamAccess`, nunca do `?role=` da query. */
  role: string;
  /**
   * `""` para papéis manager-like, que enxergam o time inteiro. É isso que
   * colapsa todos os managers de um time numa única entrada de cache.
   */
  scopeProfileId: string;
  status: string;
  assignedTo: string;
  onlyTransfer: boolean;
  calendarWindowStartISO: string;
  calendarWindowEndISO: string;
  customFieldFiltersJSON: string;
  customFieldSortJSON: string;
};

export function getCachedTeamLeads(args: TeamLeadsCacheArgs): Promise<CachedTeamLeadsPayload> {
  return getCachedTeamLeadsPayload(
    args.teamId,
    args.role,
    args.scopeProfileId,
    args.status,
    args.assignedTo,
    args.onlyTransfer,
    args.calendarWindowStartISO,
    args.calendarWindowEndISO,
    args.customFieldFiltersJSON,
    args.customFieldSortJSON
  );
}
