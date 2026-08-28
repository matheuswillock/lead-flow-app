import { Client } from "pg"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  isPgAdvisoryLockAcquired,
  resolveDispatchLockConnectionString,
  toDispatchAdvisoryLockKeys,
} from "@/lib/email/dispatch-advisory-lock"
import type {
  BackofficeInviteLockOutcome,
  BackofficeMemberAccessProfileRecord,
  IBackofficeMemberAccessRepository,
} from "./IBackofficeMemberAccessRepository"

export class BackofficeMemberAccessRepository implements IBackofficeMemberAccessRepository {
  async findProfileAccessRecord(profileId: string): Promise<BackofficeMemberAccessProfileRecord | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        fullName: true,
        role: true,
        isMaster: true,
      },
    })

    if (!profile) {
      return null
    }

    return {
      profileId: profile.id,
      supabaseId: profile.supabaseId,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      isMaster: profile.isMaster,
      managerName: await this.resolveTeamMasterName(profileId),
    }
  }

  /**
   * `managerName` no e-mail de acesso do backoffice é "quem convidou" — o MASTER do
   * time (mesma semântica de `BackofficePlatformUsersUseCase.getMasterUserDetails`),
   * não `profile.managerId` (reporte direto operador→manager dentro do time, fica
   * `null` para quem foi convidado direto pelo master — o caso mais comum). Usar
   * `profile.managerId` aqui era o motivo do assunto do e-mail cair no fallback
   * genérico "Equipe Corretor Studio" no reenvio (bug 2026-08-27).
   */
  private async resolveTeamMasterName(profileId: string): Promise<string | null> {
    const membership = await prisma.teamMember.findFirst({
      where: { profileId },
      select: {
        team: {
          select: {
            master: {
              select: { fullName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    if (!membership) {
      return null
    }

    return membership.team.master.fullName ?? membership.team.master.email ?? null
  }

  /**
   * Achado de review (PR #1090): duas requisições concorrentes para o mesmo
   * `profileId` (duplo-clique sem lock no cliente, retry de proxy) geravam
   * tokens Supabase distintos cada uma — o segundo `generateLink` invalida o
   * primeiro token mesmo que o e-mail do primeiro chegue DEPOIS na caixa de
   * entrada (ordem de entrega do provedor não é garantida: o destinatário via
   * o link mais novo na tela, mas o e-mail mais recente na caixa pode ser o
   * mais velho, já inválido). O lock serializa por `profileId`: enquanto uma
   * geração está em voo, a próxima não gera um segundo token — devolve
   * `acquired: false` para o chamador decidir (nunca reenviar por trás).
   *
   * Mesmo padrão de `EmailCampaignRepository.runWithDispatchProcessingLock` —
   * reaproveita as chaves/keys genéricas de `lib/email/dispatch-advisory-lock.ts`
   * (o hashing UUID→advisory-lock-key é agnóstico de domínio apesar do nome
   * do arquivo). Lock de SESSÃO: precisa de uma conexão dedicada
   * (`DIRECT_URL`), não do pool do Prisma/PgBouncer.
   */
  async runWithInviteLock<T>(
    profileId: string,
    work: () => Promise<T>
  ): Promise<BackofficeInviteLockOutcome<T>> {
    const [classid, objid] = toDispatchAdvisoryLockKeys(profileId)
    const client = new Client({ connectionString: resolveDispatchLockConnectionString() })
    await client.connect()
    try {
      const lockResult = await client.query<{ acquired: unknown }>(
        "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired",
        [classid, objid]
      )
      if (!isPgAdvisoryLockAcquired(lockResult.rows[0]?.acquired)) {
        return { acquired: false }
      }
      try {
        const result = await work()
        return { acquired: true, result }
      } finally {
        await client.query("SELECT pg_advisory_unlock($1::integer, $2::integer)", [
          classid,
          objid,
        ])
      }
    } finally {
      await client.end()
    }
  }
}
