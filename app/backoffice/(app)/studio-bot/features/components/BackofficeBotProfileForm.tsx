"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { BackofficeStudioBotChannel } from "../context/BackofficeStudioBotTypes"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]

interface Props {
  channel: BackofficeStudioBotChannel | null
  disabled?: boolean
}

export function BackofficeBotProfileForm({ channel, disabled = false }: Props) {
  const { updateChannelProfile, uploadChannelAvatar, isSavingProfile, isUploadingAvatar, canManage } =
    useBackofficeStudioBot()
  const [displayName, setDisplayName] = useState("Bethânia")
  const [aboutText, setAboutText] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!channel) return
    setDisplayName(channel.displayName)
    setAboutText(channel.aboutText ?? "")
  }, [channel])

  const isDisabled = disabled || !canManage || isSavingProfile || isUploadingAvatar
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!displayName.trim()) return
    await updateChannelProfile({ displayName, aboutText })
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return
    }
    await uploadChannelAvatar(file)
    event.target.value = ""
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          {channel?.avatarUrl ? (
            <AvatarImage src={channel.avatarUrl} alt={displayName} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Avatar do canal</span>
          <span className="text-xs text-muted-foreground">JPEG, PNG ou WebP.</span>
          {canManage ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_AVATAR_TYPES.join(",")}
                className="hidden"
                disabled={isDisabled}
                onChange={(e) => void handleAvatarChange(e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploadingAvatar ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : null}
                {isUploadingAvatar ? "Enviando..." : "Enviar avatar"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="bot-display-name">Nome exibido</FieldLabel>
          <Input
            id="bot-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isDisabled}
            maxLength={64}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="bot-about-text">Sobre (about)</FieldLabel>
          <Textarea
            id="bot-about-text"
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            disabled={isDisabled}
            maxLength={139}
            rows={3}
          />
        </Field>
      </FieldGroup>

      {canManage ? (
        <Button type="submit" disabled={isDisabled || !displayName.trim()}>
          {isSavingProfile ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {isSavingProfile ? "Salvando..." : "Salvar perfil"}
        </Button>
      ) : null}
    </form>
  )
}
