/**
 * Superfície mínima do repositório que o backfill de engajamento consome.
 *
 * O use case depende desta interface, não do `RadarRepository` concreto (DIP +
 * ISP, `agents.md`): `RadarRepository` tem dezenas de métodos, e tipar o
 * construtor contra a classe inteira obrigaria qualquer substituto — inclusive
 * o fake do teste — a implementar tudo ou burlar o tipo com um cast.
 */
export interface IRadarEngagementBackfillRepository {
  listProfilesForEngagementBackfill(params: {
    take: number
    cursorId?: string | null
    onlyMissingScore?: boolean
    activeSince?: Date | null
  }): Promise<Array<{ id: string; teamId: string }>>

  updateEngagementScoresBatch(profiles: Array<{ id: string; teamId: string }>): Promise<number>

  countProfilesMissingEngagementScore(): Promise<number>
}
