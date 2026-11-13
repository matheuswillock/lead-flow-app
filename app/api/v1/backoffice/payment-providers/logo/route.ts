import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { Output } from "@/lib/output"
import { SupabaseStorageService, STORAGE_BUCKETS } from "@/lib/supabase/storage"

const MAX_LOGO_SIZE = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export async function POST(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const denied = requireManagerAccess(access.access)
  if (denied) return denied

  try {
    const formData = await request.formData()
    const logo = formData.get("logo")
    if (!(logo instanceof File)) {
      return NextResponse.json(new Output(false, [], ["Selecione uma imagem para a logo."], null), { status: 400 })
    }
    if (!ALLOWED_LOGO_TYPES.has(logo.type)) {
      return NextResponse.json(new Output(false, [], ["Use uma imagem PNG, JPG ou WebP."], null), { status: 415 })
    }
    if (logo.size > MAX_LOGO_SIZE) {
      return NextResponse.json(new Output(false, [], ["A logo deve ter no máximo 2 MB."], null), { status: 413 })
    }

    const uploaded = await SupabaseStorageService.uploadFile(
      logo,
      STORAGE_BUCKETS.PAYMENT_PROVIDER_LOGOS,
      access.access.profileId,
      logo.name,
      "payment-provider-logo",
    )
    if (!uploaded.success || !uploaded.publicUrl) {
      return NextResponse.json(
        new Output(false, [], [uploaded.error ?? "Não foi possível enviar a logo."], null),
        { status: 400 },
      )
    }

    return NextResponse.json(
      new Output(true, ["Logo enviada."], [], { logoUrl: uploaded.publicUrl }),
      { status: 201 },
    )
  } catch (error) {
    console.error("[BackofficePaymentProviderLogoRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro ao enviar a logo."], null), { status: 500 })
  }
}
