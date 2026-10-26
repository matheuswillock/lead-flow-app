import type { ITeamApiResourceActivationRepository } from "@/app/api/infra/data/repositories/teamApiResource/ITeamApiResourceActivationRepository";
import { Output } from "@/lib/output";
import { API_STUDIO_RESOURCES, hashApiResourceToken } from "@/lib/api-studio/resources";
import { addDaysInTz, formatIntimezone, formatLocalDateValue, getDayRangeInTz } from "@/lib/dates";

/** Horários de hoje só a partir de agora + 5 minutos (contrato do guia). */
const MIN_LEAD_TIME_MS = 5 * 60 * 1000;
/** A data aceita vai de hoje até hoje + 180 dias (a mesma janela do agendamento). */
const MAX_DAYS_AHEAD = 180;
const OFFSET_PATTERN = "yyyy-MM-dd'T'HH:mm:ssXXX";

export type AvailabilityApiError = {
  kind: "error";
  status: 400 | 401 | 403 | 429;
  code:
    | "unauthorized"
    | "resource_inactive"
    | "feature_unavailable"
    | "account_restricted"
    | "rate_limited"
    | "invalid_date"
    | "date_out_of_range";
  message: string;
  retryAfterSeconds?: number;
};

export type AvailabilityApiBody = {
  date: string;
  timezone: string;
  slot_minutes: number;
  closers: Array<{
    closer_id: string;
    name: string;
    slots: Array<{ starts_at: string; ends_at: string }>;
  }>;
  generated_at: string;
};

export type AvailabilityApiResult = { kind: "ok"; body: AvailabilityApiBody } | AvailabilityApiError;

export type ApiStudioAvailabilityDeps = {
  activations: Pick<ITeamApiResourceActivationRepository, "findByTokenHash" | "touchLastUsed">;
  features: { hasIntegrationFeature(teamId: string): Promise<boolean> };
  teams: {
    isAccountAllowed(teamId: string): Promise<boolean>;
    getTimezone(teamId: string): Promise<string>;
  };
  closers: { listActiveClosers(teamId: string): Promise<Array<{ profileId: string; fullName: string | null }>> };
  availability: {
    getDay(input: {
      teamId: string;
      closerIds: string[];
      date: string;
      timezone: string;
    }): Promise<{ durationMinutes: number; perCloser: Record<string, string[]> }>;
  };
  limiter: { consume(key: string, options: { limit: number; windowMs: number }): Promise<{ allowed: boolean; retryAfterSeconds: number }> };
  now?: () => Date;
};

/**
 * Recurso "Horários disponíveis" da API Studio (SPEC 14, DA2 a DA5).
 *
 * O time vem do token, nunca da URL. Ordem: autenticação → recurso ativo → feature → conta → limite do
 * token → validação da data → cálculo. A resposta traz só id e nome do closer e intervalos livres.
 */
export class ApiStudioAvailabilityUseCase {
  private readonly now: () => Date;

  constructor(private readonly deps: ApiStudioAvailabilityDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** `result` é um `AvailabilityApiResult`; `isValid` só no sucesso. */
  async execute(input: { token: string; date: string | null }): Promise<Output> {
    const result = await this.resolve(input);
    return new Output(result.kind === "ok", [], result.kind === "ok" ? [] : [result.code], result);
  }

  private fail(
    status: AvailabilityApiError["status"],
    code: AvailabilityApiError["code"],
    message: string,
    retryAfterSeconds?: number,
  ): AvailabilityApiError {
    return { kind: "error", status, code, message, retryAfterSeconds };
  }

  private async resolve(input: { token: string; date: string | null }): Promise<AvailabilityApiResult> {
    // Token de outro recurso, inexistente ou revogado: 401 idêntico, sem confirmar que o token existe.
    const activation = await this.deps.activations.findByTokenHash(hashApiResourceToken(input.token));
    if (!activation || activation.resourceSlug !== API_STUDIO_RESOURCES.availability.slug) {
      return this.fail(401, "unauthorized", "Token ausente ou inválido.");
    }
    if (activation.status !== "active") {
      return this.fail(403, "resource_inactive", "A API de horários está desativada para este time.");
    }

    const teamId = activation.teamId;
    if (!(await this.deps.features.hasIntegrationFeature(teamId))) {
      return this.fail(403, "feature_unavailable", "O time não tem acesso à API de integrações.");
    }
    if (!(await this.deps.teams.isAccountAllowed(teamId))) {
      return this.fail(403, "account_restricted", "O acesso desta conta está pausado.");
    }

    const limit = await this.deps.limiter.consume(
      `api:res:${activation.id}`,
      API_STUDIO_RESOURCES.availability.rateLimit,
    );
    if (!limit.allowed) {
      return this.fail(429, "rate_limited", "Limite de consultas por minuto atingido.", limit.retryAfterSeconds);
    }

    const timezone = await this.deps.teams.getTimezone(teamId);
    const now = this.now();

    const dateError = this.validateDate(input.date, now, timezone);
    if (dateError) return dateError;
    const date = input.date as string;

    const closers = await this.deps.closers.listActiveClosers(teamId);
    const availability = closers.length
      ? await this.deps.availability.getDay({ teamId, closerIds: closers.map((closer) => closer.profileId), date, timezone })
      : { durationMinutes: 30, perCloser: {} as Record<string, string[]> };

    const dayStart = getDayRangeInTz(date, timezone).start.getTime();
    const earliest = now.getTime() + MIN_LEAD_TIME_MS;
    const durationMs = availability.durationMinutes * 60 * 1000;

    const body: AvailabilityApiBody = {
      date,
      timezone,
      slot_minutes: availability.durationMinutes,
      closers: closers.map((closer) => ({
        closer_id: closer.profileId,
        name: closer.fullName ?? "",
        slots: (availability.perCloser[closer.profileId] ?? [])
          .map((time) => {
            const [hours, minutes] = time.split(":").map(Number);
            return dayStart + (hours * 60 + minutes) * 60 * 1000;
          })
          .filter((startsAtMs) => startsAtMs >= earliest)
          .map((startsAtMs) => ({
            starts_at: formatIntimezone(new Date(startsAtMs), OFFSET_PATTERN, timezone),
            ends_at: formatIntimezone(new Date(startsAtMs + durationMs), OFFSET_PATTERN, timezone),
          })),
      })),
      generated_at: formatIntimezone(now, OFFSET_PATTERN, timezone),
    };

    // Observabilidade de uso; falhar aqui nunca impede a resposta.
    void this.deps.activations.touchLastUsed(activation.id, now).catch(() => undefined);

    return { kind: "ok", body };
  }

  private validateDate(date: string | null, now: Date, timezone: string): AvailabilityApiError | null {
    const invalid = this.fail(400, "invalid_date", "Informe a data no formato AAAA-MM-DD.");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return invalid;
    // Data impossível (2026-02-31) é inválida; não deixa o JS rolar para março.
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return invalid;

    const todayKey = formatLocalDateValue(now, timezone);
    const maxKey = formatLocalDateValue(addDaysInTz(now, MAX_DAYS_AHEAD, timezone), timezone);
    if (date < todayKey || date > maxKey) {
      return this.fail(400, "date_out_of_range", "A data deve estar entre hoje e 180 dias à frente.");
    }
    return null;
  }
}
