"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"
import { BackofficeBotChannelStatusBadge } from "../components/BackofficeBotChannelStatusBadge"
import { BackofficeBotProfileForm } from "../components/BackofficeBotProfileForm"

export function BackofficeStudioBotCanalContainer() {
  const { tz } = useTimezone()
  const {
    channel,
    isLoadingChannel,
    isTestingPing,
    canManage,
    loadChannel,
    testPing,
    updateChannel,
    isSavingProfile,
  } = useBackofficeStudioBot()

  useEffect(() => {
    void loadChannel()
  }, [loadChannel])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Canal e perfil</h1>
        <p className="text-sm text-muted-foreground">
          Identidade da Bethânia no WhatsApp e configuração do canal N8N.
        </p>
      </div>

      {isLoadingChannel ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conexão</CardTitle>
              <CardDescription>Status e metadados do canal ativo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Status</span>
                {channel ? (
                  <BackofficeBotChannelStatusBadge status={channel.status} />
                ) : (
                  <span className="text-sm">Não configurado</span>
                )}
              </div>
              {channel?.phoneNumber ? (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Telefone</span>
                  <span>{maskPhone(channel.phoneNumber)}</span>
                </div>
              ) : null}
              {channel?.lastProfileSyncAt ? (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Última sincronização de perfil</span>
                  <span>
                    {formatIntimezone(new Date(channel.lastProfileSyncAt), "dd/MM/yyyy HH:mm", tz)}
                  </span>
                </div>
              ) : null}
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isTestingPing}
                  onClick={() => void testPing()}
                >
                  {isTestingPing ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : null}
                  {isTestingPing ? "Testando..." : "Testar ping N8N"}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil da Bethânia</CardTitle>
              <CardDescription>Nome exibido e texto sobre no WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent>
              <BackofficeBotProfileForm channel={channel} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Integração N8N</CardTitle>
              <CardDescription>URL de entrada para webhooks do orquestrador.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const n8nInboundUrl = String(formData.get("n8nInboundUrl") ?? "").trim()
                  void updateChannel({ n8nInboundUrl: n8nInboundUrl || null })
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="n8n-inbound-url">URL inbound N8N</FieldLabel>
                    <Input
                      id="n8n-inbound-url"
                      name="n8nInboundUrl"
                      type="url"
                      defaultValue={channel?.n8nInboundUrl ?? ""}
                      placeholder="https://n8n.exemplo.com/webhook/..."
                      disabled={!canManage || isSavingProfile}
                    />
                  </Field>
                </FieldGroup>
                {canManage ? (
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : null}
                    Salvar URL
                  </Button>
                ) : null}
              </form>
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground">
                Reconexão Evolution e upload de avatar serão adicionados em versões futuras.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
