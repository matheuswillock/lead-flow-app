"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export type EmailUnsubscribePageViewProps = {
  mode: "confirm" | "success" | "loading" | "error"
  errorMessage?: string | null
  maskedEmail?: string | null
  teamName?: string | null
  removeFromCampaign: boolean
  removeFromAll: boolean
  confirming?: boolean
  interactive?: boolean
  onRemoveFromCampaignChange?: (checked: boolean) => void
  onRemoveFromAllChange?: (checked: boolean) => void
  onConfirm?: () => void
}

function PreferenceChecks({
  removeFromCampaign,
  removeFromAll,
  interactive,
  onRemoveFromCampaignChange,
  onRemoveFromAllChange,
}: Pick<
  EmailUnsubscribePageViewProps,
  | "removeFromCampaign"
  | "removeFromAll"
  | "interactive"
  | "onRemoveFromCampaignChange"
  | "onRemoveFromAllChange"
>) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 text-left">
      <div className="flex items-start gap-3">
        <Checkbox
          id="unsub-campaign"
          checked={removeFromCampaign}
          disabled={!interactive}
          onCheckedChange={(checked) => onRemoveFromCampaignChange?.(checked === true)}
        />
        <Label htmlFor="unsub-campaign" className="cursor-pointer font-normal text-muted-foreground">
          Remover desta campanha
        </Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="unsub-all"
          checked={removeFromAll}
          disabled={!interactive}
          onCheckedChange={(checked) => onRemoveFromAllChange?.(checked === true)}
        />
        <Label htmlFor="unsub-all" className="cursor-pointer font-normal text-muted-foreground">
          Remover de todas as notificações deste time
        </Label>
      </div>
    </div>
  )
}

export function EmailUnsubscribePageView({
  mode,
  errorMessage,
  maskedEmail,
  teamName,
  removeFromCampaign,
  removeFromAll,
  confirming = false,
  interactive = true,
  onRemoveFromCampaignChange,
  onRemoveFromAllChange,
  onConfirm,
}: EmailUnsubscribePageViewProps) {
  const canSubmit = removeFromCampaign || removeFromAll

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div
          className={cn(
            "flex size-16 items-center justify-center rounded-full bg-foreground text-background",
            mode === "success" && "bg-foreground"
          )}
        >
          <Check className="size-7 opacity-40" aria-hidden />
        </div>

        {mode === "loading" ? (
          <div className="flex w-full flex-col items-center gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}

        {mode === "error" ? (
          <Alert variant="destructive" className="w-full text-left">
            <AlertDescription>{errorMessage ?? "Não foi possível carregar o link"}</AlertDescription>
          </Alert>
        ) : null}

        {mode === "success" ? (
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">
            Suas preferências de e-mail foram atualizadas.
          </h1>
        ) : null}

        {mode === "confirm" ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                Deseja cancelar a inscrição?
              </h1>
              <p className="text-sm text-muted-foreground">
                Confirme suas preferências de e-mail:
              </p>
              {maskedEmail && teamName ? (
                <p className="text-xs text-muted-foreground">
                  {maskedEmail} · {teamName}
                </p>
              ) : null}
            </div>

            <PreferenceChecks
              removeFromCampaign={removeFromCampaign}
              removeFromAll={removeFromAll}
              interactive={interactive}
              onRemoveFromCampaignChange={onRemoveFromCampaignChange}
              onRemoveFromAllChange={onRemoveFromAllChange}
            />

            <Button
              className="w-full bg-muted text-foreground hover:bg-muted/80"
              disabled={!interactive || confirming || !canSubmit}
              onClick={onConfirm}
            >
              {confirming ? "Confirmando..." : "Cancelar inscrição"}
            </Button>
          </>
        ) : null}
      </div>
    </main>
  )
}
