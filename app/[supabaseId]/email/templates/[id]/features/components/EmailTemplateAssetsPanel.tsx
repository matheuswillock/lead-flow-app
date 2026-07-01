"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Copy, ImagePlus, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useTeamContext } from "@/app/context/TeamContext"
import type { EmailTemplateAssetItem } from "@/lib/email/email-template-assets"
import { createTemplateEditorService } from "../services/TemplateEditorService"

const assetsService = createTemplateEditorService()

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp"

function buildImgSnippet(asset: EmailTemplateAssetItem): string {
  return `<img src="${asset.publicUrl}" width="24" height="24" alt="${asset.fileName}" style="display:block;border:0;" />`
}

export function EmailTemplateAssetsPanel({ embedded = false }: { embedded?: boolean }) {
  const params = useParams<{ supabaseId: string }>()
  const supabaseId = params.supabaseId
  const { activeTeamId } = useTeamContext()

  const [assets, setAssets] = useState<EmailTemplateAssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchedRef = useRef(false)

  const loadAssets = useCallback(async () => {
    if (!activeTeamId) return
    setLoading(true)
    try {
      const result = await assetsService.listAssets(supabaseId, activeTeamId)
      setAssets(result.assets)
    } catch (error) {
      console.error("[EmailTemplateAssetsPanel] loadAssets", error)
      toast.error(error instanceof Error ? error.message : "Erro ao carregar imagens")
    } finally {
      setLoading(false)
    }
  }, [activeTeamId, supabaseId])

  useEffect(() => {
    if (!activeTeamId || fetchedRef.current) return
    fetchedRef.current = true
    void loadAssets()
  }, [activeTeamId, loadAssets])

  const handleUpload = useCallback(
    async (file: File) => {
      if (!activeTeamId || uploading) return

      setUploading(true)
      try {
        const uploaded = await assetsService.uploadAsset(supabaseId, activeTeamId, file)
        setAssets((prev) => [
          {
            fileId: uploaded.fileId,
            fileName: uploaded.fileName,
            publicUrl: uploaded.publicUrl,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ])
        toast.success("Imagem enviada com sucesso")
      } catch (error) {
        console.error("[EmailTemplateAssetsPanel] handleUpload", error)
        toast.error(error instanceof Error ? error.message : "Erro ao enviar imagem")
      } finally {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [activeTeamId, supabaseId, uploading]
  )

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) void handleUpload(file)
    },
    [handleUpload]
  )

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error("Não foi possível copiar")
    }
  }, [])

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 p-4"}>
      <div>
        <h3 className="text-sm font-semibold">Imagens do template</h3>
        <p className="text-xs text-muted-foreground">
          Envie PNG ou JPG e use a URL pública no HTML com a tag <code>&lt;img&gt;</code>.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          disabled={uploading || !activeTeamId}
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading || !activeTeamId}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Upload data-icon="inline-start" />
          )}
          {uploading ? "Enviando..." : "Enviar imagem"}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <ImagePlus className="size-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Nenhuma imagem enviada ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {assets.map((asset) => (
            <article
              key={asset.fileId}
              className="flex items-center gap-3 rounded-lg border bg-card p-2"
            >
              <img
                src={asset.publicUrl}
                alt={asset.fileName}
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-md border object-contain bg-muted"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-xs font-medium">{asset.fileName}</p>
                <p className="truncate text-[10px] text-muted-foreground">{asset.publicUrl}</p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void copyToClipboard(asset.publicUrl, "URL")}
                  >
                    <Copy data-icon="inline-start" />
                    Copiar URL
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void copyToClipboard(buildImgSnippet(asset), "Tag img")}
                  >
                    <Copy data-icon="inline-start" />
                    Copiar &lt;img&gt;
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
