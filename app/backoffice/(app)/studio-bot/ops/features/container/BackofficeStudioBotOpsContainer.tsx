"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  CircleHelp,
  Download,
  FileUp,
  KeyRound,
  Loader2,
  RefreshCw,
  ScrollText,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  EVOLUTION_HOST_ENV_KEYS,
  N8N_HOST_ENV_KEYS,
  BETHANIA_INBOUND_WEBHOOK_INTERNAL_URL,
  OPS_HOST_REFERENCE_LINKS,
  SECRET_HOST_ENV_KEYS,
  parseOpsHostEnvFileContent,
} from "@/lib/studio-bot/host-env"
import { HostCopyableLink } from "../components/HostCopyableLink"
import { HostEnvField } from "../components/HostEnvField"
import { useBackofficeStudioBotOps } from "../context/BackofficeStudioBotOpsHook"

function emptyEnvRecord(keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, ""]))
}

export function BackofficeStudioBotOpsContainer() {
  const searchParams = useSearchParams()
  const initialTab =
    searchParams.get("tab") === "logs"
      ? "logs"
      : searchParams.get("tab") === "atualizacoes"
        ? "atualizacoes"
        : "host"

  const {
    settings,
    jobs,
    health,
    logs,
    bethaniaWebhookResync,
    isLoading,
    isLoadingLogs,
    actionLock,
    loadAll,
    saveSettings,
    exportEnvFile,
    rotateToken,
    runHealth,
    runFetchLogs,
    runApplyEnv,
    runRestart,
    runImportWorkflows,
    previewResyncBethaniaWebhook,
    confirmResyncBethaniaWebhook,
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
  const envFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (tab === "atualizacoes" && !bethaniaWebhookResync) {
      void previewResyncBethaniaWebhook()
    }
  }, [tab, bethaniaWebhookResync, previewResyncBethaniaWebhook])

  useEffect(() => {
    if (!settings) return
    setAgentBaseUrl(settings.agentBaseUrl ?? "")
    setDesiredHostVersion(settings.desiredHostVersion ?? "")
    setN8nEnv((prev) => {
      const next = emptyEnvRecord(N8N_HOST_ENV_KEYS)
      for (const field of settings.n8nEnv) {
        if (field.isSecret) {
          next[field.key] = prev[field.key] ?? ""
        } else if (field.value) {
          next[field.key] = field.value
        }
      }
      return next
    })
    setEvolutionEnv((prev) => {
      const next = emptyEnvRecord(EVOLUTION_HOST_ENV_KEYS)
      for (const field of settings.evolutionEnv) {
        if (field.isSecret) {
          next[field.key] = prev[field.key] ?? ""
        } else if (field.value) {
          next[field.key] = field.value
        }
      }
      return next
    })
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

  const downloadTextFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const mergeEnvIntoForm = (
    nextN8n: Record<string, string>,
    nextEvo: Record<string, string>
  ) => {
    setN8nEnv((prev) => {
      const merged = { ...prev }
      for (const key of N8N_HOST_ENV_KEYS) {
        if (nextN8n[key]?.trim()) merged[key] = nextN8n[key]
      }
      return merged
    })
    setEvolutionEnv((prev) => {
      const merged = { ...prev }
      for (const key of EVOLUTION_HOST_ENV_KEYS) {
        if (nextEvo[key]?.trim()) merged[key] = nextEvo[key]
      }
      return merged
    })
  }

  const handleExportEnvFile = async () => {
    const result = await exportEnvFile()
    if (!result) return
    downloadTextFile(result.fileName, result.content)
    if (result.agentBaseUrl?.trim()) setAgentBaseUrl(result.agentBaseUrl.trim())
    if (result.desiredHostVersion?.trim()) {
      setDesiredHostVersion(result.desiredHostVersion.trim())
    }
    mergeEnvIntoForm(result.n8nEnv, result.evolutionEnv)
  }

  const handleImportEnvFile = async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseOpsHostEnvFileContent(text)
      const n8nCount = Object.keys(parsed.n8nEnv).length
      const evoCount = Object.keys(parsed.evolutionEnv).length
      const agentCount =
        (parsed.agent.agentBaseUrl ? 1 : 0) + (parsed.agent.desiredHostVersion ? 1 : 0)
      if (n8nCount === 0 && evoCount === 0 && agentCount === 0) {
        toast.error("Nenhuma variável allowlisted encontrada no arquivo")
        return
      }
      if (parsed.agent.agentBaseUrl) setAgentBaseUrl(parsed.agent.agentBaseUrl)
      if (parsed.agent.desiredHostVersion) {
        setDesiredHostVersion(parsed.agent.desiredHostVersion)
      }
      mergeEnvIntoForm(parsed.n8nEnv, parsed.evolutionEnv)
      toast.success(
        `Formulário preenchido (${agentCount} agente, ${n8nCount} N8N, ${evoCount} Evolution)`
      )
    } catch {
      toast.error("Falha ao ler o arquivo de variáveis")
    } finally {
      if (envFileInputRef.current) envFileInputRef.current.value = ""
    }
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
          <TabsTrigger value="atualizacoes">Atualizações</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="host" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Links de referência</CardTitle>
              <CardDescription>
                Atalhos para N8N, Evolution e webhook. Hostnames Docker (ex.: n8n:5678) não abrem no
                navegador — use só na configuração da Evolution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-3 md:grid-cols-2">
                {OPS_HOST_REFERENCE_LINKS.map((link) => (
                  <HostCopyableLink
                    key={link.id}
                    id={`ops-link-${link.id}`}
                    label={link.label}
                    href={link.href}
                    hint={link.hint}
                    openInBrowser={link.id !== "bethania-inbound-internal"}
                    className={
                      link.id === "bethania-inbound-internal" ||
                      link.id === "bethania-inbound-public"
                        ? "md:col-span-2"
                        : undefined
                    }
                  />
                ))}
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agente VPS</CardTitle>
                <CardDescription>
                  URL pública do agente (ex.: https://ops.corretorstudio.com) e token Bearer.
                </CardDescription>
                <CardAction>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Como configurar o agente Ops"
                      >
                        <CircleHelp data-icon="inline-start" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Como configurar o agente Ops</DialogTitle>
                        <DialogDescription>
                          O token precisa ser idêntico nos três lugares abaixo. Se um deles ficar
                          desatualizado, o backup e as demais ações desta página falham com
                          &quot;unauthorized&quot;.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto">
                        <ol className="flex flex-col gap-4 text-sm">
                          <li className="flex flex-col gap-1">
                            <p className="font-medium">1. Gerar token</p>
                            <p className="text-muted-foreground">
                              Clique em <span className="font-mono">Gerar token</span> abaixo. O
                              valor só é exibido uma vez — copie antes de sair da tela.
                            </p>
                          </li>
                          <li className="flex flex-col gap-1">
                            <p className="font-medium">2. Colar na VPS</p>
                            <p className="text-muted-foreground">
                              Em <span className="font-mono">/opt/lead-flow-bot/.env.ops</span>,
                              defina <span className="font-mono">OPS_AGENT_TOKEN=&lt;token&gt;</span>{" "}
                              e recrie o container (um restart simples não relê o arquivo):
                            </p>
                            <code className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
                              cd /opt/lead-flow-bot &amp;&amp; docker compose -f docker-compose.vps.yml up
                              -d --force-recreate studio-bot-ops
                            </code>
                          </li>
                          <li className="flex flex-col gap-1">
                            <p className="font-medium">3. Colar na Vercel</p>
                            <p className="text-muted-foreground">
                              Defina{" "}
                              <span className="font-mono">
                                BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN
                              </span>{" "}
                              (Production) com o mesmo valor. Se existir a variável{" "}
                              <span className="font-mono">BACKUP_VPS_TOKEN</span>, remova-a ou
                              atualize-a junto — ela tem prioridade e, se ficar com um valor antigo,
                              volta a causar o mesmo erro.
                            </p>
                          </li>
                          <li className="flex flex-col gap-1">
                            <p className="font-medium">4. Redeploy</p>
                            <p className="text-muted-foreground">
                              Variáveis de ambiente só valem para lambdas depois de um novo deploy
                              — faça um redeploy de Production após salvar a variável na Vercel.
                            </p>
                          </li>
                          <li className="flex flex-col gap-1">
                            <p className="font-medium">
                              Campo &quot;Versão do host&quot; não é o token
                            </p>
                            <p className="text-muted-foreground">
                              O campo de versão abaixo (desiredHostVersion) identifica o deploy do
                              host (git sha curto/tag) usado pelo Sync host version — não cole o
                              token gerado ali.
                            </p>
                          </li>
                        </ol>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FieldGroup>
                  <HostEnvField
                    id="agentBaseUrl"
                    label="agentBaseUrl"
                    value={agentBaseUrl}
                    isSecret={false}
                    placeholder="https://ops.corretorstudio.com"
                    onChange={setAgentBaseUrl}
                  />
                </FieldGroup>

                <FieldSeparator />

                <FieldGroup>
                  <HostEnvField
                    id="desiredHostVersion"
                    label="Versão do host alvo (desiredHostVersion)"
                    description="Identificador do deploy do host (git sha curto ou tag) usado pelo Sync host version — não é o token do agente."
                    value={desiredHostVersion}
                    isSecret={false}
                    placeholder="git sha / tag"
                    onChange={setDesiredHostVersion}
                  />
                </FieldGroup>
                <div>
                  <Button type="button" disabled={locked} onClick={() => void handleSave()}>
                    Salvar
                  </Button>
                </div>

                <FieldSeparator />

                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">Token do agente</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={settings?.agentTokenConfigured ? "default" : "secondary"}>
                      Token {settings?.agentTokenConfigured ? "configurado" : "ausente"}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={locked}
                      onClick={() => void handleRotate()}
                    >
                      <KeyRound data-icon="inline-start" />
                      Gerar token
                    </Button>
                  </div>
                  {rotatedToken ? (
                    <div className="flex flex-col gap-2">
                      <p className="break-all rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-xs">
                        {rotatedToken}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Copie este valor para{" "}
                        <span className="font-mono">/opt/lead-flow-bot/.env.ops</span> como{" "}
                        <span className="font-mono">OPS_AGENT_TOKEN</span> e para a Vercel como{" "}
                        <span className="font-mono">BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN</span>.
                        Depois:{" "}
                        <span className="font-mono">
                          cd /opt/lead-flow-bot &amp;&amp; docker compose -f docker-compose.vps.yml
                          up -d --force-recreate studio-bot-ops
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
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
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1.5">
                <CardTitle className="text-base">Variáveis N8N / Evolution</CardTitle>
                <CardDescription>
                  Exporte o .txt de produção (MASTER), importe para preencher agente + envs, use
                  copiar/olho nos campos. Secrets só são gravados se você preencher um valor novo.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={locked}
                  onClick={() => void handleExportEnvFile()}
                >
                  <Download data-icon="inline-start" />
                  Exportar .txt
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={locked}
                  onClick={() => envFileInputRef.current?.click()}
                >
                  <FileUp data-icon="inline-start" />
                  Importar .txt
                </Button>
                <input
                  ref={envFileInputRef}
                  type="file"
                  accept=".txt,.env,text/plain"
                  className="hidden"
                  onChange={(e) => void handleImportEnvFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">N8N</p>
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {N8N_HOST_ENV_KEYS.map((key) => (
                    <HostEnvField
                      key={key}
                      id={`n8n-${key}`}
                      label={key}
                      value={n8nEnv[key] ?? ""}
                      isSecret={SECRET_HOST_ENV_KEYS.has(key)}
                      isSet={settings?.n8nEnv.find((f) => f.key === key)?.isSet}
                      className={
                        key === "BETHANIA_SLACK_WEBHOOK_URL" ? "md:col-span-2" : undefined
                      }
                      onChange={(value) => setN8nEnv((prev) => ({ ...prev, [key]: value }))}
                    />
                  ))}
                </FieldGroup>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Evolution</p>
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {EVOLUTION_HOST_ENV_KEYS.map((key) => (
                    <HostEnvField
                      key={key}
                      id={`evo-${key}`}
                      label={key}
                      value={evolutionEnv[key] ?? ""}
                      isSecret={SECRET_HOST_ENV_KEYS.has(key)}
                      isSet={settings?.evolutionEnv.find((f) => f.key === key)?.isSet}
                      onChange={(value) =>
                        setEvolutionEnv((prev) => ({ ...prev, [key]: value }))
                      }
                    />
                  ))}
                </FieldGroup>
              </div>
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

        <TabsContent value="atualizacoes" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reaplicar webhook Bethânia → N8N</CardTitle>
              <CardDescription>
                Configura na Evolution o webhook da instância Bethânia apontando para{" "}
                <code className="text-xs">{BETHANIA_INBOUND_WEBHOOK_INTERNAL_URL}</code>{" "}
                (ou a URL montada a partir de <code className="text-xs">N8N_WEBHOOK_BASE_URL</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={locked}
                  onClick={() => void previewResyncBethaniaWebhook()}
                >
                  {actionLock === "preview-bethania-webhook" ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  Atualizar prévia
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={locked || !bethaniaWebhookResync}>
                      Reaplicar webhook
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-h-[90vh] flex flex-col">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar reaplicação</AlertDialogTitle>
                      <AlertDialogDescription>
                        A instância{" "}
                        <strong>{bethaniaWebhookResync?.instanceName ?? "bethania"}</strong> terá o
                        webhook atualizado para{" "}
                        <code className="text-xs">
                          {bethaniaWebhookResync?.webhookUrl ?? BETHANIA_INBOUND_WEBHOOK_INTERNAL_URL}
                        </code>
                        .
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={locked}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={locked}
                        onClick={(event) => {
                          event.preventDefault()
                          void confirmResyncBethaniaWebhook()
                        }}
                      >
                        {actionLock === "resync-bethania-webhook" ? "Aplicando…" : "Confirmar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {bethaniaWebhookResync ? (
                <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">modo: {bethaniaWebhookResync.mode}</Badge>
                    <Badge variant={bethaniaWebhookResync.ok ? "outline" : "destructive"}>
                      {bethaniaWebhookResync.ok ? "ok" : "falhou"}
                    </Badge>
                  </div>
                  <p>
                    <span className="text-muted-foreground">Instância: </span>
                    {bethaniaWebhookResync.instanceName}
                  </p>
                  <p className="break-all">
                    <span className="text-muted-foreground">Webhook: </span>
                    {bethaniaWebhookResync.webhookUrl}
                  </p>
                  {bethaniaWebhookResync.error ? (
                    <p className="text-destructive">{bethaniaWebhookResync.error}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Abra esta aba ou clique em Atualizar prévia para carregar o alvo.
                </p>
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
