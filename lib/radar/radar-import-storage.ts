import { createSupabaseAdmin } from "@/lib/supabase/server"

const IMPORT_BUCKET =
  process.env.SUPABASE_LEAD_ATTACHMENTS_BUCKET || "lead-attachments"

export async function uploadRadarImportPayload(
  teamId: string,
  importId: string,
  content: string
): Promise<string> {
  const supabase = createSupabaseAdmin()
  if (!supabase) {
    throw new Error("Falha ao inicializar cliente Supabase")
  }

  const storagePath = `radar-imports/${teamId}/${importId}.json`
  const body = new TextEncoder().encode(content)

  const { error } = await supabase.storage.from(IMPORT_BUCKET).upload(storagePath, body, {
    contentType: "application/json",
    cacheControl: "3600",
    upsert: true,
  })

  if (error) {
    console.error("[RadarImportStorage][upload]", { teamId, importId, error })
    throw new Error("Erro ao armazenar arquivo de importação")
  }

  return storagePath
}

export async function downloadRadarImportPayload(storagePath: string): Promise<string> {
  const supabase = createSupabaseAdmin()
  if (!supabase) {
    throw new Error("Falha ao inicializar cliente Supabase")
  }

  const { data, error } = await supabase.storage.from(IMPORT_BUCKET).download(storagePath)
  if (error || !data) {
    console.error("[RadarImportStorage][download]", { storagePath, error })
    throw new Error("Erro ao ler arquivo de importação")
  }

  return data.text()
}
