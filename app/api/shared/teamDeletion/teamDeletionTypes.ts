import type { Output } from "@/lib/output"

/** Tabela do ZIP de exportação: um CSV por tabela. */
export type ExportTable = { fileName: string; rows: Record<string, unknown>[] }

export type TeamStorageItem = { bucket: string; path: string }

export type TeamDeletionSnapshot = {
  memberProfileIds: string[]
  leadCount: number
  memberCount: number
  storagePaths: TeamStorageItem[]
}

export interface ITeamDeletionSnapshotSource {
  /** Foto do time antes de apagar: quem são os membros, quantos leads e quais arquivos ele tem. */
  snapshot(teamId: string): Promise<TeamDeletionSnapshot>
}

export interface ITeamRemover {
  deleteTeam(teamId: string, actorProfileId: string, details: { leads: number; members: number }): Promise<Output>
}

export interface ITeamMemberFollowUp {
  handleTeamDeleted(input: { teamId: string; memberProfileIds: string[] }): Promise<unknown>
}

export interface ITeamStorageCleaner {
  removeFiles(items: TeamStorageItem[]): Promise<void>
}

export interface ITeamBillingSync {
  syncBillingAfterUsageChange(billingOwnerId: string, reason: string): Promise<void>
}

export type TeamDeletionJobStatus ="pending" | "processing" | "ready" | "failed" | "purged"

export type TeamDeletionJobRecord = {
  id: string
  teamId: string
  teamName: string
  requesterProfileId: string
  requesterEmail: string
  requesterName: string
  billingOwnerId: string
  status: TeamDeletionJobStatus
  attempts: number
  filePath: string | null
  expiresAt: Date | null
  counts: Record<string, number> | null
}

export type NewTeamDeletionJob = Pick<
  TeamDeletionJobRecord,
  "teamId" | "teamName" | "requesterProfileId" | "requesterEmail" | "requesterName" | "billingOwnerId"
>

export interface ITeamDeletionJobStore {
  create(input: NewTeamDeletionJob): Promise<TeamDeletionJobRecord>
  /** Devolve a "pending" os pedidos presos em "processing" desde antes de `olderThan`. */
  reclaimStale(olderThan: Date): Promise<number>
  /** Pega o pedido pendente mais antigo e o marca "processing" (atômico). */
  claimNext(): Promise<TeamDeletionJobRecord | null>
  markReady(
    id: string,
    input: { filePath: string; fileSizeBytes: number; expiresAt: Date; counts: Record<string, number> },
  ): Promise<void>
  markFailed(id: string, message: string): Promise<void>
  requeue(id: string, message: string): Promise<void>
  findById(id: string): Promise<TeamDeletionJobRecord | null>
  registerDownload(id: string, profileId: string, at: Date): Promise<void>
  listExpired(now: Date): Promise<TeamDeletionJobRecord[]>
  markPurged(id: string, at: Date): Promise<void>
}

export interface ITeamExportStorage {
  upload(path: string, bytes: Uint8Array): Promise<void>
  createSignedUrl(path: string, expiresInSeconds: number, downloadFileName: string): Promise<string>
  remove(path: string): Promise<void>
}

export interface ITeamDataExporter {
  /** Lê as informações do time e monta o ZIP de planilhas. `counts` = linhas por arquivo. */
  buildZip(input: { teamId: string; teamName: string; generatedAt: Date }): Promise<{
    zip: Uint8Array
    counts: Record<string, number>
  }>
}

export type TeamDeletionResult = { leads: number; members: number }

export interface ITeamDeleter {
  /** Exclui o time agora (definitivo) e trata usuários, arquivos e cobrança. Lança erro se falhar. */
  deleteNow(input: { teamId: string; actorProfileId: string; billingOwnerId: string }): Promise<TeamDeletionResult>
}

export interface ITeamDeletionDetailsSource {
  /** Nome do time e de quem pede, para o pedido de exportação (que sobrevive ao time). */
  findDetails(requesterProfileId: string, teamId: string): Promise<{ requesterName: string; teamName: string }>
  /** Perfil de quem está logado (id da conta de login -> id do perfil). */
  findProfileIdBySupabaseId(supabaseId: string): Promise<string | null>
}

export interface ITeamExportNotifier {
  notifyReady(job: TeamDeletionJobRecord, input: { expiresAt: Date }): Promise<void>
  notifyFailed(job: TeamDeletionJobRecord, reason: string): Promise<void>
}
