import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateTeamFormDomainInput,
  ITeamFormDomainRepository,
  SaveTeamFormDomainCheckInput,
  TeamFormDomainRecord,
} from "./ITeamFormDomainRepository"

const TEAM_FORM_DOMAIN_SELECT = {
  id: true,
  teamId: true,
  hostname: true,
  status: true,
  vercelDomainId: true,
  verifiedAt: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Persistência do domínio de formulários do time
 * (`corretor_studio_team_form_domains`). Sem HTTP aqui — quem fala com a
 * Vercel é o `IVercelDomainsGateway`, orquestrado pelo UseCase.
 */
export class TeamFormDomainRepository implements ITeamFormDomainRepository {
  async findByTeamId(teamId: string): Promise<TeamFormDomainRecord | null> {
    return prisma.teamFormDomain.findUnique({
      where: { teamId },
      select: TEAM_FORM_DOMAIN_SELECT,
    })
  }

  async findByHostname(hostname: string): Promise<TeamFormDomainRecord | null> {
    return prisma.teamFormDomain.findUnique({
      where: { hostname },
      select: TEAM_FORM_DOMAIN_SELECT,
    })
  }

  async create(input: CreateTeamFormDomainInput): Promise<TeamFormDomainRecord> {
    return prisma.teamFormDomain.create({
      data: {
        teamId: input.teamId,
        hostname: input.hostname,
        vercelDomainId: input.vercelDomainId ?? null,
      },
      select: TEAM_FORM_DOMAIN_SELECT,
    })
  }

  async saveCheckResult(
    id: string,
    input: SaveTeamFormDomainCheckInput,
  ): Promise<TeamFormDomainRecord> {
    return prisma.teamFormDomain.update({
      where: { id },
      data: {
        status: input.status,
        lastCheckedAt: input.lastCheckedAt,
        ...(input.verifiedAt !== undefined ? { verifiedAt: input.verifiedAt } : {}),
      },
      select: TEAM_FORM_DOMAIN_SELECT,
    })
  }

  async deleteById(id: string): Promise<void> {
    await prisma.teamFormDomain.delete({ where: { id } })
  }

  /**
   * Todos os status entram na reconciliação — inclusive `verified`. Sem isso
   * um domínio verificado cuja infraestrutura sumiu (CNAME removido, domínio
   * apagado na Vercel) nunca seria rebaixado, e o disparo continuaria
   * reescrevendo links para um host que não resolve mais.
   *
   * `lastCheckedAt asc nulls first` mantém a prioridade natural: domínio
   * recém-conectado (`lastCheckedAt` nulo) vem antes de um verificado que
   * acabou de ser checado — verificado não rouba o lote de quem está
   * esperando a primeira checagem.
   */
  async listForReconciliation(limit: number): Promise<TeamFormDomainRecord[]> {
    return prisma.teamFormDomain.findMany({
      where: { status: { in: ["pending", "failed", "verified"] } },
      orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
      take: limit,
      select: TEAM_FORM_DOMAIN_SELECT,
    })
  }
}

export const teamFormDomainRepository = new TeamFormDomainRepository()
