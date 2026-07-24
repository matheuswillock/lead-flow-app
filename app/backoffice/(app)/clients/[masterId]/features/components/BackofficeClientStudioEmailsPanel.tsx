"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw, Send } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ManagedByCorretorStudioBadge } from "@/components/email/ManagedByCorretorStudioBadge"
import { backofficeStudioEmailService } from "../services/BackofficeStudioEmailService"
import type {
  StudioEmailAnalytics,
  StudioEmailCampaign,
  StudioEmailContactList,
  StudioEmailLog,
  StudioEmailTemplate,
} from "../services/IBackofficeStudioEmailService"

type EmailSubSection =
  | "campaigns"
  | "contacts"
  | "templates"
  | "historico"
  | "configuracoes"
  | "metricas"

type TeamOption = { id: string; name: string }

type Props = {
  masterId: string
  teams: TeamOption[]
  selectedTeamId: string | null
  onSelectedTeamIdChange: (teamId: string | null) => void
  canManage: boolean
}

export function BackofficeClientStudioEmailsPanel({
  masterId,
  teams,
  selectedTeamId,
  onSelectedTeamIdChange,
  canManage,
}: Props) {
  const [subSection, setSubSection] = useState<EmailSubSection>("campaigns")
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState<StudioEmailCampaign[]>([])
  const [contactLists, setContactLists] = useState<StudioEmailContactList[]>([])
  const [templates, setTemplates] = useState<StudioEmailTemplate[]>([])
  const [logs, setLogs] = useState<StudioEmailLog[]>([])
  const [analytics, setAnalytics] = useState<StudioEmailAnalytics | null>(null)
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false)
  const [createListOpen, setCreateListOpen] = useState(false)
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false)
  const [campaignName, setCampaignName] = useState("")
  const [campaignTemplateId, setCampaignTemplateId] = useState("")
  const [campaignListId, setCampaignListId] = useState("")
  const [listName, setListName] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [templateSubject, setTemplateSubject] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)

  const teamId = selectedTeamId

  const loadSection = useCallback(async () => {
    if (!teamId) return
    const requestKey = `${masterId}:${teamId}:${subSection}`
    if (inFlightKeyRef.current === requestKey) return
    inFlightKeyRef.current = requestKey
    setLoading(true)
    try {
      if (subSection === "campaigns") {
        const [campaignResult, templateResult, listResult] = await Promise.all([
          backofficeStudioEmailService.listCampaigns(masterId, teamId, { page: 1, pageSize: 50 }),
          backofficeStudioEmailService.listTemplates(masterId, teamId),
          backofficeStudioEmailService.listContactLists(masterId, teamId),
        ])
        setCampaigns(campaignResult.campaigns)
        setTemplates(templateResult)
        setContactLists(listResult)
      } else if (subSection === "contacts") {
        setContactLists(await backofficeStudioEmailService.listContactLists(masterId, teamId))
      } else if (subSection === "templates") {
        setTemplates(await backofficeStudioEmailService.listTemplates(masterId, teamId))
      } else if (subSection === "historico") {
        const result = await backofficeStudioEmailService.listLogs(masterId, teamId, {
          page: 1,
          pageSize: 50,
        })
        setLogs(result.items)
      } else if (subSection === "metricas") {
        setAnalytics(await backofficeStudioEmailService.getAnalytics(masterId, teamId))
      } else if (subSection === "configuracoes") {
        setSettings(await backofficeStudioEmailService.getSettings(masterId, teamId))
      }
      lastSuccessKeyRef.current = requestKey
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar e-mails do time")
    } finally {
      if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null
      setLoading(false)
    }
  }, [masterId, teamId, subSection])

  useEffect(() => {
    if (!teamId) return
    const requestKey = `${masterId}:${teamId}:${subSection}`
    if (lastSuccessKeyRef.current === requestKey) return
    void loadSection()
  }, [loadSection, masterId, teamId, subSection])

  useEffect(() => {
    if (!selectedTeamId && teams[0]?.id) {
      onSelectedTeamIdChange(teams[0].id)
    }
  }, [selectedTeamId, teams, onSelectedTeamIdChange])

  async function handleCreateCampaign() {
    if (!teamId || !canManage) return
    setSubmitting(true)
    try {
      await backofficeStudioEmailService.createCampaign(masterId, teamId, {
        name: campaignName.trim(),
        templateId: campaignTemplateId,
        contactListId: campaignListId,
      })
      toast.success("Campanha criada")
      setCreateCampaignOpen(false)
      setCampaignName("")
      setCampaignTemplateId("")
      setCampaignListId("")
      lastSuccessKeyRef.current = null
      await loadSection()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar campanha")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateList() {
    if (!teamId || !canManage) return
    setSubmitting(true)
    try {
      await backofficeStudioEmailService.createContactList(masterId, teamId, {
        name: listName.trim(),
      })
      toast.success("Lista criada")
      setCreateListOpen(false)
      setListName("")
      lastSuccessKeyRef.current = null
      await loadSection()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar lista")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateTemplate() {
    if (!teamId || !canManage) return
    setSubmitting(true)
    try {
      await backofficeStudioEmailService.createTemplate(masterId, teamId, {
        name: templateName.trim(),
        subject: templateSubject.trim(),
        html: "<p></p>",
      })
      toast.success("Template criado")
      setCreateTemplateOpen(false)
      setTemplateName("")
      setTemplateSubject("")
      lastSuccessKeyRef.current = null
      await loadSection()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar template")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSend(campaignId: string) {
    if (!teamId || !canManage) return
    setSubmitting(true)
    try {
      await backofficeStudioEmailService.sendCampaign(masterId, teamId, campaignId)
      toast.success("Disparo iniciado")
      lastSuccessKeyRef.current = null
      await loadSection()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao disparar")
    } finally {
      setSubmitting(false)
    }
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Este cliente ainda não possui times para gerenciar e-mails.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-[220px]">
          <FieldLabel>Time</FieldLabel>
          <Select
            value={selectedTeamId ?? undefined}
            onValueChange={(value) => {
              lastSuccessKeyRef.current = null
              onSelectedTeamIdChange(value)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um time" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            lastSuccessKeyRef.current = null
            void loadSection()
          }}
          disabled={!teamId || loading}
        >
          {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
          Atualizar
        </Button>
      </div>

      {!teamId ? (
        <p className="text-sm text-muted-foreground">Selecione um time para continuar.</p>
      ) : (
        <Tabs
          value={subSection}
          onValueChange={(value) => {
            lastSuccessKeyRef.current = null
            setSubSection(value as EmailSubSection)
          }}
        >
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
            <TabsTrigger value="contacts">Contatos</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!canManage}
                onClick={() => setCreateCampaignOpen(true)}
              >
                <Plus data-icon="inline-start" />
                Nova campanha
              </Button>
            </div>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Nenhuma campanha encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{campaign.name}</span>
                            {campaign.managedByCorretorStudio ? (
                              <ManagedByCorretorStudioBadge />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{campaign.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {campaign.creator?.fullName?.trim() || campaign.creator?.email || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canManage || submitting || campaign.status === "sending"}
                            onClick={() => void handleSend(campaign.id)}
                          >
                            <Send data-icon="inline-start" />
                            Disparar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button type="button" disabled={!canManage} onClick={() => setCreateListOpen(true)}>
                <Plus data-icon="inline-start" />
                Nova lista
              </Button>
            </div>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {contactLists.map((list) => (
                  <Card key={list.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{list.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <span>{list.totalContacts.toLocaleString("pt-BR")} contatos</span>
                      <span>
                        Criado por: {list.creator?.fullName?.trim() || list.creator?.email || "—"}
                      </span>
                      {list.managedByCorretorStudio ? <ManagedByCorretorStudioBadge /> : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!canManage}
                onClick={() => setCreateTemplateOpen(true)}
              >
                <Plus data-icon="inline-start" />
                Novo template
              </Button>
            </div>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm">
                      <span className="text-muted-foreground">{template.subject}</span>
                      {template.managedByCorretorStudio ? <ManagedByCorretorStudioBadge /> : null}
                      <Button asChild variant="outline" size="sm" className="w-fit">
                        <Link
                          href={`/backoffice/clients/${masterId}/emails/templates/${template.id}?teamId=${teamId}`}
                        >
                          Abrir editor
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico">
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Campanha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Nenhum envio encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.recipientEmail}</TableCell>
                        <TableCell>{log.subject ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{log.status}</Badge>
                        </TableCell>
                        <TableCell>{log.campaign?.name ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="configuracoes">
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Configurações do time</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(settings ?? {}, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metricas">
            {loading || !analytics ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Enviados</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {analytics.totals.sent.toLocaleString("pt-BR")}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {(analytics.rates.deliverabilityRate * 100).toFixed(1)}%
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Abertura</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {(analytics.rates.openRate * 100).toFixed(1)}%
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cliques</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {(analytics.rates.clickRate * 100).toFixed(1)}%
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={createCampaignOpen} onOpenChange={setCreateCampaignOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel>Nome</FieldLabel>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Template</FieldLabel>
                <Select value={campaignTemplateId} onValueChange={setCampaignTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Lista de contatos</FieldLabel>
                <Select value={campaignListId} onValueChange={setCampaignListId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactLists
                      .filter((list) => !list.isBlocklist)
                      .map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={
                submitting ||
                !campaignName.trim() ||
                !campaignTemplateId ||
                !campaignListId
              }
              onClick={() => void handleCreateCampaign()}
            >
              {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nova lista de contatos</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel>Nome</FieldLabel>
                <Input value={listName} onChange={(e) => setListName(e.target.value)} />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={submitting || !listName.trim()}
              onClick={() => void handleCreateList()}
            >
              {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Novo template</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel>Nome</FieldLabel>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Assunto</FieldLabel>
                <Input
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={submitting || !templateName.trim() || !templateSubject.trim()}
              onClick={() => void handleCreateTemplate()}
            >
              {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
