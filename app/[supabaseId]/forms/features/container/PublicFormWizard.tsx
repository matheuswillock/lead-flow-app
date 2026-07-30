"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { ArrowLeft, Eye, GripVertical, HelpCircle, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useOptionalTeamContext } from "@/app/context/TeamContext"
import { useOptionalUser } from "@/app/context/UserContext"
import { usePageBreadcrumb } from "@/app/context/PageBreadcrumbContext"
import { publicFormsService } from "../services/PublicFormsService"
import { PublicFormRenderer } from "@/components/public-forms/PublicFormRenderer"
import { ThemeProvider } from "@/components/theme-provider"
import {
  applyHealthPlanCatalogToDraft,
  createHealthPlanSimulatorDraft,
} from "@/lib/public-forms/templates/health-plan-simulator"
import type {
  PublicFormCoverHighlight,
  PublicFormDraftInput,
  PublicFormQuestionInput,
  PublicFormRuleInput,
  PublicFormScorePolarity,
  PublicFormSnapshot,
  PublicFormSuccessAction,
  PublicFormThankYouPage,
} from "@/lib/public-forms/types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "@/lib/public-forms/types"
import {
  createDefaultThankYouPage,
  normalizeThankYouPages,
  thankYouPageLabel,
} from "@/lib/public-forms/thank-you-pages"
import {
  rebalanceAfterQuestionWeightEdit,
  redistributeQuestionScoresEvenly,
  sumQuestionScoreWeights,
  withEqualOptionScores,
} from "@/lib/public-forms/scoring"
import { inverseRuleAction } from "@/lib/public-forms/engine"
import {
  getPageKey,
  getQuestionStepErrors,
  groupQuestionsByPage,
  QUESTION_TYPE_OPTIONS,
} from "@/lib/public-forms/pages"
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
import { Slider } from "@/components/ui/slider"
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import type { PublicFormSettings } from "../context/PublicFormsTypes"
import { publicFormsClientService } from "../services/PublicFormsService"

const steps = [
  "Básico",
  "Capa",
  "Perguntas",
  "Agradecimentos",
  "Regras",
  "Pontuação",
  "Aparência",
  "Revisar",
] as const

const defaultThankYouPageSeed = createDefaultThankYouPage()

const emptyDraft: PublicFormDraftInput = {
  name: "",
  description: null,
  assignedSdrId: null,
  eligibleCloserIds: [],
  coverTitle: "",
  coverDescription: "",
  coverBadge: null,
  coverHighlights: [],
  ctaLabel: "Começar",
  successTitle: defaultThankYouPageSeed.title,
  successDescription: defaultThankYouPageSeed.description,
  successActions: [],
  thankYouPages: [defaultThankYouPageSeed],
  defaultThankYouPageId: defaultThankYouPageSeed.id,
  useDefaultTheme: true,
  backgroundColor: "#FFFFFF",
  textColor: "#18181B",
  lineColor: "#E4E4E7",
  accentColor: "#FF6900",
  buttonTextColor: "#FFFFFF",
  inputBackgroundColor: "#FFFFFF",
  schedulingEnabled: false,
  meetingDurationMinutes: 30,
  schedulingMessage: "",
  formKind: "standard",
  questions: [],
  rules: [],
  scoreBands: [],
}

type Member = { profileId: string; name: string; functions: ("SDR" | "CLOSER")[] }

export type PublicFormWizardHost = {
  listHref: string
  formHref: (formId: string) => string
  previewHref: (formId: string) => string
  loadContext: () => Promise<{
    members: Member[]
    customFields: LeadCustomFieldDefinitionDTO[]
    healthPlans: Array<{ id: string; name: string }>
    settings: PublicFormSettings | null
  }>
  getForm: (formId: string) => Promise<PublicFormDraftInput & { id: string }>
  save: (
    formId: string | null,
    input: PublicFormDraftInput
  ) => Promise<PublicFormDraftInput & { id: string }>
  publish: (formId: string) => Promise<void>
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function ruleActionLabel(action: PublicFormRuleAction): string {
  if (action === "show") return "Exibir pergunta"
  if (action === "skip") return "Ocultar pergunta"
  return "Pular até pergunta"
}

function ruleActionTargetLabel(
  action: PublicFormRuleAction,
  target: string,
  elseBranch: boolean,
): string {
  if (action === "jump_to" && elseBranch) return "fluxo padrão"
  return target
}

function questionIndexById(questions: PublicFormQuestionInput[], id: string): number {
  return questions.findIndex((question) => question.id === id)
}

function ruleTargetQuestions(
  questions: PublicFormQuestionInput[],
  sourceQuestionId: string,
  action: PublicFormRuleAction,
) {
  if (action === "jump_to") {
    const sourceIndex = questionIndexById(questions, sourceQuestionId)
    if (sourceIndex < 0) return questions
    return questions.filter((_, index) => index > sourceIndex)
  }
  return questions
}
function ruleOperatorLabel(operator: PublicFormRuleOperator): string {
  switch (operator) {
    case "equals":
      return "é igual a"
    case "not_equals":
      return "não é igual a"
    case "contains":
      return "contém"
    case "selected":
      return "está selecionado"
    case "not_selected":
      return "não está selecionado"
    default: {
      const _exhaustive: never = operator
      return String(_exhaustive)
    }
  }
}

function questionTitleById(
  questions: PublicFormQuestionInput[],
  id: string,
  draft?: PublicFormDraftInput,
  thankYouPageId?: string | null,
): string {
  if (id === PUBLIC_FORM_THANK_YOU_TARGET) {
    return thankYouPageLabel(draft ?? emptyDraft, thankYouPageId)
  }
  return questions.find((q) => q.id === id)?.title?.trim() || "pergunta"
}

function buildRuleSentence(rule: PublicFormRuleInput, questions: PublicFormQuestionInput[], draft: PublicFormDraftInput): string {
  const source = questionTitleById(questions, rule.sourceQuestionId, draft)
  const target = questionTitleById(questions, rule.targetQuestionId, draft, rule.targetThankYouPageId)
  const value =
    rule.comparisonValue === undefined || rule.comparisonValue === null || rule.comparisonValue === ""
      ? "…"
      : String(rule.comparisonValue)
  const elseAction = rule.elseAction ?? inverseRuleAction(rule.action)
  const elseTarget = ruleActionTargetLabel(
    elseAction,
    questionTitleById(questions, rule.targetQuestionId, draft, rule.targetThankYouPageId),
    true,
  )
  return `Se ${source} ${ruleOperatorLabel(rule.operator)} ${value}, então ${ruleActionLabel(rule.action).toLowerCase()} ${target}; senão ${ruleActionLabel(elseAction).toLowerCase()} ${elseTarget}.`
}

function flattenPages(pages: Array<{ pageKey: string; questions: PublicFormQuestionInput[] }>) {
  return pages.flatMap((page) => page.questions)
}

function reorderPages(
  questions: PublicFormQuestionInput[],
  sourceIndex: number,
  destinationIndex: number,
): PublicFormQuestionInput[] {
  const pages = groupQuestionsByPage(questions)
  const [moved] = pages.splice(sourceIndex, 1)
  if (!moved) return questions
  pages.splice(destinationIndex, 0, moved)
  return flattenPages(pages)
}

function buildSavePayload(draft: PublicFormDraftInput): PublicFormDraftInput {
  return normalizeThankYouPages({
    ...draft,
    name: draft.name.trim(),
    description: draft.description?.trim() || null,
  })
}

function syncThankYouPage(
  pages: PublicFormThankYouPage[],
  pageId: string,
  patch: Partial<PublicFormThankYouPage>,
): PublicFormThankYouPage[] {
  return pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page))
}

function syncThankYouDraft(
  pages: PublicFormThankYouPage[],
  defaultThankYouPageId: string,
): Partial<PublicFormDraftInput> {
  const defaultPage = pages.find((page) => page.id === defaultThankYouPageId) ?? pages[0]
  if (!defaultPage) return { thankYouPages: pages, defaultThankYouPageId }
  return {
    thankYouPages: pages.map((page) => ({ ...page, isDefault: page.id === defaultPage.id })),
    defaultThankYouPageId: defaultPage.id,
    successTitle: defaultPage.title,
    successDescription: defaultPage.description,
    successActions: defaultPage.actions,
  }
}

function PreviewLight({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ThemeProvider forcedTheme="light" attribute="class" enableSystem={false}>
      <div className={className}>{children}</div>
    </ThemeProvider>
  )
}

export function PublicFormWizard({
  formId,
  host,
}: {
  formId?: string
  host?: PublicFormWizardHost
}) {
  const productTeam = useOptionalTeamContext()
  const user = useOptionalUser()?.user ?? null
  const params = useParams<{ supabaseId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setOverride } = usePageBreadcrumb()
  const isHealthPlanTemplate =
    !formId && searchParams.get("template") === "health_plan_simulator"
  const activeTeam = host ? { id: "host" } : productTeam?.activeTeam
  const listHref = host?.listHref ?? `/${params.supabaseId}/forms`
  const formHref = host?.formHref ?? ((id: string) => `/${params.supabaseId}/forms/${id}`)
  const previewHref =
    host?.previewHref ?? ((id: string) => `/${params.supabaseId}/forms/${id}?preview=1`)

  if (!host && !productTeam) {
    throw new Error("PublicFormWizard requires TeamProvider when host is not provided")
  }

  const [draft, setDraft] = useState<PublicFormDraftInput>(() => {
    if (formId) return emptyDraft
    if (isHealthPlanTemplate) return createHealthPlanSimulatorDraft()
    return emptyDraft
  })
  const [step, setStep] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(Boolean(formId))
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [currentId, setCurrentId] = useState(formId)
  const [customFields, setCustomFields] = useState<LeadCustomFieldDefinitionDTO[]>([])
  const [healthPlans, setHealthPlans] = useState<Array<{ id: string; name: string }>>([])
  const [settings, setSettings] = useState<PublicFormSettings | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)

  useEffect(() => {
    setOverride({ label: formId ? draft.name || "Editar formulário" : "Novo formulário" })
    return () => setOverride(null)
  }, [setOverride, formId, draft.name])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (host) {
        try {
          const context = await host.loadContext()
          if (cancelled) return
          setMembers(context.members)
          setCustomFields(context.customFields.filter((field) => field.isActive))
          setHealthPlans(context.healthPlans)
          setSettings(context.settings)
          if (isHealthPlanTemplate && context.healthPlans.length > 0) {
            setDraft((current) =>
              applyHealthPlanCatalogToDraft(
                current,
                context.healthPlans.map((plan) => plan.name),
              ),
            )
          }
          if (formId) {
            const form = await host.getForm(formId)
            if (cancelled) return
            setDraft({
              ...emptyDraft,
              ...form,
              coverHighlights: form.coverHighlights ?? [],
              successActions: form.successActions ?? [],
              questions: form.questions ?? [],
              rules: form.rules ?? [],
              scoreBands: form.scoreBands ?? [],
            })
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Erro ao carregar")
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      if (!activeTeam?.id || !user?.id) return
      const h = { "x-supabase-user-id": user.id, "x-team-id": activeTeam.id }
      void fetch(`/api/v1/teams/${activeTeam.id}/members`, { headers: h })
        .then((r) => r.json())
        .then((o) => {
          if (!cancelled) setMembers(o.result?.members ?? [])
        })
      void fetch(`/api/v1/teams/${activeTeam.id}/lead-custom-fields`, { headers: h })
        .then((r) => r.json())
        .then((o) => {
          if (cancelled) return
          setCustomFields(
            Array.isArray(o.result)
              ? o.result.filter((field: LeadCustomFieldDefinitionDTO) => field.isActive)
              : [],
          )
        })
      void fetch("/api/v1/health-plans", { headers: h })
        .then((r) => r.json())
        .then((o) => {
          if (cancelled) return
          const plans = Array.isArray(o.result?.healthPlans) ? o.result.healthPlans : []
          setHealthPlans(plans)
          if (isHealthPlanTemplate && plans.length > 0) {
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
        .then((value) => {
          if (!cancelled) setSettings(value)
        })
        .catch(() => null)
      if (formId) {
        void publicFormsService
          .get(user.id, activeTeam.id, formId)
          .then((f) => {
            if (cancelled) return
            setDraft({
              ...emptyDraft,
              ...f,
              coverHighlights: f.coverHighlights ?? [],
              successActions: f.successActions ?? [],
              questions: f.questions ?? [],
              rules: f.rules ?? [],
              scoreBands: f.scoreBands ?? [],
            })
          })
          .catch((e) => toast.error(e.message))
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [activeTeam?.id, user?.id, formId, isHealthPlanTemplate, host])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    addEventListener("beforeunload", h)
    return () => removeEventListener("beforeunload", h)
  }, [dirty])

  const change = (patch: Partial<PublicFormDraftInput>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  async function save() {
    if (host) {
      setSaving(true)
      try {
        const payload = buildSavePayload(draft)
        const f = await host.save(currentId ?? null, payload)
        setCurrentId(f.id)
        setDirty(false)
        toast.success("Rascunho salvo")
        if (!currentId) router.replace(host.formHref(f.id))
        return f
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar")
        return null
      } finally {
        setSaving(false)
      }
    }

    if (!activeTeam?.id || !user?.id) return null
    setSaving(true)
    try {
      const payload = buildSavePayload(draft)
      const f = await publicFormsService.save(user.id, activeTeam.id, currentId ?? null, payload)
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
    setPublishing(true)
    try {
      const f = await save()
      if (!f) return
      if (host) {
        await host.publish(f.id)
      } else {
        if (!activeTeam?.id || !user?.id) return
        await publicFormsService.action(user.id, activeTeam.id, f.id, "publish")
      }
      toast.success("Formulário publicado")
      router.push(listHref)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível publicar")
    } finally {
      setPublishing(false)
    }
  }

  async function openPreview() {
    const form = await save()
    if (form) {
      window.open(previewHref(form.id), "_blank", "noopener,noreferrer")
    }
  }

  const snapshot = useMemo<PublicFormSnapshot>(
    () => ({
      ...buildSavePayload(draft),
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
        accentColor: draft.useDefaultTheme
          ? settings?.defaultAccentColor || "#FF6900"
          : draft.accentColor || "#FF6900",
        buttonTextColor: draft.useDefaultTheme
          ? settings?.defaultButtonTextColor || "#FFFFFF"
          : draft.buttonTextColor || "#FFFFFF",
        inputBackgroundColor: draft.useDefaultTheme
          ? settings?.defaultInputBackgroundColor || "#FFFFFF"
          : draft.inputBackgroundColor || "#FFFFFF",
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
            <Link href={formHref(currentId!)}>
              <ArrowLeft data-icon="inline-start" />
              Voltar ao editor
            </Link>
          </Button>
        </header>
        <PreviewLight className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4">
          <div className="public-form-page light h-[calc(100dvh-4.5rem)] w-full max-w-[580px] overflow-hidden rounded-2xl border bg-background shadow-sm [color-scheme:light]">
            <PublicFormRenderer snapshot={snapshot} preview className="h-full min-h-[60dvh]" />
          </div>
        </PreviewLight>
      </main>
    )
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <Button asChild variant="ghost">
          <Link
            href={listHref}
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
          <Button variant="outline" onClick={() => void save()} disabled={saving || publishing}>
            <Save data-icon="inline-start" />
            {saving ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button variant="outline" onClick={() => void openPreview()} disabled={publishing}>
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
            {step === 0 && <Basic draft={draft} change={change} members={members} />}
            {step === 1 && <Cover draft={draft} change={change} />}
            {step === 2 && (
              <Questions
                draft={draft}
                change={change}
                customFields={customFields}
                healthPlans={healthPlans}
                members={members}
              />
            )}
            {step === 3 && <Thanks draft={draft} change={change} />}
            {step === 4 && <Rules draft={draft} change={change} />}
            {step === 5 && <Scores draft={draft} change={change} />}
            {step === 6 && <Appearance draft={draft} change={change} />}
            {step === 7 && (
              <Review
                draft={draft}
                publishing={publishing}
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
                    if (step === 2) {
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
              <DrawerContent className="max-h-[90vh] overflow-y-auto">
                <DrawerHeader>
                  <DrawerTitle>Preview do formulário</DrawerTitle>
                </DrawerHeader>
                <PreviewLight>
                  <PublicFormRenderer
                    snapshot={snapshot}
                    preview
                    className="public-form-page light [color-scheme:light]"
                  />
                </PreviewLight>
              </DrawerContent>
            </Drawer>
          </div>
        </section>
        <aside className="hidden h-[calc(100dvh-3.5rem)] border-l bg-muted/30 p-4 lg:block">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview ao vivo
          </p>
          <PreviewLight className="public-form-page light mx-auto h-[calc(100%-1.5rem)] w-full max-w-[580px] overflow-y-auto rounded-2xl border bg-background shadow-sm [color-scheme:light]">
            <PublicFormRenderer snapshot={snapshot} preview className="min-h-full" />
          </PreviewLight>
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
            <AlertDialogAction onClick={() => router.push(listHref)}>
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
    <FieldGroup>
      <Field>
        <FieldLabel>Nome do formulário</FieldLabel>
        <FieldContent>
          <Input value={d.name} onChange={(e) => change({ name: e.target.value })} />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Descrição</FieldLabel>
        <FieldDescription>Somente para o time — não aparece no formulário público</FieldDescription>
        <FieldContent>
          <Textarea
            value={d.description ?? ""}
            onChange={(e) => change({ description: e.target.value })}
          />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>SDR responsável (opcional)</FieldLabel>
        <FieldContent>
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
        </FieldContent>
      </Field>
    </FieldGroup>
  )
}

function Thanks({
  draft: d,
  change,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
}) {
  const pages = d.thankYouPages?.length ? d.thankYouPages : [createDefaultThankYouPage()]
  const [activePageId, setActivePageId] = useState(
    () => d.defaultThankYouPageId || pages[0]?.id || "",
  )
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0]!
  const actions = activePage.actions ?? []

  function applyPages(nextPages: PublicFormThankYouPage[], defaultId = activePageId) {
    change(syncThankYouDraft(nextPages, defaultId))
  }

  function updateActivePage(patch: Partial<PublicFormThankYouPage>) {
    applyPages(syncThankYouPage(pages, activePage.id, patch))
  }

  function updateAction(id: string, patch: Partial<PublicFormSuccessAction>) {
    updateActivePage({
      actions: actions.map((action) => (action.id === id ? { ...action, ...patch } : action)),
    })
  }

  return (
    <FieldGroup>
      <div className="flex flex-wrap items-center gap-2">
        {pages.map((page) => (
          <Button
            key={page.id}
            type="button"
            size="sm"
            variant={page.id === activePage.id ? "default" : "outline"}
            onClick={() => setActivePageId(page.id)}
          >
            {page.name}
            {page.isDefault ? " (padrão)" : ""}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const page = createDefaultThankYouPage({
              name: `Página ${pages.length + 1}`,
              isDefault: false,
            })
            const next = [...pages, page]
            setActivePageId(page.id)
            applyPages(next, d.defaultThankYouPageId)
          }}
        >
          <Plus data-icon="inline-start" />
          Nova página
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={activePage.isDefault ? "default" : "outline"}
          onClick={() => applyPages(pages, activePage.id)}
        >
          Definir como padrão
        </Button>
        {pages.length > 1 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              const next = pages.filter((page) => page.id !== activePage.id)
              const defaultId =
                activePage.isDefault && next[0] ? next[0].id : d.defaultThankYouPageId
              setActivePageId(next[0]?.id ?? "")
              applyPages(next, defaultId)
            }}
          >
            <Trash2 data-icon="inline-start" />
            Remover página
          </Button>
        ) : null}
      </div>
      <Field>
        <FieldLabel>Nome interno da página</FieldLabel>
        <FieldContent>
          <Input
            value={activePage.name}
            onChange={(e) => updateActivePage({ name: e.target.value })}
          />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <FieldContent>
          <Select
            value={activePage.kind ?? "standard"}
            onValueChange={(value) =>
              updateActivePage({ kind: value as PublicFormThankYouPage["kind"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Padrão</SelectItem>
              <SelectItem value="simulation">Simulação</SelectItem>
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Título de conclusão</FieldLabel>
        <FieldContent>
          <Input
            value={activePage.title}
            onChange={(e) => updateActivePage({ title: e.target.value })}
          />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Mensagem de conclusão</FieldLabel>
        <FieldContent>
          <Textarea
            value={activePage.description ?? ""}
            onChange={(e) => updateActivePage({ description: e.target.value })}
          />
        </FieldContent>
      </Field>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Ações da página de agradecimento</FieldLabel>
          <Badge variant="secondary">Até 6 ações</Badge>
        </div>
        {actions.map((action, index) => (
          <div className="flex flex-col gap-3 rounded-lg border p-4" key={action.id}>
            <Field>
              <FieldLabel>Rótulo do botão</FieldLabel>
              <FieldContent>
                <Input
                  value={action.label}
                  onChange={(e) => updateAction(action.id, { label: e.target.value })}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <FieldContent>
                <Select
                  value={action.type}
                  onValueChange={(value) =>
                    updateAction(action.id, {
                      type: value as PublicFormSuccessAction["type"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="close">Fechar</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            {action.type === "link" ? (
              <Field>
                <FieldLabel>URL</FieldLabel>
                <FieldContent>
                  <Input
                    value={action.url ?? ""}
                    placeholder="https://"
                    onChange={(e) => updateAction(action.id, { url: e.target.value })}
                  />
                </FieldContent>
              </Field>
            ) : null}
            {action.type === "whatsapp" ? (
              <>
                <Field>
                  <FieldLabel>Telefone WhatsApp</FieldLabel>
                  <FieldContent>
                    <Input
                      value={action.whatsappPhone ?? ""}
                      placeholder="5511999999999"
                      onChange={(e) =>
                        updateAction(action.id, { whatsappPhone: e.target.value })
                      }
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Mensagem</FieldLabel>
                  <FieldContent>
                    <Textarea
                      value={action.whatsappMessage ?? ""}
                      onChange={(e) =>
                        updateAction(action.id, { whatsappMessage: e.target.value })
                      }
                    />
                  </FieldContent>
                </Field>
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                updateActivePage({
                  actions: actions.filter((item) => item.id !== action.id),
                })
              }
            >
              <Trash2 data-icon="inline-start" />
              Remover ação {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={actions.length >= 6}
          onClick={() =>
            updateActivePage({
              actions: [
                ...actions,
                {
                  id: crypto.randomUUID(),
                  label: "Continuar",
                  type: "close",
                },
              ],
            })
          }
        >
          <Plus data-icon="inline-start" />
          Adicionar ação
        </Button>
      </div>
    </FieldGroup>
  )
}

function Cover({
  draft: d,
  change,
}: {
  draft: PublicFormDraftInput
  change: (p: Partial<PublicFormDraftInput>) => void
}) {
  const highlights = d.coverHighlights ?? []

  function updateHighlight(id: string, patch: Partial<PublicFormCoverHighlight>) {
    change({
      coverHighlights: highlights.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Título</FieldLabel>
        <FieldContent>
          <Input
            value={d.coverTitle ?? ""}
            onChange={(e) => change({ coverTitle: e.target.value })}
          />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Subtítulo</FieldLabel>
        <FieldContent>
          <Textarea
            value={d.coverDescription ?? ""}
            onChange={(e) => change({ coverDescription: e.target.value })}
          />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Conteúdo do botão</FieldLabel>
        <FieldContent>
          <Input value={d.ctaLabel} onChange={(e) => change({ ctaLabel: e.target.value })} />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Badge</FieldLabel>
        <FieldContent>
          <Input
            value={d.coverBadge ?? ""}
            placeholder="Opcional"
            onChange={(e) => change({ coverBadge: e.target.value.trim() || null })}
          />
        </FieldContent>
      </Field>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Destaques da capa</FieldLabel>
          <Badge variant="secondary">Até 3 blocos</Badge>
        </div>
        {highlights.map((item, index) => (
          <div className="grid gap-2 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto]" key={item.id}>
            <Field>
              <FieldLabel>Valor</FieldLabel>
              <FieldContent>
                <Input
                  value={item.value}
                  onChange={(e) => updateHighlight(item.id, { value: e.target.value })}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Rótulo</FieldLabel>
              <FieldContent>
                <Input
                  value={item.label}
                  onChange={(e) => updateHighlight(item.id, { label: e.target.value })}
                />
              </FieldContent>
            </Field>
            <Button
              type="button"
              variant="ghost"
              className="self-end"
              aria-label={`Remover destaque ${index + 1}`}
              onClick={() =>
                change({ coverHighlights: highlights.filter((h) => h.id !== item.id) })
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={highlights.length >= 3}
          onClick={() =>
            change({
              coverHighlights: [
                ...highlights,
                { id: crypto.randomUUID(), value: "", label: "" },
              ],
            })
          }
        >
          <Plus data-icon="inline-start" />
          Adicionar destaque
        </Button>
      </div>
    </FieldGroup>
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
  const pages = groupQuestionsByPage(d.questions)
  const scoreTotal = sumQuestionScoreWeights(d.questions)

  function updateQuestion(id: string, patch: Partial<PublicFormQuestionInput>) {
    if (patch.scoreWeight !== undefined) {
      change({
        questions: rebalanceAfterQuestionWeightEdit(d.questions, id, patch.scoreWeight),
      })
      return
    }
    change({
      questions: d.questions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  function removeQuestion(id: string) {
    const used = d.rules.some((r) => r.sourceQuestionId === id || r.targetQuestionId === id)
    if (used) {
      toast.error("Remova as regras que usam esta pergunta")
      return
    }
    const nextQuestions = redistributeQuestionScoresEvenly(d.questions.filter((x) => x.id !== id))
    change({
      questions: nextQuestions,
      schedulingEnabled: nextQuestions.some((item) => item.type === "scheduling"),
    })
  }

  function addSubQuestion(pageKey: string) {
    const samePage = d.questions.filter((question) => getPageKey(question) === pageKey)
    if (samePage.length >= 3) {
      toast.error("Cada página pode ter no máximo 3 campos")
      return
    }
    if (
      samePage.some(
        (question) => question.type === "scheduling" || question.type === "calculation",
      )
    ) {
      toast.error("Esta página deve ficar com uma única pergunta especial")
      return
    }
    change({
      questions: redistributeQuestionScoresEvenly([
        ...d.questions,
        {
          id: crypto.randomUUID(),
          type: "text",
          title: "Nova sub-pergunta",
          required: false,
          scoreWeight: 0,
          options: [],
          mappingTarget: "history",
          config: { pageKey },
        },
      ]),
    })
  }

  function addPage() {
    change({
      questions: redistributeQuestionScoresEvenly([
        ...d.questions,
        {
          id: crypto.randomUUID(),
          type: "text",
          title: "Nova pergunta",
          required: false,
          scoreWeight: 0,
          options: [],
          mappingTarget: "history",
          config: { pageKey: crypto.randomUUID() },
        },
      ]),
    })
  }

  function onPageDragEnd(result: DropResult) {
    if (!result.destination) return
    change({
      questions: reorderPages(d.questions, result.source.index, result.destination.index),
    })
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

    if (nextType === "calculation") {
      if (d.questions.some((item) => item.type === "calculation" && item.id !== question.id)) {
        toast.error("Só é permitido uma pergunta de cálculo")
        return
      }
      change({
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
        ? withEqualOptionScores(
            healthPlans.map((plan) => ({
              id: crypto.randomUUID(),
              label: plan.name,
              value: plan.name,
              score: 0,
              scorePolarity: "positive" as PublicFormScorePolarity,
            })),
          )
        : ["single_choice", "multiple_choice"].includes(nextType) && !question.options.length
          ? withEqualOptionScores([
              {
                id: crypto.randomUUID(),
                label: "Opção 1",
                value: "opcao_1",
                score: 0,
                scorePolarity: "positive" as PublicFormScorePolarity,
              },
            ])
          : question.options.map((option) => ({
              ...option,
              scorePolarity: option.scorePolarity ?? "positive",
            }))
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

  function renderQuestionFields(q: PublicFormQuestionInput, isSub: boolean) {
    const isChoice = q.type === "single_choice" || q.type === "multiple_choice"
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel>{isSub ? "Sub-pergunta" : "Pergunta"}</FieldLabel>
            <FieldContent>
              <Input
                value={q.title}
                placeholder={isSub ? "Sub-pergunta" : "Título da pergunta"}
                onChange={(e) => updateQuestion(q.id!, { title: e.target.value })}
              />
            </FieldContent>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel>Descrição</FieldLabel>
            <FieldContent>
              <Input
                value={q.description ?? ""}
                placeholder="Descrição opcional"
                onChange={(event) => updateQuestion(q.id!, { description: event.target.value })}
              />
            </FieldContent>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel>Placeholder</FieldLabel>
            <FieldContent>
              <Input
                value={q.placeholder ?? ""}
                placeholder="Placeholder opcional"
                onChange={(event) => updateQuestion(q.id!, { placeholder: event.target.value })}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <FieldContent>
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
            </FieldContent>
          </Field>
          {isChoice ? (
            <Field>
              <FieldLabel>Modo de seleção</FieldLabel>
              <FieldContent>
                <Select
                  value={q.type}
                  onValueChange={(value) =>
                    updateQuestion(q.id!, {
                      type: value as "single_choice" | "multiple_choice",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_choice">Só uma opção</SelectItem>
                    <SelectItem value="multiple_choice">Várias opções</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          ) : null}
          <Field>
            <FieldLabel>Destino</FieldLabel>
            <FieldContent>
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
            </FieldContent>
          </Field>
          {q.mappingTarget === "native_field" && (
            <Field>
              <FieldLabel>Campo nativo</FieldLabel>
              <FieldContent>
                <Select
                  value={q.mappingKey ?? ""}
                  onValueChange={(v) =>
                    updateQuestion(q.id!, {
                      mappingKey: v,
                      ...(v === "email" && q.type === "text" ? { type: "email" as const } : {}),
                      ...(v === "phone" && q.type === "text" ? { type: "phone" as const } : {}),
                    })
                  }
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
              </FieldContent>
            </Field>
          )}
          {q.mappingTarget === "custom_field" && (
            <Field>
              <FieldLabel>Campo personalizado</FieldLabel>
              <FieldContent>
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
              </FieldContent>
            </Field>
          )}
          <Field className="sm:col-span-2">
            <FieldLabel>Pontuação (%)</FieldLabel>
            <FieldContent>
              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                  value={[clampPercent(q.scoreWeight ?? 0)]}
                  onValueChange={(values) =>
                    updateQuestion(q.id!, { scoreWeight: clampPercent(values[0] ?? 0) })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-20"
                  value={clampPercent(q.scoreWeight ?? 0)}
                  onChange={(e) =>
                    updateQuestion(q.id!, { scoreWeight: clampPercent(Number(e.target.value)) })
                  }
                />
              </div>
            </FieldContent>
          </Field>
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
        {["single_choice", "multiple_choice", "health_plan"].includes(q.type) && (
          <div className="mt-4 flex flex-col gap-3">
            {q.options.map((o) => {
              const polarity = o.scorePolarity ?? "positive"
              return (
                <div className="flex flex-col gap-2 rounded-md border p-3" key={o.id}>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
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
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        change({
                          questions: d.questions.map((x) =>
                            x.id === q.id
                              ? {
                                  ...x,
                                  options: withEqualOptionScores(
                                    x.options.filter((y) => y.id !== o.id),
                                  ),
                                }
                              : x,
                          ),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Field>
                    <FieldLabel>Polaridade</FieldLabel>
                    <FieldContent>
                      <Select
                        value={polarity}
                        onValueChange={(value) =>
                          change({
                            questions: d.questions.map((x) =>
                              x.id === q.id
                                ? {
                                    ...x,
                                    options: x.options.map((y) =>
                                      y.id === o.id
                                        ? {
                                            ...y,
                                            scorePolarity: value as PublicFormScorePolarity,
                                          }
                                        : y,
                                    ),
                                  }
                                : x,
                            ),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive">Positivo</SelectItem>
                          <SelectItem value="negative">Negativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel>Peso relativo</FieldLabel>
                    <FieldContent>
                      <div className="flex items-center gap-3">
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          className="flex-1"
                          value={[clampPercent(o.score)]}
                          onValueChange={(values) => {
                            const score = clampPercent(values[0] ?? 0)
                            change({
                              questions: d.questions.map((x) =>
                                x.id === q.id
                                  ? {
                                      ...x,
                                      options: x.options.map((y) =>
                                        y.id === o.id ? { ...y, score } : y,
                                      ),
                                    }
                                  : x,
                              ),
                            })
                          }}
                        />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="w-20"
                          value={clampPercent(o.score)}
                          onChange={(e) => {
                            const score = clampPercent(Number(e.target.value))
                            change({
                              questions: d.questions.map((x) =>
                                x.id === q.id
                                  ? {
                                      ...x,
                                      options: x.options.map((y) =>
                                        y.id === o.id ? { ...y, score } : y,
                                      ),
                                    }
                                  : x,
                              ),
                            })
                          }}
                        />
                      </div>
                    </FieldContent>
                  </Field>
                </div>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                change({
                  questions: d.questions.map((x) =>
                    x.id === q.id
                      ? {
                          ...x,
                          options: withEqualOptionScores([
                            ...x.options,
                            {
                              id: crypto.randomUUID(),
                              label: `Opção ${x.options.length + 1}`,
                              value: `option_${x.options.length + 1}`,
                              score: 0,
                              scorePolarity: "positive",
                            },
                          ]),
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
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Total: {scoreTotal}%</p>
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
      <DragDropContext onDragEnd={onPageDragEnd}>
        <Droppable droppableId="pages">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-3">
              {pages.map((page, pageIndex) => {
                const [main, ...subs] = page.questions
                if (!main?.id) return null
                const soloSpecial = page.questions.some(
                  (item) => item.type === "scheduling" || item.type === "calculation",
                )
                return (
                  <Draggable draggableId={page.pageKey} index={pageIndex} key={page.pageKey}>
                    {(dragProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="rounded-lg border bg-card p-4"
                      >
                        <div className="mb-4 flex items-center gap-2">
                          <button
                            type="button"
                            {...dragProvided.dragHandleProps}
                            aria-label="Reordenar página"
                          >
                            <GripVertical className="text-muted-foreground" />
                          </button>
                          <span className="font-medium">Página {pageIndex + 1}</span>
                          <Badge variant="secondary">
                            {page.questions.length} campo{page.questions.length === 1 ? "" : "s"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="ml-auto"
                            onClick={() => removeQuestion(main.id!)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        {renderQuestionFields(main, false)}
                        {subs.length > 0 ? (
                          <div className="mt-6 flex flex-col gap-4 border-t pt-4">
                            <p className="text-sm font-medium text-muted-foreground">Sub-perguntas</p>
                            {subs.map((sub) => (
                              <div className="rounded-md border border-dashed p-3" key={sub.id}>
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <Badge variant="outline">Sub-pergunta</Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    onClick={() => removeQuestion(sub.id!)}
                                  >
                                    <Trash2 />
                                  </Button>
                                </div>
                                {renderQuestionFields(sub, true)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {!soloSpecial && page.questions.length < 3 ? (
                          <Button
                            className="mt-4"
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => addSubQuestion(page.pageKey)}
                          >
                            <Plus data-icon="inline-start" />
                            Adicionar sub-pergunta
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Button variant="outline" type="button" onClick={addPage}>
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
  function updateRule(id: string, patch: Partial<PublicFormRuleInput>) {
    change({
      rules: d.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    })
  }

  function sourceQuestion(rule: PublicFormRuleInput) {
    return d.questions.find((q) => q.id === rule.sourceQuestionId)
  }

  function choiceOptions(question: PublicFormQuestionInput | undefined) {
    if (!question) return []
    if (question.type === "boolean") {
      return [
        { id: "sim", value: "sim", label: "Sim" },
        { id: "nao", value: "nao", label: "Não" },
      ]
    }
    if (!["single_choice", "multiple_choice", "health_plan"].includes(question.type)) return []
    return question.options
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Controle o fluxo com condições Se / Então / Senão entre perguntas.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Como funcionam as regras">
              <HelpCircle />
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90vh] flex-col">
            <DialogHeader>
              <DialogTitle>Regras condicionais</DialogTitle>
              <DialogDescription>
                Defina o que acontece quando uma resposta atende (ou não) a uma condição.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto text-sm text-muted-foreground">
              <p>
                <strong>Se</strong> a resposta da pergunta de origem satisfizer o operador e o valor,
                a ação <strong>Então</strong> é aplicada ao destino (exibir ou pular).
              </p>
              <p>
                <strong>Ocultar pergunta</strong> remove uma pergunta específica do fluxo quando a
                condição é atendida.
              </p>
              <p>
                <strong>Pular até pergunta</strong> ignora todas as perguntas intermediárias e leva o
                respondente direto à pergunta de destino.
              </p>
              <p>
                Caso contrário, usa-se a ação <strong>Senão</strong> — normalmente o oposto de
                Então, para cobrir os dois caminhos do fluxo.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {d.rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma regra ainda. Adicione uma regra para personalizar o fluxo do formulário.
        </div>
      ) : null}
      {d.rules.map((rule) => {
        const source = sourceQuestion(rule)
        const options = choiceOptions(source)
        const elseAction = rule.elseAction ?? inverseRuleAction(rule.action)
        const thenTargets = ruleTargetQuestions(d.questions, rule.sourceQuestionId, rule.action)
        return (
          <div className="flex flex-col gap-3 rounded-lg border p-4" key={rule.id}>
            <p className="text-sm text-muted-foreground">{buildRuleSentence(rule, d.questions, d)}</p>
            <div className="grid gap-3">
              <Field>
                <FieldLabel>Se — pergunta</FieldLabel>
                <FieldContent>
                  <Select
                    value={rule.sourceQuestionId}
                    onValueChange={(v) => updateRule(rule.id!, { sourceQuestionId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pergunta de origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {d.questions.map((q) => (
                        <SelectItem key={q.id} value={q.id!}>
                          {q.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Operador</FieldLabel>
                  <FieldContent>
                    <Select
                      value={rule.operator}
                      onValueChange={(v) =>
                        updateRule(rule.id!, { operator: v as PublicFormRuleOperator })
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
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Valor</FieldLabel>
                  <FieldContent>
                    {options.length > 0 ? (
                      <Select
                        value={String(rule.comparisonValue ?? "")}
                        onValueChange={(v) => updateRule(rule.id!, { comparisonValue: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt.id} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Valor comparado"
                        value={String(rule.comparisonValue ?? "")}
                        onChange={(e) =>
                          updateRule(rule.id!, { comparisonValue: e.target.value })
                        }
                      />
                    )}
                  </FieldContent>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Então — ação</FieldLabel>
                  <FieldContent>
                    <Select
                      value={rule.action}
                      onValueChange={(v) => {
                        const action = v as PublicFormRuleAction
                        updateRule(rule.id!, {
                          action,
                          elseAction: rule.elseAction ?? inverseRuleAction(action),
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="show">Exibir pergunta</SelectItem>
                        <SelectItem value="skip">Ocultar pergunta</SelectItem>
                        <SelectItem value="jump_to">Pular até pergunta</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Então — destino</FieldLabel>
                  <FieldContent>
                    <Select
                      value={rule.targetQuestionId}
                      onValueChange={(v) =>
                        updateRule(rule.id!, {
                          targetQuestionId: v,
                          targetThankYouPageId:
                            v === PUBLIC_FORM_THANK_YOU_TARGET
                              ? (rule.targetThankYouPageId ?? null)
                              : null,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {thenTargets.map((q) => (
                          <SelectItem key={q.id} value={q.id!}>
                            {q.title}
                          </SelectItem>
                        ))}
                        {rule.action !== "jump_to" ? (
                          <SelectItem value={PUBLIC_FORM_THANK_YOU_TARGET}>
                            Página de agradecimentos
                          </SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                {rule.targetQuestionId === PUBLIC_FORM_THANK_YOU_TARGET ? (
                  <Field>
                    <FieldLabel>Página de agradecimentos</FieldLabel>
                    <FieldContent>
                      <Select
                        value={rule.targetThankYouPageId ?? d.defaultThankYouPageId}
                        onValueChange={(v) =>
                          updateRule(rule.id!, { targetThankYouPageId: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(d.thankYouPages ?? []).map((page) => (
                            <SelectItem key={page.id} value={page.id}>
                              {page.name}
                              {page.isDefault ? " (padrão)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Senão — ação</FieldLabel>
                  <FieldContent>
                    <Select
                      value={elseAction}
                      onValueChange={(v) =>
                        updateRule(rule.id!, { elseAction: v as PublicFormRuleAction })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="show">Exibir pergunta</SelectItem>
                        <SelectItem value="skip">Ocultar pergunta</SelectItem>
                        <SelectItem value="jump_to">Pular até pergunta</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Senão — destino</FieldLabel>
                  <FieldContent>
                    {rule.action === "jump_to" && elseAction === "show" ? (
                      <p className="text-sm text-muted-foreground">
                        Fluxo padrão (todas as perguntas)
                      </p>
                    ) : (
                      <Select value={rule.targetQuestionId} disabled>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {d.questions.map((q) => (
                            <SelectItem key={q.id} value={q.id!}>
                              {q.title}
                            </SelectItem>
                          ))}
                          <SelectItem value={PUBLIC_FORM_THANK_YOU_TARGET}>
                            Página de agradecimentos
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </FieldContent>
                </Field>
              </div>
            </div>
            <Button
              variant="ghost"
              type="button"
              onClick={() => change({ rules: d.rules.filter((x) => x.id !== rule.id) })}
            >
              <Trash2 data-icon="inline-start" />
              Remover regra
            </Button>
          </div>
        )
      })}
      <Button
        variant="outline"
        type="button"
        disabled={d.questions.length < 1}
        onClick={() => {
          const sourceId = d.questions[0].id!
          const defaultTarget =
            d.questions.find((question, index) => index > 0 && question.id)?.id ??
            PUBLIC_FORM_THANK_YOU_TARGET
          const defaultAction: PublicFormRuleAction =
            defaultTarget !== PUBLIC_FORM_THANK_YOU_TARGET ? "jump_to" : "skip"
          change({
            rules: [
              ...d.rules,
              {
                id: crypto.randomUUID(),
                sourceQuestionId: sourceId,
                targetQuestionId: defaultTarget,
                operator: "equals",
                comparisonValue: "",
                action: defaultAction,
                elseAction: inverseRuleAction(defaultAction),
              },
            ],
          })
        }}
      >
        <Plus data-icon="inline-start" />
        Adicionar regra
      </Button>
    </div>
  )
}

function ScoreCoverageBar({ bands }: { bands: PublicFormDraftInput["scoreBands"] }) {
  const cells = useMemo(() => {
    const covered = new Array(101).fill(false)
    for (const band of bands) {
      const min = clampPercent(band.minScore)
      const max = clampPercent(band.maxScore)
      if (min > max) continue
      for (let i = min; i <= max; i += 1) {
        covered[i] = true
      }
    }
    return covered
  }, [bands])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span>Cobertura das faixas</span>
        <span>100%</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full border bg-muted">
        {cells.map((hit, index) => (
          <div
            key={index}
            className={hit ? "flex-1 bg-primary" : "flex-1 bg-transparent"}
            title={`${index}%`}
          />
        ))}
      </div>
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
  const scoreTotal = sumQuestionScoreWeights(d.questions)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          O orçamento do formulário é 100%. Cada pergunta tem uma pontuação (%) e as opções usam
          peso relativo com polaridade positiva ou negativa.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Como funciona a pontuação">
              <HelpCircle />
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90vh] flex-col">
            <DialogHeader>
              <DialogTitle>Como funciona a pontuação</DialogTitle>
              <DialogDescription>
                Classifique leads automaticamente com faixas percentuais após o envio.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto text-sm text-muted-foreground">
              <p>
                A soma das pontuações das perguntas deve ser 100%. Em cada pergunta de escolha, as
                opções têm <strong>peso relativo</strong> e <strong>polaridade</strong> (positivo ou
                negativo).
              </p>
              <p>
                As faixas (ex.: De 0% Até 40% = Qualificado) interpretam o percentual final. O resumo
                fica disponível no CRM para o time comercial.
              </p>
              <p>
                Regras condicionais não alteram o cálculo — só controlam quais perguntas aparecem.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {d.questions.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Pesos das perguntas</p>
            <Badge variant="secondary">Total: {scoreTotal}%</Badge>
          </div>
          {d.questions.map((question) => (
            <Field key={question.id}>
              <FieldLabel>{question.title.trim() || "Pergunta sem título"}</FieldLabel>
              <FieldContent>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    value={[clampPercent(question.scoreWeight ?? 0)]}
                    onValueChange={(values) =>
                      change({
                        questions: rebalanceAfterQuestionWeightEdit(
                          d.questions,
                          question.id!,
                          clampPercent(values[0] ?? 0),
                        ),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    value={clampPercent(question.scoreWeight ?? 0)}
                    onChange={(e) =>
                      change({
                        questions: rebalanceAfterQuestionWeightEdit(
                          d.questions,
                          question.id!,
                          clampPercent(Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </div>
              </FieldContent>
            </Field>
          ))}
        </div>
      ) : null}
      <ScoreCoverageBar bands={d.scoreBands} />
      {d.scoreBands.map((b) => {
        const min = clampPercent(b.minScore)
        const max = clampPercent(b.maxScore)
        const invalidRange = min > max
        return (
          <div className="flex flex-col gap-3 rounded-lg border p-4" key={b.id}>
            <p className="text-sm text-muted-foreground">
              Lead com {min}% a {max}% = {b.label.trim() || "…"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Nome da faixa</FieldLabel>
                <FieldContent>
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
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Resumo</FieldLabel>
                <FieldContent>
                  <Input
                    value={b.summary ?? ""}
                    placeholder="Resumo interno"
                    onChange={(event) =>
                      change({
                        scoreBands: d.scoreBands.map((item) =>
                          item.id === b.id ? { ...item, summary: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>De (%)</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={min}
                    onChange={(e) =>
                      change({
                        scoreBands: d.scoreBands.map((x) =>
                          x.id === b.id
                            ? { ...x, minScore: clampPercent(Number(e.target.value)) }
                            : x,
                        ),
                      })
                    }
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Até (%)</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={max}
                    onChange={(e) =>
                      change({
                        scoreBands: d.scoreBands.map((x) =>
                          x.id === b.id
                            ? { ...x, maxScore: clampPercent(Number(e.target.value)) }
                            : x,
                        ),
                      })
                    }
                  />
                </FieldContent>
              </Field>
            </div>
            {invalidRange ? (
              <p className="text-sm text-destructive">“De” deve ser menor ou igual a “Até”.</p>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              type="button"
              className="self-start"
              onClick={() => change({ scoreBands: d.scoreBands.filter((x) => x.id !== b.id) })}
            >
              <Trash2 />
            </Button>
          </div>
        )
      })}
      <Button
        variant="outline"
        type="button"
        onClick={() =>
          change({
            scoreBands: [
              ...d.scoreBands,
              {
                id: crypto.randomUUID(),
                label: "Qualificado",
                minScore: 0,
                maxScore: 40,
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
      <Field>
        <FieldLabel>Duração em minutos</FieldLabel>
        <FieldContent>
          <Input
            type="number"
            value={d.meetingDurationMinutes}
            onChange={(e) => change({ meetingDurationMinutes: Number(e.target.value) })}
          />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Mensagem da reunião</FieldLabel>
        <FieldContent>
          <Textarea
            value={d.schedulingMessage ?? ""}
            onChange={(e) => change({ schedulingMessage: e.target.value })}
          />
        </FieldContent>
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
    <FieldGroup>
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
          ["Linhas e bordas", "lineColor"],
          ["Destaque (botões / progresso)", "accentColor"],
          ["Texto do botão", "buttonTextColor"],
          ["Fundo do input", "inputBackgroundColor"],
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
    </FieldGroup>
  )
}

function Review({
  draft: d,
  publishing,
  onPublish,
  onGoToStep,
}: {
  draft: PublicFormDraftInput
  publishing: boolean
  onPublish: () => void
  onGoToStep: (step: number) => void
}) {
  const questionErrors = getQuestionStepErrors(d)
  const checks = [
    { ok: Boolean(d.name.trim()), text: "Nome definido", step: 0 },
    { ok: d.questions.length > 0, text: "Ao menos uma pergunta", step: 2 },
    {
      ok: d.questions.some((q) => q.mappingTarget === "native_field" && q.mappingKey === "name"),
      text: "Nome do lead mapeado",
      step: 2,
    },
    {
      ok: !d.schedulingEnabled || d.eligibleCloserIds.length > 0,
      text: "Closer selecionado para agenda",
      step: 2,
    },
    {
      ok: questionErrors.length === 0,
      text: "Perguntas configuradas corretamente",
      step: 2,
    },
    {
      ok: (d.thankYouPages?.length ?? 0) > 0 && Boolean(d.defaultThankYouPageId),
      text: "Página de agradecimento definida",
      step: 3,
    },
  ]
  const ready = checks.every((c) => c.ok)
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border p-4">
        <ul className="flex flex-col gap-2 text-sm">
          {checks.map((c) => (
            <li key={c.text} className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-left hover:underline"
                onClick={() => onGoToStep(c.step)}
              >
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
      <Button disabled={!ready || publishing} onClick={onPublish}>
        {publishing ? "Publicando..." : "Publicar formulário"}
      </Button>
    </div>
  )
}
