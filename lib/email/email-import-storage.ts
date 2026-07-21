import { createSupabaseAdmin } from "@/lib/supabase/server"

const IMPORT_BUCKET =
  process.env.SUPABASE_LEAD_ATTACHMENTS_BUCKET || "lead-attachments"

export async function uploadEmailImportPayload(
  teamId: string,
  importId: string,
  content: string,
  extension: "json" | "csv"
): Promise<string> {
  const supabase = createSupabaseAdmin()
  if (!supabase) {
    throw new Error("Falha ao inicializar cliente Supabase")
  }

  const storagePath = `email-imports/${teamId}/${importId}.${extension}`
  const contentType = extension === "json" ? "application/json" : "text/csv"
  const body = new TextEncoder().encode(content)

  const { error } = await supabase.storage.from(IMPORT_BUCKET).upload(storagePath, body, {
    contentType,
    cacheControl: "3600",
    upsert: true,
  })

  if (error) {
    console.error("[EmailImportStorage][upload]", { teamId, importId, error })
    throw new Error("Erro ao armazenar arquivo de importação")
  }

  return storagePath
}

export async function downloadEmailImportPayload(storagePath: string): Promise<string> {
  const supabase = createSupabaseAdmin()
  if (!supabase) {
    throw new Error("Falha ao inicializar cliente Supabase")
  }

  const { data, error } = await supabase.storage.from(IMPORT_BUCKET).download(storagePath)
  if (error || !data) {
    console.error("[EmailImportStorage][download]", { storagePath, error })
    throw new Error("Erro ao ler arquivo de importação")
  }

  return data.text()
}
