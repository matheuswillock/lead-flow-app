import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerLikeRole } from "@/lib/roles"
import { SupabaseStorageService, STORAGE_BUCKETS } from "@/lib/supabase/storage"
import {
  buildEmailTemplateAssetPublicUrl,
} from "@/lib/email/email-template-assets-url"
import type { EmailTemplateAssetItem } from "@/lib/email/email-template-assets"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem enviar imagens de template"], null),
        { status: 403 }
      )
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json(new Output(false, [], ["Dados do formulário inválidos"], null), {
        status: 400,
      })
    }

    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json(new Output(false, [], ["Arquivo de imagem é obrigatório"], null), {
        status: 400,
      })
    }

    const teamId = teamAccess.access.teamId
    const uploaded = await SupabaseStorageService.uploadFile(
      file,
      STORAGE_BUCKETS.EMAIL_TEMPLATE_ASSETS,
      teamId,
      file.name,
      "asset"
    )

    if (!uploaded.success || !uploaded.fileId || !uploaded.publicUrl) {
      return NextResponse.json(
        new Output(false, [], [uploaded.error ?? "Erro ao fazer upload da imagem"], null),
        { status: 400 }
      )
    }

    return NextResponse.json(
      new Output(true, ["Imagem enviada com sucesso"], [], {
        fileId: uploaded.fileId,
        fileName: file.name,
        publicUrl: uploaded.publicUrl,
      }),
      { status: 200 }
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailTemplateAssetsUploadRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao enviar imagem"], null), {
      status: 500,
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem listar imagens de template"], null),
        { status: 403 }
      )
    }

    const teamId = teamAccess.access.teamId
    const listed = await SupabaseStorageService.listFiles(
      teamId,
      STORAGE_BUCKETS.EMAIL_TEMPLATE_ASSETS
    )

    if (!listed.success) {
      return NextResponse.json(
        new Output(false, [], [listed.error ?? "Erro ao listar imagens"], null),
        { status: 400 }
      )
    }

    const assets: EmailTemplateAssetItem[] = (listed.files ?? [])
      .filter((item) => item.name && !item.name.endsWith("/"))
      .map((item) => {
        const fileId = `${teamId}/${item.name}`
        const publicUrl = buildEmailTemplateAssetPublicUrl(fileId) ?? ""
        return {
          fileId,
          fileName: item.name as string,
          publicUrl,
          createdAt: (item.created_at as string | undefined) ?? null,
        }
      })
      .filter((item) => item.publicUrl)
      .sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
        return bTime - aTime
      })

    return NextResponse.json(new Output(true, [], [], { assets }), { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailTemplateAssetsUploadRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao listar imagens"], null), {
      status: 500,
    })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem excluir imagens de template"], null),
        { status: 403 }
      )
    }

    const fileId = new URL(request.url).searchParams.get("fileId")?.trim()
    if (!fileId) {
      return NextResponse.json(new Output(false, [], ["fileId é obrigatório"], null), {
        status: 400,
      })
    }

    const teamId = teamAccess.access.teamId
    const teamPrefix = `${teamId}/`
    if (!fileId.startsWith(teamPrefix)) {
      return NextResponse.json(
        new Output(false, [], ["Não é permitido excluir imagens de outro time"], null),
        { status: 403 }
      )
    }

    const deleted = await SupabaseStorageService.deleteFile(
      fileId,
      STORAGE_BUCKETS.EMAIL_TEMPLATE_ASSETS
    )

    if (!deleted.success) {
      return NextResponse.json(
        new Output(false, [], [deleted.error ?? "Erro ao excluir imagem"], null),
        { status: 400 }
      )
    }

    return NextResponse.json(new Output(true, ["Imagem excluída com sucesso"], [], null), {
      status: 200,
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailTemplateAssetsUploadRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao excluir imagem"], null), {
      status: 500,
    })
  }
}
