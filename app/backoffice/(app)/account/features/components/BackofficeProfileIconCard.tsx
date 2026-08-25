"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useBackofficeAccount } from "../context/BackofficeAccountHook"
import type { BackofficeAccountData } from "../context/BackofficeAccountTypes"

const VALID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
const MAX_SIZE_BYTES = 5 * 1024 * 1024

type Props = {
  account: BackofficeAccountData
}

function resolveIconUrl(account: BackofficeAccountData): string | null {
  if (account.profileIconUrl) return account.profileIconUrl
  if (!account.profileIconId) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/profile-icons/${account.profileIconId}`
}

export function BackofficeProfileIconCard({ account }: Props) {
  const { uploadIcon, removeIcon } = useBackofficeAccount()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)

  const currentIconUrl = avatarPreview ?? resolveIconUrl(account)
  const hasIcon = Boolean(account.profileIconId || account.profileIconUrl || avatarPreview)

  function onFilePickerClick() {
    if (isUploadingIcon) return
    fileInputRef.current?.click()
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || isUploadingIcon) return

    const file = files[0]
    if (!VALID_TYPES.includes(file.type as (typeof VALID_TYPES)[number])) {
      toast.error("Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF.")
      return
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Arquivo muito grande. Tamanho máximo: 5MB.")
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setIsUploadingIcon(true)

    try {
      await uploadIcon(file)
    } catch (err) {
      console.error("[BackofficeProfileIconCard][upload]", err)
      toastUserError(err)
      setAvatarPreview(null)
    } finally {
      setIsUploadingIcon(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDeleteIcon() {
    if (isUploadingIcon || !hasIcon) return
    setIsUploadingIcon(true)
    try {
      await removeIcon()
      setAvatarPreview(null)
    } catch (err) {
      console.error("[BackofficeProfileIconCard][remove]", err)
      toastUserError(err)
    } finally {
      setIsUploadingIcon(false)
    }
  }

  return (
    <section aria-labelledby="backoffice-avatar-title" className="flex flex-col gap-4">
      <h2 id="backoffice-avatar-title" className="text-base font-medium">
        Ícone de perfil
      </h2>

      <div className="flex items-center gap-6">
        <Avatar className="size-24 border border-border">
          {currentIconUrl ? (
            <AvatarImage src={currentIconUrl} alt="Ícone de perfil" className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-muted">
            <Camera className="size-7 text-muted-foreground" aria-hidden />
            <span className="sr-only">Sem imagem de perfil</span>
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setIsDragging(false)
              void handleFiles(event.dataTransfer.files)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setIsDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setIsDragging(false)
            }}
            role="button"
            tabIndex={0}
            onClick={onFilePickerClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onFilePickerClick()
              }
            }}
            className={cn(
              "group flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-xl border border-dashed p-4 transition",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/60 hover:bg-muted/50",
              isUploadingIcon && "pointer-events-none opacity-50"
            )}
            aria-label="Área para soltar arquivo do ícone de perfil"
          >
            <div className="grid place-items-center rounded-lg bg-muted p-3">
              {isUploadingIcon ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="size-5 text-muted-foreground transition group-hover:scale-110" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {isUploadingIcon ? "Enviando..." : "Arraste e solte a imagem aqui"}
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WebP, GIF até 5MB. Ou{" "}
                <span className="underline decoration-dotted underline-offset-4">
                  clique para selecionar
                </span>
              </p>
            </div>
          </div>

          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
            disabled={isUploadingIcon}
          />

          {hasIcon ? (
            <button
              type="button"
              onClick={() => void handleDeleteIcon()}
              disabled={isUploadingIcon}
              className="cursor-pointer text-left text-xs text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploadingIcon ? "Processando..." : "Remover ícone atual"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
