import { createSupabaseAdmin } from "@/lib/supabase/server"
import type {
  ITeamExportStorage,
  ITeamStorageCleaner,
  TeamStorageItem,
} from "@/app/api/shared/teamDeletion/teamDeletionTypes"

/** Bucket privado do arquivo da exportação (criado por migration). Só URL assinada de curta duração dá acesso. */
export const TEAM_EXPORTS_BUCKET = process.env.SUPABASE_TEAM_EXPORTS_BUCKET || "team-exports"
const REMOVE_CHUNK_SIZE = 100

function adminClient() {
  const client = createSupabaseAdmin()
  if (!client) throw new Error("Credenciais administrativas do Supabase não configuradas")
  return client
}

/** Armazenamento do ZIP da exportação: guardar, gerar link curto de download e apagar. */
export class TeamExportStorage implements ITeamExportStorage {
  async upload(path: string, bytes: Uint8Array): Promise<void> {
    const { error } = await adminClient().storage.from(TEAM_EXPORTS_BUCKET).upload(path, bytes, {
      contentType: "application/zip",
      upsert: true,
    })
    if (error) throw new Error(`Falha ao guardar o arquivo da exportação: ${error.message}`)
  }

  async createSignedUrl(path: string, expiresInSeconds: number, downloadFileName: string): Promise<string> {
    const { data, error } = await adminClient()
      .storage.from(TEAM_EXPORTS_BUCKET)
      .createSignedUrl(path, expiresInSeconds, { download: downloadFileName })
    if (error || !data?.signedUrl) throw new Error(`Falha ao gerar o link de download: ${error?.message ?? "sem link"}`)
    return data.signedUrl
  }

  async remove(path: string): Promise<void> {
    const { error } = await adminClient().storage.from(TEAM_EXPORTS_BUCKET).remove([path])
    if (error) throw new Error(`Falha ao apagar o arquivo da exportação: ${error.message}`)
  }
}

/** Apaga do armazenamento os arquivos de um time excluído (anexos e contratos dos leads). */
export class TeamStorageCleaner implements ITeamStorageCleaner {
  async removeFiles(items: TeamStorageItem[]): Promise<void> {
    if (items.length === 0) return
    const client = adminClient()
    const byBucket = new Map<string, string[]>()
    for (const item of items) byBucket.set(item.bucket, [...(byBucket.get(item.bucket) ?? []), item.path])

    for (const [bucket, paths] of byBucket) {
      for (let index = 0; index < paths.length; index += REMOVE_CHUNK_SIZE) {
        const { error } = await client.storage.from(bucket).remove(paths.slice(index, index + REMOVE_CHUNK_SIZE))
        if (error) throw new Error(`Falha ao apagar arquivos de ${bucket}: ${error.message}`)
      }
    }
  }
}

export const teamExportStorage = new TeamExportStorage()
export const teamStorageCleaner = new TeamStorageCleaner()
