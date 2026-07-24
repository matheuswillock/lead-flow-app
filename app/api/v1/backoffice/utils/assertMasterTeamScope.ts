import { prisma } from "@/app/api/infra/data/prisma"
import { Output } from "@/lib/output"

export type MasterTeamScope = {
  masterId: string
  teamId: string
  teamName: string
}

export type MasterTeamScopeResult =
  | { scope: MasterTeamScope; error?: never; status?: never }
  | { scope?: never; error: Output; status: number }

export async function assertMasterTeamScope(
  masterId: string,
  teamId: string
): Promise<MasterTeamScopeResult> {
  if (!masterId || !teamId) {
    return {
      error: new Output(false, [], ["masterId e teamId são obrigatórios"], null),
      status: 400,
    }
  }

  const [master, team] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: masterId },
      select: { id: true, isMaster: true },
    }),
    prisma.team.findFirst({
      where: { id: teamId, masterId },
      select: { id: true, name: true, masterId: true },
    }),
  ])

  if (!master || !master.isMaster) {
    return {
      error: new Output(false, [], ["Cliente master não encontrado"], null),
      status: 404,
    }
  }

  if (!team) {
    return {
      error: new Output(false, [], ["Time não encontrado ou não pertence ao cliente"], null),
      status: 404,
    }
  }

  return {
    scope: {
      masterId: master.id,
      teamId: team.id,
      teamName: team.name,
    },
  }
}
