"use client"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { ArrowLeft, Eye, GripVertical, HelpCircle, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useTeamContext } from "@/app/context/TeamContext"
import { useUserContext } from "@/app/context/UserContext"
import { usePageBreadcrumb } from "@/app/context/PageBreadcrumbContext"
import { publicFormsService } from "../services/PublicFormsService"
import { PublicFormRenderer } from "@/components/public-forms/PublicFormRenderer"
import {
  applyHealthPlanCatalogToDraft,
  createHealthPlanSimulatorDraft,
} from "@/lib/public-forms/templates/health-plan-simulator"
import type {
  PublicFormDraftInput,
  PublicFormQuestionInput,
  PublicFormSnapshot,
} from "@/lib/public-forms/types"
import { getPageKey, getQuestionStepErrors, QUESTION_TYPE_OPTIONS } from "@/lib/public-forms/pages"
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types"
import type {
  PublicFormMappingTarget,
  PublicFormQuestionType,
  PublicFormRuleAction,
  PublicFormRuleOperator,
} from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
import type { PublicFormSettings } from "../context/PublicFormsTypes"
import { publicFormsClientService } from "../services/PublicFormsService"
const steps = ["Básico", "Perguntas", "Regras", "Pontuação", "Aparência", "Revisar"] as const
const emptyDraft: PublicFormDraftInput = {
  name: "",
  description: "",
  assignedSdrId: null,
  eligibleCloserIds: [],
  coverTitle: "",
  coverDescription: "",
  ctaLabel: "Começar",
  successTitle: "Respostas enviadas",
  successDescription: "Obrigado pelo seu interesse.",
  useDefaultTheme: true,
  backgroundColor: "#FFFFFF",
  textColor: "#18181B",
  lineColor: "#E4E4E7",
  schedulingEnabled: false,
  meetingDurationMinutes: 30,
  schedulingMessage: "",
  formKind: "standard",
  questions: [],
  rules: [],
  scoreBands: [],
}
type Member = { profileId: string; name: string; functions: ("SDR" | "CLOSER")[] }
export function PublicFormWizard({ formId }: { formId?: string }) {
  const { activeTeam } = useTeamContext(),
    { user } = useUserContext(),
    params = useParams<{ supabaseId: string }>(),
    router = useRouter(),
    searchParams = useSearchParams(),
    { setOverride } = usePageBreadcrumb(),
    [draft, setDraft] = useState<PublicFormDraftInput>(() =>
      formId ? emptyDraft : createHealthPlanSimulatorDraft(),
    ),
    [step, setStep] = useState(0),
    [members, setMembers] = useState<Member[]>([]),
    [loading, setLoading] = useState(Boolean(formId)),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    [currentId, setCurrentId] = useState(formId),
    [customFields, setCustomFields] = useState<LeadCustomFieldDefinitionDTO[]>([]),
    [healthPlans, setHealthPlans] = useState<Array<{ id: string; name: string }>>([]),
    [settings, setSettings] = useState<PublicFormSettings | null>(null),
    [confirmExit, setConfirmExit] = useState(false)
  useEffect(() => {
    setOverride({ label: formId ? draft.name || "Editar formulário" : "Novo formulário" })
    return () => setOverride(null)
  }, [setOverride, formId, draft.name])
  useEffect(() => {
    if (!activeTeam?.id || !user?.id) return
    const h = { "x-supabase-user-id": user.id, "x-team-id": activeTeam.id }
    void fetch(`/api/v1/teams/${activeTeam.id}/members`, { headers: h })
      .then((r) => r.json())
      .then((o) => setMembers(o.result?.members ?? []))
    void fetch(`/api/v1/teams/${activeTeam.id}/lead-custom-fields`, { headers: h })
      .then((r) => r.json())
      .then((o) =>
        setCustomFields(
          Array.isArray(o.result)
            ? o.result.filter((field: LeadCustomFieldDefinitionDTO) => field.isActive)
            : [],
        ),
      )
    void fetch("/api/v1/health-plans", { headers: h })
      .then((r) => r.json())
      .then((o) => {
        const plans = Array.isArray(o.result?.healthPlans) ? o.result.healthPlans : []
        setHealthPlans(plans)
        if (!formId && plans.length > 0) {
          setDraft((current) =>
            applyHealthPlanCatalogToDraft(
              current,
              plans.map((plan: { name: string }) => plan.name),
            ),
          )
        }
      })
    void publicFormsClientService
      .getSettings({ supabaseId: user.id, teamId: activeTeam.id })
      .then(setSettings)
      .catch(() => null)
    if (formId)
      void publicFormsService
        .get(user.id, activeTeam.id, formId)
        .then((f) =>
          setDraft({
            ...emptyDraft,
            ...f,
            questions: f.questions ?? [],
            rules: f.rules ?? [],
            scoreBands: f.scoreBands ?? [],
          }),
        )
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false))
  }, [activeTeam?.id, user?.id, formId])
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    addEventListener("beforeunload", h)
    return () => removeEventListener("beforeunload", h)
  }, [dirty])
  const change = (patch: Partial<PublicFormDraftInput>) => {
    setDraft({ ...draft, ...patch })
    setDirty(true)
  }
  async function save() {
    if (!activeTeam?.id || !user?.id) return null
    setSaving(true)
    try {
      const f = await publicFormsService.save(user.id, activeTeam.id, currentId ?? null, draft)
      setCurrentId(f.id)
      setDirty(false)
      toast.success("Rascunho salvo")
      if (!currentId) router.replace(`/${params.supabaseId}/forms/${f.id}`)
      return f
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
      return null
    } finally {
      setSaving(false)
    }
  }
  async function publish() {
    const f = await save()
    if (!f || !activeTeam?.id || !user?.id) return
    try {
      await publicFormsService.action(user.id, activeTeam.id, f.id, "publish")
      toast.success("Formulário publicado")
      router.push(`/${params.supabaseId}/forms`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível publicar")
    }
  }
  async function openPreview() {
    const form = await save()
    if (form) {
      window.open(
        `/${params.supabaseId}/forms/${form.id}?preview=1`,
        "_blank",
        "noopener,noreferrer",
      )
    }
  }
  const snapshot = useMemo<PublicFormSnapshot>(
    () => ({
      ...draft,
      formId: currentId ?? "preview",
      publicId: "preview",
      version: 0,
      publishedAt: new Date(0).toISOString(),
      theme: {
        backgroundColor: draft.useDefaultTheme
          ? settings?.defaultBackgroundColor || "#FFFFFF"
          : draft.backgroundColor || "#FFFFFF",
        textColor: draft.useDefaultTheme
          ? settings?.defaultTextColor || "#18181B"
          : draft.textColor || "#18181B",
        lineColor: draft.useDefaultTheme
          ? settings?.defaultLineColor || "#E4E4E7"
          : draft.lineColor || "#E4E4E7",
      },
      eligibleClosers: members
        .filter((member) => draft.eligibleCloserIds.includes(member.profileId))
        .map((member) => ({ id: member.profileId, name: member.name })),
      questions: draft.questions
        .filter((q): q is PublicFormQuestionInput & { id: string } => Boolean(q.id))
        .map((q, position) => ({ ...q, position })),
    }),
    [draft, currentId, members, settings],
  )
  if (loading) return <div className="p-6">Carregando formulário...</div>
  if (searchParams.get("preview") === "1") {
    return (
      <main className="flex min-h-dvh flex-col bg-muted/40">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-4 py-3">
          <Button variant="secondary" asChild>
            <Link href={`/${params.supabaseId}/forms/${currentId}`}>
              <ArrowLeft data-icon="inline-start" />
              Voltar ao editor
            </Link>
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4">
          <div
            className="public-form-page light h-[calc(100dvh-4.5rem)] w-full max-w-[580px] overflow-hidden rounded-2xl border bg-background shadow-sm [color-scheme:light]"
          >
            <PublicFormRenderer snapshot={snapshot} preview className="h-full min-h-[60dvh]" />
          </div>
        </div>
      </main>
    )
  }
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <Button asChild variant="ghost">
          <Link
            href={`/${params.supabaseId}/forms`}
            onClick={(event) => {
              if (dirty) {
                event.preventDefault()
                setConfirmExit(true)
              }
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            Formulários
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void save()} disabled={saving}>
            <Save data-icon="inline-start" />
            {saving ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button variant="outline" onClick={() => void openPreview()}>
            <Eye data-icon="inline-start" />
            Preview
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[190px_minmax(360px,1fr)_minmax(360px,0.9fr)]">
        <aside className="hidden border-r p-4 lg:block">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Etapas
          </p>
          <nav className="flex flex-col gap-1">
            {steps.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${step === i ? "bg-accent font-medium" : "hover:bg-accent/50"}`}
              >
                <span className="grid size-6 place-items-center rounded-full border text-xs">
                  {i + 1}
                </span>
                {s}
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 overflow-y-auto p-5 md:p-8">
          <div className="mx-auto max-w-2xl">
            <Select value={String(step)} onValueChange={(value) => setStep(Number(value))}>
              <SelectTrigger className="mb-4 lg:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {steps.map((label, index) => (
                  <SelectItem key={label} value={String(index)}>
                    {index + 1}. {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mb-6">
              <Badge variant="secondary">
                Etapa {step + 1} de {steps.length}
              </Badge>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{steps[step]}</h1>
            </div>
            {step === 0 && <Basic draft={draft} change={change} members={members} />}{" "}
            {step === 1 && (
              <Questions
                draft={draft}
                change={change}
                customFields={customFields}
                healthPlans={healthPlans}
                members={members}
              />
            )}{" "}
            {step === 2 && <Rules draft={draft} change={change} />}{" "}
            {step === 3 && <Scores draft={draft} change={change} />}{" "}
            {step === 4 && <Appearance draft={draft} change={change} />}{" "}
            {step === 5 && (
              <Review
                draft={draft}
                onPublish={() => void publish()}
                onGoToStep={setStep}
              />
            )}
            <div className="mt-10 flex justify-between">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
                Voltar
              </Button>
              {step < steps.length - 1 ? (
                <Button
                  onClick={() => {
                    if (step === 1) {
                      const errors = getQuestionStepErrors(draft)
                      if (errors.length > 0) {
                        toast.error(errors[0])
                        return
                      }
                    }
                    setStep(step + 1)
                  }}
                >
                  Próxima etapa
                </Button>
              ) : null}
            </div>
            <Drawer>
              <DrawerTrigger asChild>
                <Button className="mt-4 w-full lg:hidden" variant="outline">
                  <Eye data-icon="inline-start" />
                  Abrir preview
                </Button>
              </DrawerTrigger>
              <DrawerContent className="public-form-page max-h-[90vh] overflow-y-auto">
                <DrawerHeader>
                  <DrawerTitle>Preview do formulário</DrawerTitle>
                </DrawerHeader>
                <PublicFormRenderer
                  snapshot={snapshot}
                  preview
                  className="public-form-page light [color-scheme:light]"
                />
              </DrawerContent>
            </Drawer>
          </div>
        </section>
        <aside className="hidden h-[calc(100dvh-3.5rem)] border-l bg-muted/30 p-4 lg:block">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview ao vivo
          </p>
          <div className="public-form-page light mx-auto h-[calc(100%-1.5rem)] w-full max-w-[580px] overflow-y-auto rounded-2xl border bg-background shadow-sm [color-scheme:light]">
            <PublicFormRenderer snapshot={snapshot} preview className="min-h-full" />
          </div>
        </aside>
      </div>
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>As alterações locais serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(`/${params.supabaseId}/forms`)}>
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
function Basic({
  draft: d,
  change,
  members,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
  members: Member[]
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Nome do formulário">
        <Input value={d.name} onChange={(e) => change({ name: e.target.value })} />
      </Field>
      <Field label="Título da capa">
        <Input
          value={d.coverTitle ?? ""}
          onChange={(e) => change({ coverTitle: e.target.value })}
        />
      </Field>
      <Field label="Descrição da capa">
        <Textarea
          value={d.coverDescription ?? ""}
          onChange={(e) => change({ coverDescription: e.target.value })}
        />
      </Field>
      <Field label="Descrição">
        <Textarea
          value={d.description ?? ""}
          onChange={(e) => change({ description: e.target.value })}
        />
      </Field>
      <Field label="Texto do botão">
        <Input value={d.ctaLabel} onChange={(e) => change({ ctaLabel: e.target.value })} />
      </Field>
      <Field label="Título de conclusão">
        <Input value={d.successTitle} onChange={(e) => change({ successTitle: e.target.value })} />
      </Field>
      <Field label="Mensagem de conclusão">
        <Textarea
          value={d.successDescription ?? ""}
          onChange={(e) => change({ successDescription: e.target.value })}
        />
      </Field>
      <Field label="SDR responsável (opcional)">
        <Select
          value={d.assignedSdrId ?? "__none__"}
          onValueChange={(v) => change({ assignedSdrId: v === "__none__" ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum (opcional)</SelectItem>
            {members
              .filter((m) => m.functions.includes("SDR"))
              .map((m) => (
                <SelectItem key={m.profileId} value={m.profileId}>
                  {m.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}
function Questions({
  draft: d,
  change,
  customFields,
  healthPlans,
  members,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
  customFields: LeadCustomFieldDefinitionDTO[]
  healthPlans: Array<{ id: string; name: string }>
  members: Member[]
}) {
  const stepErrors = getQuestionStepErrors(d)
  function updateQuestion(id: string, patch: Partial<PublicFormQuestionInput>) {
    change({
      questions: d.questions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }
  function add(pageKey?: string) {
    const key = pageKey ?? crypto.randomUUID()
    const samePage = d.questions.filter((question) => getPageKey(question) === key)
    if (pageKey && samePage.length >= 3) {
      toast.error("Cada página pode ter no máximo 3 campos")
      return
    }
    if (pageKey && samePage.some((question) => question.type === "scheduling")) {
      toast.error("A pergunta de agendamento deve ficar sozinha na página")
      return
    }
    change({
      questions: [
        ...d.questions,
        {
          id: crypto.randomUUID(),
          type: "text",
          title: "Nova pergunta",
          required: false,
          options: [],
          mappingTarget: "history",
          config: { pageKey: key },
        },
      ],
    })
  }
  function drop(r: DropResult) {
    if (!r.destination) return
    const q = [...d.questions],
      [m] = q.splice(r.source.index, 1)
    q.splice(r.destination.index, 0, m)
    change({ questions: q })
  }
  function setQuestionType(question: PublicFormQuestionInput, nextType: PublicFormQuestionType) {
    if (nextType === "scheduling") {
      if (d.questions.some((item) => item.type === "scheduling" && item.id !== question.id)) {
        toast.error("Só é permitido uma pergunta de agendamento")
        return
      }
      change({
        schedulingEnabled: true,
        questions: d.questions.map((item) =>
          item.id === question.id
            ? {
                ...item,
                type: nextType,
                required: true,
                options: [],
                config: { pageKey: crypto.randomUUID() },
              }
            : item,
        ),
      })
      return
    }
    const wasScheduling = question.type === "scheduling"
    const options =
      nextType === "health_plan"
        ? healthPlans.map((plan) => ({
            id: crypto.randomUUID(),
            label: plan.name,
            value: plan.name,
            score: 0,
          }))
        : ["single_choice", "multiple_choice"].includes(nextType) && !question.options.length
          ? [{ id: crypto.randomUUID(), label: "Opção 1", value: "opcao_1", score: 0 }]
          : question.options
    const nextQuestions = d.questions.map((item) =>
      item.id === question.id ? { ...item, type: nextType, options } : item,
    )
    change({
      questions: nextQuestions,
      schedulingEnabled: wasScheduling
        ? nextQuestions.some((item) => item.type === "scheduling")
        : d.schedulingEnabled,
    })
  }
  return (
    <div className="flex flex-col gap-4">
      {stepErrors.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {stepErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <DragDropContext onDragEnd={drop}>
        <Droppable droppableId="questions">
          {(p) => (
            <div ref={p.innerRef} {...p.droppableProps} className="flex flex-col gap-3">
              {d.questions.map((q, i) => {
                const pageKey = getPageKey(q)
                const pageSize = d.questions.filter((item) => getPageKey(item) === pageKey).length
                return (
                  <Draggable draggableId={q.id!} index={i} key={q.id}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className="rounded-lg border bg-card p-4"
                      >
                        <div className="mb-4 flex items-center gap-2">
                          <button type="button" {...p.dragHandleProps} aria-label="Reordenar pergunta">
                            <GripVertical className="text-muted-foreground" />
                          </button>
                          <span className="font-medium">Pergunta {i + 1}</span>
                          <Badge variant="secondary">
                            Página · {pageSize} campo{pageSize === 1 ? "" : "s"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto"
                            onClick={() => {
                              const used = d.rules.some(
                                (r) => r.sourceQuestionId === q.id || r.targetQuestionId === q.id,
                              )
                              if (used) {
                                toast.error("Remova as regras que usam esta pergunta")
                                return
                              }
                              const nextQuestions = d.questions.filter((x) => x.id !== q.id)
                              change({
                                questions: nextQuestions,
                                schedulingEnabled: nextQuestions.some(
                                  (item) => item.type === "scheduling",
                                ),
                              })
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            className="sm:col-span-2"
                            value={q.title}
                            onChange={(e) => updateQuestion(q.id!, { title: e.target.value })}
                          />
                          <Input
                            className="sm:col-span-2"
                            value={q.description ?? ""}
                            placeholder="Descrição opcional"
                            onChange={(event) =>
                              updateQuestion(q.id!, { description: event.target.value })
                            }
                          />
                          <Input
                            className="sm:col-span-2"
                            value={q.placeholder ?? ""}
                            placeholder="Placeholder opcional"
                            onChange={(event) =>
                              updateQuestion(q.id!, { placeholder: event.target.value })
                            }
                          />
                          <Select
                            value={q.type}
                            onValueChange={(v) => setQuestionType(q, v as PublicFormQuestionType)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {QUESTION_TYPE_OPTIONS.map(({ value, label }) => (
                                <SelectItem value={value} key={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={q.mappingTarget ?? "history"}
                            onValueChange={(v) =>
                              updateQuestion(q.id!, {
                                mappingTarget: v as PublicFormMappingTarget,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="history">Somente histórico</SelectItem>
                              <SelectItem value="native_field">Campo nativo</SelectItem>
                              <SelectItem value="custom_field">Campo personalizado</SelectItem>
                              <SelectItem value="notes">Observações</SelectItem>
                            </SelectContent>
                          </Select>
                          {q.mappingTarget === "native_field" && (
                            <Select
                              value={q.mappingKey ?? ""}
                              onValueChange={(v) => updateQuestion(q.id!, { mappingKey: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Campo do lead" />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  ["age", "Idade"],
                                  ["cnpj", "CNPJ"],
                                  ["email", "E-mail"],
                                  ["referenceHospital", "Hospital de referência"],
                                  ["name", "Nome"],
                                  ["currentHealthPlan", "Plano atual"],
                                  ["phone", "Telefone"],
                                  ["currentTreatment", "Tratamento atual"],
                                  ["currentValue", "Valor atual"],
                                ]
                                  .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
                                  .map(([value, label]) => (
                                    <SelectItem value={value} key={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                          {q.mappingTarget === "custom_field" && (
                            <Select
                              value={q.mappingKey ?? ""}
                              onValueChange={(value) => updateQuestion(q.id!, { mappingKey: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Campo personalizado" />
                              </SelectTrigger>
                              <SelectContent>
                                {[...customFields]
                                  .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
                                  .map((field) => (
                                    <SelectItem key={field.id} value={field.key}>
                                      {field.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={q.required}
                              onCheckedChange={(v) => updateQuestion(q.id!, { required: v })}
                            />
                            Obrigatória
                          </label>
                        </div>
                        {q.type === "scheduling" ? (
                          <div className="mt-4">
                            <ScheduleInline draft={d} change={change} members={members} />
                          </div>
                        ) : null}
                        {["single_choice", "multiple_choice"].includes(q.type) && (
                          <div className="mt-4 flex flex-col gap-2">
                            {q.options.map((o) => (
                              <div className="flex gap-2" key={o.id}>
                                <Input
                                  value={o.label}
                                  onChange={(e) =>
                                    change({
                                      questions: d.questions.map((x) =>
                                        x.id === q.id
                                          ? {
                                              ...x,
                                              options: x.options.map((y) =>
                                                y.id === o.id
                                                  ? {
                                                      ...y,
                                                      label: e.target.value,
                                                      value: e.target.value
                                                        .toLowerCase()
                                                        .replace(/\W+/g, "_"),
                                                    }
                                                  : y,
                                              ),
                                            }
                                          : x,
                                      ),
                                    })
                                  }
                                />
                                <Input
                                  aria-label="Pontuação"
                                  className="w-24"
                                  type="number"
                                  value={o.score}
                                  onChange={(e) =>
                                    change({
                                      questions: d.questions.map((x) =>
                                        x.id === q.id
                                          ? {
                                              ...x,
                                              options: x.options.map((y) =>
                                                y.id === o.id
                                                  ? { ...y, score: Number(e.target.value) }
                                                  : y,
                                              ),
                                            }
                                          : x,
                                      ),
                                    })
                                  }
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    change({
                                      questions: d.questions.map((x) =>
                                        x.id === q.id
                                          ? { ...x, options: x.options.filter((y) => y.id !== o.id) }
                                          : x,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                change({
                                  questions: d.questions.map((x) =>
                                    x.id === q.id
                                      ? {
                                          ...x,
                                          options: [
                                            ...x.options,
                                            {
                                              id: crypto.randomUUID(),
                                              label: `Opção ${x.options.length + 1}`,
                                              value: `option_${x.options.length + 1}`,
                                              score: 0,
                                            },
                                          ],
                                        }
                                      : x,
                                  ),
                                })
                              }
                            >
                              <Plus data-icon="inline-start" />
                              Opção
                            </Button>
                          </div>
                        )}
                        {q.type !== "scheduling" && pageSize < 3 ? (
                          <Button className="mt-3" variant="ghost" size="sm" onClick={() => add(pageKey)}>
                            <Plus data-icon="inline-start" />
                            Adicionar campo nesta página
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {p.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Button variant="outline" onClick={() => add()}>
        <Plus data-icon="inline-start" />
        Adicionar pergunta
      </Button>
    </div>
  )
}
function Rules({
  draft: d,
  change,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {d.rules.map((r) => (
        <div className="grid gap-2 rounded-lg border p-4 sm:grid-cols-2" key={r.id}>
          <Select
            value={r.sourceQuestionId}
            onValueChange={(v) =>
              change({
                rules: d.rules.map((x) => (x.id === r.id ? { ...x, sourceQuestionId: v } : x)),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {d.questions.map((q) => (
                <SelectItem key={q.id} value={q.id!}>
                  {q.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={r.targetQuestionId}
            onValueChange={(v) =>
              change({
                rules: d.rules.map((x) => (x.id === r.id ? { ...x, targetQuestionId: v } : x)),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {d.questions.map((q) => (
                <SelectItem key={q.id} value={q.id!}>
                  {q.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={r.operator}
            onValueChange={(v) =>
              change({
                rules: d.rules.map((x) =>
                  x.id === r.id ? { ...x, operator: v as PublicFormRuleOperator } : x,
                ),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">É igual a</SelectItem>
              <SelectItem value="not_equals">Não é igual a</SelectItem>
              <SelectItem value="contains">Contém</SelectItem>
              <SelectItem value="selected">Selecionado</SelectItem>
              <SelectItem value="not_selected">Não selecionado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Valor comparado"
            value={String(r.comparisonValue ?? "")}
            onChange={(e) =>
              change({
                rules: d.rules.map((x) =>
                  x.id === r.id ? { ...x, comparisonValue: e.target.value } : x,
                ),
              })
            }
          />
          <Select
            value={r.action}
            onValueChange={(v) =>
              change({
                rules: d.rules.map((x) =>
                  x.id === r.id ? { ...x, action: v as PublicFormRuleAction } : x,
                ),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Exibir destino</SelectItem>
              <SelectItem value="skip">Pular destino</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            onClick={() => change({ rules: d.rules.filter((x) => x.id !== r.id) })}
          >
            <Trash2 data-icon="inline-start" />
            Remover
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        disabled={d.questions.length < 2}
        onClick={() =>
          change({
            rules: [
              ...d.rules,
              {
                id: crypto.randomUUID(),
                sourceQuestionId: d.questions[0].id!,
                targetQuestionId: d.questions[1].id!,
                operator: "equals",
                comparisonValue: "",
                action: "skip",
              },
            ],
          })
        }
      >
        <Plus data-icon="inline-start" />
        Adicionar regra
      </Button>
    </div>
  )
}
function Scores({
  draft: d,
  change,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Defina faixas de pontuação com base na soma das opções respondidas.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Como funciona a pontuação">
              <HelpCircle />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Como funciona a pontuação</DialogTitle>
              <DialogDescription>
                Use pontuação para classificar leads automaticamente após o envio.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 flex flex-col gap-3 text-sm text-muted-foreground">
              <p>
                Em perguntas de escolha (única ou múltipla), cada opção pode ter uma pontuação.
                Ao responder, a soma das opções selecionadas gera o score do lead.
              </p>
              <p>
                As faixas (ex.: 0–10 Qualificado) interpretam esse total. O resumo da faixa fica
                disponível no CRM/histórico para o time comercial.
              </p>
              <p>
                Regras condicionais não alteram o cálculo: só controlam quais perguntas aparecem.
                Configure scores nas opções da etapa Perguntas e as faixas aqui.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {d.scoreBands.map((b) => (
        <div
          className="grid gap-2 rounded-lg border p-4 sm:grid-cols-[1fr_100px_100px_auto]"
          key={b.id}
        >
          <Input
            value={b.label}
            onChange={(e) =>
              change({
                scoreBands: d.scoreBands.map((x) =>
                  x.id === b.id ? { ...x, label: e.target.value } : x,
                ),
              })
            }
          />
          <Input
            type="number"
            value={b.minScore}
            onChange={(e) =>
              change({
                scoreBands: d.scoreBands.map((x) =>
                  x.id === b.id ? { ...x, minScore: Number(e.target.value) } : x,
                ),
              })
            }
          />
          <Input
            type="number"
            value={b.maxScore}
            onChange={(e) =>
              change({
                scoreBands: d.scoreBands.map((x) =>
                  x.id === b.id ? { ...x, maxScore: Number(e.target.value) } : x,
                ),
              })
            }
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => change({ scoreBands: d.scoreBands.filter((x) => x.id !== b.id) })}
          >
            <Trash2 />
          </Button>
          <Textarea
            className="sm:col-span-4"
            value={b.summary ?? ""}
            placeholder="Resumo interno da qualificação"
            onChange={(event) =>
              change({
                scoreBands: d.scoreBands.map((item) =>
                  item.id === b.id ? { ...item, summary: event.target.value } : item,
                ),
              })
            }
          />
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          change({
            scoreBands: [
              ...d.scoreBands,
              {
                id: crypto.randomUUID(),
                label: "Qualificado",
                minScore: 0,
                maxScore: 10,
                summary: "",
              },
            ],
          })
        }
      >
        <Plus data-icon="inline-start" />
        Adicionar faixa
      </Button>
    </div>
  )
}
function ScheduleInline({
  draft: d,
  change,
  members,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
  members: Member[]
}) {
  const closers = members.filter((m) => m.functions.includes("CLOSER"))
  const allSelected =
    closers.length > 0 && closers.every((m) => d.eligibleCloserIds.includes(m.profileId))
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">Configuração do agendamento</p>
      <Field label="Duração em minutos">
        <Input
          type="number"
          value={d.meetingDurationMinutes}
          onChange={(e) => change({ meetingDurationMinutes: Number(e.target.value) })}
        />
      </Field>
      <Field label="Mensagem da reunião">
        <Textarea
          value={d.schedulingMessage ?? ""}
          onChange={(e) => change({ schedulingMessage: e.target.value })}
        />
      </Field>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label>Closers elegíveis</Label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) =>
                change({
                  eligibleCloserIds: v ? closers.map((m) => m.profileId) : [],
                })
              }
            />
            Selecionar todos
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {closers.map((m) => (
            <label className="flex items-center gap-2 text-sm" key={m.profileId}>
              <Checkbox
                checked={d.eligibleCloserIds.includes(m.profileId)}
                onCheckedChange={(v) =>
                  change({
                    eligibleCloserIds: v
                      ? [...d.eligibleCloserIds, m.profileId]
                      : d.eligibleCloserIds.filter((x) => x !== m.profileId),
                  })
                }
              />
              {m.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
function Appearance({
  draft: d,
  change,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">Usar estilo padrão do time</p>
          <p className="text-sm text-muted-foreground">
            Mantém o formulário sincronizado com as configurações.
          </p>
        </div>
        <Switch
          checked={d.useDefaultTheme}
          onCheckedChange={(v) => change({ useDefaultTheme: v })}
        />
      </label>
      {!d.useDefaultTheme &&
        [
          ["Fundo", "backgroundColor"],
          ["Texto", "textColor"],
          ["Linhas e opções", "lineColor"],
        ].map(([l, k]) => (
          <div className="flex items-center justify-between" key={k}>
            <Label>{l}</Label>
            <Input
              className="h-10 w-24 p-1"
              type="color"
              value={String(d[k as keyof PublicFormDraftInput] ?? "#FFFFFF")}
              onChange={(e) => change({ [k]: e.target.value })}
            />
          </div>
        ))}
    </div>
  )
}
function Review({
  draft: d,
  onPublish,
  onGoToStep,
}: {
  draft: PublicFormDraftInput
  onPublish: () => void
  onGoToStep: (step: number) => void
}) {
  const questionErrors = getQuestionStepErrors(d)
  const checks = [
    { ok: Boolean(d.name), text: "Nome definido", step: 0 },
    { ok: d.questions.length > 0, text: "Ao menos uma pergunta", step: 1 },
    {
      ok: d.questions.some((q) => q.mappingTarget === "native_field" && q.mappingKey === "name"),
      text: "Nome do lead mapeado",
      step: 1,
    },
    {
      ok: !d.schedulingEnabled || d.eligibleCloserIds.length > 0,
      text: "Closer selecionado para agenda",
      step: 1,
    },
    {
      ok: questionErrors.length === 0,
      text: "Perguntas configuradas corretamente",
      step: 1,
    },
  ]
  const ready = checks.every((c) => c.ok)
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border p-4">
        <ul className="flex flex-col gap-2 text-sm">
          {checks.map((c) => (
            <li key={c.text} className="flex items-center justify-between gap-2">
              <button type="button" className="text-left hover:underline" onClick={() => onGoToStep(c.step)}>
                {c.text}
              </button>
              <Badge variant={c.ok ? "secondary" : "destructive"}>{c.ok ? "Ok" : "Pendente"}</Badge>
            </li>
          ))}
        </ul>
      </div>
      {!ready ? (
        <Alert variant="destructive">
          <AlertDescription>Conclua os itens pendentes antes de publicar.</AlertDescription>
        </Alert>
      ) : null}
      <Button disabled={!ready} onClick={onPublish}>
        Publicar formulário
      </Button>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
