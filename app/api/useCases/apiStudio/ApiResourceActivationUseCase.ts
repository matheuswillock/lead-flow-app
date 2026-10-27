import type { ITeamApiResourceActivationRepository } from "@/app/api/infra/data/repositories/teamApiResource/ITeamApiResourceActivationRepository";
import type { ITeamApiRequestLogRepository } from "@/app/api/infra/data/repositories/teamApiRequestLog/ITeamApiRequestLogRepository";
import { Output } from "@/lib/output";
import {
  buildApiResourceTokenPreview,
  generateApiResourceToken,
  getApiStudioResource,
  hashApiResourceToken,
  type ApiStudioResourceSlug,
} from "@/lib/api-studio/resources";

type Actor = { profileId: string; teamId: string; role: string };

export type ApiResourceActivationDeps = {
  activations: ITeamApiResourceActivationRepository;
  features: { hasIntegrationFeature(teamId: string): Promise<boolean> };
  requestLogs?: Pick<ITeamApiRequestLogRepository, "listRecent">;
};

export const API_USAGE_LIST_LIMIT = 20;

/**
 * Gestão da ativação de um recurso da API Studio por time (SPEC 14, A-E1): ativar gera o token (mostrado
 * uma vez só), ativar de novo rotaciona, desativar mantém o token guardado para reativar. Só manager, e
 * só em time com a feature de Integrações.
 */
export class ApiResourceActivationUseCase {
  constructor(private readonly deps: ApiResourceActivationDeps) {}

  /** Estado do recurso no time; nunca devolve o token (só o preview). */
  async get(actor: Actor, slug: string): Promise<Output> {
    const denied = await this.guard(actor, slug);
    if (denied) return denied;
    const activation = await this.deps.activations.findByTeamAndSlug(actor.teamId, slug);
    return new Output(true, [], [], { resource: getApiStudioResource(slug), activation });
  }

  /** Últimas consultas ao recurso (SPEC 14, A-E4). Só metadados: nunca token, hash nem dado de lead. */
  async usage(actor: Actor, slug: string): Promise<Output> {
    const denied = await this.guard(actor, slug);
    if (denied) return denied;
    const rows = (await this.deps.requestLogs?.listRecent(actor.teamId, slug, API_USAGE_LIST_LIMIT)) ?? [];
    return new Output(true, [], [], {
      items: rows.map((row) => ({
        id: row.id,
        statusCode: row.statusCode,
        errorCode: row.errorCode,
        requestedDate: row.requestedDate,
        durationMs: row.durationMs,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }

  /** Ativa e gera o token; chamar de novo troca o token (o anterior deixa de valer). */
  async activate(actor: Actor, slug: string): Promise<Output> {
    const denied = await this.guard(actor, slug);
    if (denied) return denied;

    const token = generateApiResourceToken(slug as ApiStudioResourceSlug);
    const activation = await this.deps.activations.upsertActivation({
      teamId: actor.teamId,
      resourceSlug: slug,
      tokenHash: hashApiResourceToken(token),
      tokenPreview: buildApiResourceTokenPreview(token),
      profileId: actor.profileId,
    });
    // T-14.1: o token só existe nesta resposta; o GET seguinte devolve apenas o preview.
    return new Output(true, ["Recurso ativado"], [], { activation, token });
  }

  async setStatus(actor: Actor, slug: string, status: "active" | "inactive"): Promise<Output> {
    const denied = await this.guard(actor, slug);
    if (denied) return denied;
    const activation = await this.deps.activations.setStatus({
      teamId: actor.teamId,
      resourceSlug: slug,
      status,
      profileId: actor.profileId,
    });
    if (!activation) return new Output(false, [], ["Este recurso ainda não foi ativado neste time."], null);
    return new Output(true, [status === "active" ? "Recurso reativado" : "Recurso desativado"], [], { activation });
  }

  private async guard(actor: Actor, slug: string): Promise<Output | null> {
    if (!getApiStudioResource(slug)) return new Output(false, [], ["Recurso de API não encontrado."], null);
    if (actor.role !== "manager") {
      return new Output(false, [], ["Acesso negado. Apenas managers podem gerenciar recursos de API."], null);
    }
    if (!(await this.deps.features.hasIntegrationFeature(actor.teamId))) {
      return new Output(false, [], ["O time não tem acesso à API de integrações."], null);
    }
    return null;
  }
}
