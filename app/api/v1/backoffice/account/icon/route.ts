import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import { profileIconService } from "@/app/api/services/profile/ProfileIconService"

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const formData = await request.formData()
    const file = formData.get("icon")
    if (!(file instanceof File)) {
      return NextResponse.json(new Output(false, [], ["Arquivo não informado"], null), {
        status: 400,
      })
    }

    const uploadResult = await profileIconService.uploadProfileIcon(
      file,
      accessResult.access.supabaseId
    )
    if (!uploadResult.success || !uploadResult.iconId || !uploadResult.publicUrl) {
      return NextResponse.json(
        new Output(false, [], [uploadResult.error || "Erro ao fazer upload da imagem"], null),
        { status: 400 }
      )
    }

    const profile = await profileRepository.updateProfileIcon(
      accessResult.access.supabaseId,
      uploadResult.iconId,
      uploadResult.publicUrl
    )
    if (!profile) {
      await profileIconService.deleteProfileIcon(uploadResult.iconId).catch((error) =>
        console.error("[BackofficeAccountIconRoute][POST][rollback]", error)
      )
      return NextResponse.json(new Output(false, [], ["Erro ao atualizar ícone"], null), {
        status: 400,
      })
    }

    return NextResponse.json(
      new Output(true, ["Ícone atualizado com sucesso"], [], {
        iconId: uploadResult.iconId,
        publicUrl: uploadResult.publicUrl,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error("[BackofficeAccountIconRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const profile = await profileRepository.findById(accessResult.access.profileId)
    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), {
        status: 404,
      })
    }

    if (profile.profileIconId) {
      const deleted = await profileIconService.deleteProfileIcon(profile.profileIconId)
      if (!deleted.success) {
        return NextResponse.json(
          new Output(false, [], [deleted.error || "Erro ao remover ícone"], null),
          { status: 400 }
        )
      }
    }

    await profileRepository.updateProfileIcon(accessResult.access.supabaseId, null, null)
    return NextResponse.json(new Output(true, ["Ícone removido com sucesso"], [], null), {
      status: 200,
    })
  } catch (error) {
    console.error("[BackofficeAccountIconRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
