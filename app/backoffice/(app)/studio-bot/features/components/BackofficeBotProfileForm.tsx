"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { BackofficeStudioBotChannel } from "../context/BackofficeStudioBotTypes"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"

interface Props {
  channel: BackofficeStudioBotChannel | null
  disabled?: boolean
}

export function BackofficeBotProfileForm({ channel, disabled = false }: Props) {
  const { updateChannelProfile, isSavingProfile, canManage } = useBackofficeStudioBot()
  const [displayName, setDisplayName] = useState("Bethânia")
  const [aboutText, setAboutText] = useState("")

  useEffect(() => {
    if (!channel) return
    setDisplayName(channel.displayName)
    setAboutText(channel.aboutText ?? "")
  }, [channel])

  const isDisabled = disabled || !canManage || isSavingProfile
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {channel?.avatarUrl ? (
            <AvatarImage src={channel.avatarUrl} alt={displayName} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Avatar do canal</span>
          <span className="text-xs text-muted-foreground">
            Upload de avatar será disponibilizado em versão futura.
          </span>
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
