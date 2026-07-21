"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, RefreshCw, KeyRound, Upload, ScrollText } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EVOLUTION_HOST_ENV_KEYS,
  N8N_HOST_ENV_KEYS,
  SECRET_HOST_ENV_KEYS,
} from "@/lib/studio-bot/host-env"
import { useBackofficeStudioBotOps } from "../context/BackofficeStudioBotOpsHook"

function emptyEnvRecord(keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, ""]))
}

export function BackofficeStudioBotOpsContainer() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "logs" ? "logs" : "host"

  const {
    settings,
    jobs,
    health,
    logs,
    isLoading,
    isLoadingLogs,
    actionLock,
    loadAll,
    saveSettings,
    rotateToken,
    runHealth,
    runFetchLogs,
    runApplyEnv,
    runRestart,
    runImportWorkflows,
    runSyncHost,
  } = useBackofficeStudioBotOps()

  const [tab, setTab] = useState(initialTab)
  const [agentBaseUrl, setAgentBaseUrl] = useState("")
  const [desiredHostVersion, setDesiredHostVersion] = useState("")
  const [n8nEnv, setN8nEnv] = useState<Record<string, string>>(emptyEnvRecord(N8N_HOST_ENV_KEYS))
  const [evolutionEnv, setEvolutionEnv] = useState<Record<string, string>>(
    emptyEnvRecord(EVOLUTION_HOST_ENV_KEYS)
  )
  const [rotatedToken, setRotatedToken] = useState<string | null>(null)
  const [packVersion, setPackVersion] = useState("")
  const [packSha256, setPackSha256] = useState("")
  const [packBase64, setPackBase64] = useState("")
  const [logService, setLogService] = useState<"n8n" | "api">("n8n")
  const [logTail, setLogTail] = useState("200")

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!settings) return
    setAgentBaseUrl(settings.agentBaseUrl ?? "")
    setDesiredHostVersion(settings.desiredHostVersion ?? "")
    const nextN8n = emptyEnvRecord(N8N_HOST_ENV_KEYS)
    for (const field of settings.n8nEnv) {
      if (!field.isSecret && field.value) nextN8n[field.key] = field.value
    }
    setN8nEnv(nextN8n)
    const nextEvo = emptyEnvRecord(EVOLUTION_HOST_ENV_KEYS)
    for (const field of settings.evolutionEnv) {
      if (!field.isSecret && field.value) nextEvo[field.key] = field.value
    }
    setEvolutionEnv(nextEvo)
  }, [settings])

  const locked = Boolean(actionLock)

  const handleSave = async () => {
    const n8nPatch: Record<string, string> = {}
    for (const [key, value] of Object.entries(n8nEnv)) {
      if (value.trim()) n8nPatch[key] = value.trim()
    }
    const evoPatch: Record<string, string> = {}
    for (const [key, value] of Object.entries(evolutionEnv)) {
      if (value.trim()) evoPatch[key] = value.trim()
    }
    await saveSettings({
      agentBaseUrl: agentBaseUrl.trim() || null,
      desiredHostVersion: desiredHostVersion.trim() || null,
      n8nEnv: n8nPatch,
      evolutionEnv: evoPatch,
    })
  }

  const handleRotate = async () => {
    const token = await rotateToken()
    if (token) setRotatedToken(token)
  }

  const handlePackFile = async (file: File | null) => {
    if (!file) return
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ""
    for (const b of bytes) binary += String.fromCharCode(b)
    const base64 = btoa(binary)
    const digest = await crypto.subtle.digest("SHA-256", buf)
    const sha = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    setPackBase64(base64)
    setPackSha256(sha)
    if (!packVersion) {
      const match = file.name.match(/host-pack-(.+)\.tar\.gz/)
      if (match?.[1]) setPackVersion(match[1])
    }
    toast.success("Pack carregado")
  }

  const handleRefreshLogs = () => {
    void runFetchLogs({
      service: logService,
      tail: Number(logTail) || 200,
    })
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ops / Host — Bethânia</h1>
          <p className="text-sm text-muted-foreground">
            Variáveis N8N/Evolution, restart, logs do host e sync via agente na VPS.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={locked || isLoading}
          onClick={() => void loadAll()}
        >
          {isLoading ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Atualizar
        </Button>
      </div>

      {isLoading && !settings ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList>
          <TabsTrigger value="host">Host</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="host" className="flex flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agente VPS</CardTitle>
                <CardDescription>
                  URL pública do agente (ex.: https://ops.corretorstudio.com) e token Bearer.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="agentBaseUrl">agentBaseUrl</FieldLabel>
                    <Input
                      id="agentBaseUrl"
                      value={agentBaseUrl}
                      onChange={(e) => setAgentBaseUrl(e.target.value)}
                      placeholder="https://ops.corretorstudio.com"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="desiredHostVersion">desiredHostVersion</FieldLabel>
                    <Input
                      id="desiredHostVersion"
                      value={desiredHostVersion}
                      onChange={(e) => setDesiredHostVersion(e.target.value)}
                      placeholder="git sha / tag"
                    />
                  </Field>
                </FieldGroup>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={settings?.agentTokenConfigured ? "default" : "secondary"}>
                    Token {settings?.agentTokenConfigured ? "configurado" : "ausente"}
                  </Badge>
                  <Button type="button" variant="outline" disabled={locked} onClick={() => void handleRotate()}>
                    <KeyRound data-icon="inline-start" />
                    Gerar token
                  </Button>
                  <Button type="button" disabled={locked} onClick={() => void handleSave()}>
                    Salvar
                  </Button>
                </div>
                {rotatedToken ? (
                  <p className="break-all rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-xs">
                    {rotatedToken}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações do host</CardTitle>
                <CardDescription>Health, apply env, restart e import de workflows.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={locked} onClick={() => void runHealth()}>
                    Health
                  </Button>
                  <Button type="button" variant="outline" disabled={locked} onClick={() => void runApplyEnv()}>
                    Aplicar env
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked}
                    onClick={() => void runRestart("n8n")}
                  >
                    Restart N8N
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked}
                    onClick={() => void runRestart("api")}
                  >
                    Restart Evolution
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked}
                    onClick={() => void runImportWorkflows()}
                  >
                    Reimportar workflows
                  </Button>
                </div>
                {health ? (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                    <p className="font-medium">Health: {health.ok ? "ok" : "falha"}</p>
                    {health.hostVersion ? <p>Versão: {health.hostVersion}</p> : null}
                    {health.error ? <p className="text-destructive">{health.error}</p> : null}
                    {health.bethaniaProductionCheck ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Bethânia produção</span>
                          <Badge
                            variant={health.bethaniaProductionCheck.ok ? "default" : "destructive"}
                          >
                            {health.bethaniaProductionCheck.ok ? "ok" : "pendente"}
                          </Badge>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Env N8N</p>
                            <ul className="mt-1 space-y-1">
                              {health.bethaniaProductionCheck.env.n8n.map((item) => (
                                <li key={item.key} className="flex items-center justify-between gap-3">
                                  <span className="font-mono text-xs">{item.key}</span>
                                  <Badge variant={item.configured ? "outline" : "destructive"}>
                                    {item.configured ? "set" : "missing"}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Workflows</p>
                            <ul className="mt-1 space-y-1">
                              {health.bethaniaProductionCheck.workflows.map((item) => (
                                <li key={item.name} className="flex items-center justify-between gap-3">
                                  <span className="font-mono text-xs">{item.name}</span>
                                  <Badge variant={item.ok ? "outline" : "destructive"}>
                                    {item.ok ? item.expected : String(item.actual)}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {health.containers?.length ? (
                      <ul className="mt-2 flex flex-col gap-1">
                        {health.containers.map((c) => (
                          <li key={c.name} className="text-muted-foreground">
                            {c.name}: {c.status}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                <Separator />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="packFile">Pack do host (.tar.gz)</FieldLabel>
                    <Input
                      id="packFile"
                      type="file"
                      accept=".gz,.tar.gz,application/gzip"
                      onChange={(e) => void handlePackFile(e.target.files?.[0] ?? null)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="packVersion">Versão</FieldLabel>
                    <Input
                      id="packVersion"
                      value={packVersion}
                      onChange={(e) => setPackVersion(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="packSha">SHA-256</FieldLabel>
                    <Input id="packSha" value={packSha256} readOnly className="font-mono text-xs" />
                  </Field>
                </FieldGroup>
                <Button
                  type="button"
                  disabled={locked || !packVersion || !packBase64 || !packSha256}
                  onClick={() =>
                    void runSyncHost({
                      version: packVersion,
                      packBase64,
                      packSha256,
                    })
                  }
                >
                  <Upload data-icon="inline-start" />
                  Sync host version
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variáveis N8N</CardTitle>
              <CardDescription>
                Secrets só são gravados se você preencher um valor novo (não são exibidos).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-3 md:grid-cols-2">
                {N8N_HOST_ENV_KEYS.map((key) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`n8n-${key}`}>
                      {key}
                      {SECRET_HOST_ENV_KEYS.has(key) ? " (secret)" : ""}
                    </FieldLabel>
                    <Input
                      id={`n8n-${key}`}
                      type={SECRET_HOST_ENV_KEYS.has(key) ? "password" : "text"}
                      value={n8nEnv[key] ?? ""}
                      placeholder={
                        settings?.n8nEnv.find((f) => f.key === key)?.isSet
                          ? "•••• (já definido)"
                          : undefined
                      }
                      onChange={(e) => setN8nEnv((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variáveis Evolution</CardTitle>
              <CardDescription>Allowlist operacional (sem connection string Supabase).</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-3 md:grid-cols-2">
                {EVOLUTION_HOST_ENV_KEYS.map((key) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`evo-${key}`}>
                      {key}
                      {SECRET_HOST_ENV_KEYS.has(key) ? " (secret)" : ""}
                    </FieldLabel>
                    <Input
                      id={`evo-${key}`}
                      type={SECRET_HOST_ENV_KEYS.has(key) ? "password" : "text"}
                      value={evolutionEnv[key] ?? ""}
                      placeholder={
                        settings?.evolutionEnv.find((f) => f.key === key)?.isSet
                          ? "•••• (já definido)"
                          : undefined
                      }
                      onChange={(e) =>
                        setEvolutionEnv((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de jobs</CardTitle>
              <CardDescription>Auditoria das operações disparadas pelo painel.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum job ainda.</p>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{job.type}</span>
                    <Badge variant="outline">{job.status}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString("pt-BR")}
                    </span>
                    {job.errorMessage ? (
                      <span className="w-full text-destructive">{job.errorMessage}</span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="flex min-h-0 flex-1 flex-col gap-4">
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader>
              <CardTitle className="text-base">Logs Evolution / N8N</CardTitle>
              <CardDescription>
                Últimas linhas dos containers na VPS via agente. Envie uma mensagem no WhatsApp e
                atualize para diagnosticar o fluxo Evolution → N8N.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field className="w-48">
                  <FieldLabel>Serviço</FieldLabel>
                  <Select
                    value={logService}
                    onValueChange={(value) => setLogService(value as "n8n" | "api")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="n8n">N8N</SelectItem>
                        <SelectItem value="api">Evolution</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="w-36">
                  <FieldLabel>Linhas</FieldLabel>
                  <Select value={logTail} onValueChange={setLogTail}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  type="button"
                  disabled={locked || isLoadingLogs}
                  onClick={handleRefreshLogs}
                >
                  {isLoadingLogs ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <ScrollText data-icon="inline-start" />
                  )}
                  {isLoadingLogs ? "Carregando..." : "Atualizar logs"}
                </Button>
              </div>

              {isLoadingLogs && !logs ? <Skeleton className="h-64 w-full" /> : null}

              {logs ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {logs.service === "n8n" ? "N8N" : "Evolution"} ·{" "}
                    {logs.lines.length} linhas ·{" "}
                    {new Date(logs.fetchedAt).toLocaleString("pt-BR")}
                  </p>
                  <div className="min-h-0 flex-1 rounded-lg border border-border/60 bg-muted/30">
                    <ScrollArea
                      className="h-[60vh]"
                      viewportClassName="scroll-fade scroll-fade-16"
                    >
                      <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                        {logs.lines.length > 0 ? logs.lines.join("\n") : "(sem linhas)"}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              ) : !isLoadingLogs ? (
                <p className="text-sm text-muted-foreground">
                  Selecione o serviço e clique em Atualizar logs.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
