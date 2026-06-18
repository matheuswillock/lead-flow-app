import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { SupabaseStorageService, STORAGE_BUCKETS } from "@/lib/supabase/storage"

export async function POST(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireMasterAccess(access.access)
    if (denied) return denied

    const formData = await request.formData()
    const file = formData.get("icon")
    if (!(file instanceof File)) {
      return NextResponse.json(new Output(false, [], ["Arquivo não informado"], null), { status: 400 })
    }

    const uploaded = await SupabaseStorageService.uploadFile(
      file,
      STORAGE_BUCKETS.PROFILE_ICONS,
      access.access.profileId,
      file.name,
      "health-plan"
    )

    if (!uploaded.success || !uploaded.publicUrl) {
      return NextResponse.json(new Output(false, [], [uploaded.error ?? "Erro ao fazer upload do ícone"], null), {
        status: 400,
      })
    }

    return NextResponse.json(
      new Output(true, ["Ícone enviado com sucesso"], [], {
        iconUrl: uploaded.publicUrl,
        fileId: uploaded.fileId,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error("[BackofficeHealthPlanIconUploadRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
