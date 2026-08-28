"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Copy, ImagePlus, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useTeamContext } from "@/app/context/TeamContext"
import {
  validateEmailTemplateAssetFile,
  type EmailTemplateAssetItem,
} from "@/lib/email/email-template-assets"
import { isApiRequestError } from "@/lib/http/api-request-error"
import { createTemplateEditorService } from "../services/TemplateEditorService"

const assetsService = createTemplateEditorService()

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp"

function notifyAssetsError(context: string, error: unknown, fallback: string) {
  if (!isApiRequestError(error)) {
    console.error(context, error)
  }
  toast.error(toUserToastMessage(error instanceof Error ? error : fallback))
}

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
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [assetToDelete, setAssetToDelete] = useState<EmailTemplateAssetItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchedRef = useRef(false)

  const loadAssets = useCallback(async () => {
    if (!activeTeamId) return
    setLoading(true)
    try {
      const result = await assetsService.listAssets(supabaseId, activeTeamId)
      setAssets(result.assets)
    } catch (error) {
      notifyAssetsError("[EmailTemplateAssetsPanel] loadAssets", error, "Erro ao carregar imagens")
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

      const validationError = validateEmailTemplateAssetFile(file)
      if (validationError) {
        toast.error(validationError)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        return
      }

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
        notifyAssetsError("[EmailTemplateAssetsPanel] handleUpload", error, "Erro ao enviar imagem")
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

  const confirmDelete = useCallback(async () => {
    if (!activeTeamId || !assetToDelete || deletingFileId) return

    setDeletingFileId(assetToDelete.fileId)
    try {
      await assetsService.deleteAsset(supabaseId, activeTeamId, assetToDelete.fileId)
      setAssets((prev) => prev.filter((item) => item.fileId !== assetToDelete.fileId))
      toast.success("Imagem excluída")
      setAssetToDelete(null)
    } catch (error) {
      notifyAssetsError("[EmailTemplateAssetsPanel] confirmDelete", error, "Erro ao excluir imagem")
    } finally {
      setDeletingFileId(null)
    }
  }, [activeTeamId, assetToDelete, deletingFileId, supabaseId])

  return (
    <>
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
            {assets.map((asset) => {
              const isDeleting = deletingFileId === asset.fileId
              return (
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
                        disabled={isDeleting}
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
                        disabled={isDeleting}
                        onClick={() => void copyToClipboard(buildImgSnippet(asset), "Tag img")}
                      >
                        <Copy data-icon="inline-start" />
                        Copiar &lt;img&gt;
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={Boolean(deletingFileId)}
                        onClick={() => setAssetToDelete(asset)}
                      >
                        {isDeleting ? (
                          <Loader2 data-icon="inline-start" className="animate-spin" />
                        ) : (
                          <Trash2 data-icon="inline-start" />
                        )}
                        Excluir
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={assetToDelete !== null}
        onOpenChange={(open) => !open && !deletingFileId && setAssetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              {assetToDelete
                ? `A imagem "${assetToDelete.fileName}" será removida do storage. Templates que usam esta URL deixarão de exibir a imagem.`
                : "Esta imagem será removida do storage."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingFileId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingFileId)}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {deletingFileId ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
