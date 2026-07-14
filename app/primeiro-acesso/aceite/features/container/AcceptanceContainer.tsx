"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAcceptance } from "../context/AcceptanceContext"
import type { AcceptanceForm, LegalDocumentBlock } from "../context/AcceptanceTypes"

const initialForm: AcceptanceForm = { companyLegalName: "", companyTradeName: "", companyCnpj: "", representativeName: "", representativeCpf: "", representativeRole: "", representativeEmail: "", representativeWhatsapp: "", declarationAccepted: false }

function LegalBlock({ block }: { block: LegalDocumentBlock }) {
  if (block.kind === "heading") return <h2 className="text-lg font-semibold">{block.text}</h2>
  if (block.kind === "subheading") return <h3 className="font-medium">{block.text}</h3>
  if (block.kind === "listItem" || block.kind === "romanItem") return <li className="ml-5 pl-1">{block.text}</li>
  if (block.kind === "meta") return <p className="text-sm font-medium text-muted-foreground">{block.text}</p>
  return <p className="text-sm leading-6 text-muted-foreground">{block.text}</p>
}

export function AcceptanceContainer() {
  const { data, result, isLoading, isSubmitting, error, load, submit } = useAcceptance()
  const [form, setForm] = useState(initialForm)
  const [readDocuments, setReadDocuments] = useState<Record<string, boolean>>({})
  const [acceptedDocuments, setAcceptedDocuments] = useState<Record<string, boolean>>({})

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!data) return
    setForm((current) => ({ ...current, companyCnpj: data.adhesion.cpfCnpj ?? "", representativeName: data.adhesion.fullName, representativeEmail: data.adhesion.email, representativeWhatsapp: data.adhesion.phone }))
  }, [data])

  const acceptedCount = Object.values(acceptedDocuments).filter(Boolean).length
  const formValid = useMemo(() => form.companyLegalName.trim().length >= 2 && form.companyCnpj.replace(/\D/g, "").length === 14 && form.representativeName.trim().length >= 2 && form.representativeCpf.replace(/\D/g, "").length === 11 && form.representativeRole.trim().length >= 2 && form.representativeEmail.includes("@") && form.representativeWhatsapp.replace(/\D/g, "").length >= 10 && form.declarationAccepted, [form])

  if (isLoading || (!data && !error)) return <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-[32rem] w-full" /></main>
  if (error) return <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center p-6"><Alert variant="destructive"><ShieldCheck /><AlertTitle>Não foi possível abrir o aceite</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></main>
  if (result) return <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center p-6"><section className="flex w-full flex-col items-center gap-6 rounded-xl border bg-card p-8 text-center"><CheckCircle2 className="size-12 text-[var(--semantic-success)]" /><div className="flex flex-col gap-2"><h1 className="text-2xl font-semibold">Aceite concluído</h1><p className="text-muted-foreground">Protocolo {result.protocol}</p><p className="text-sm text-muted-foreground">Você receberá o comprovante e o link para criar sua senha por e-mail.</p></div><Button asChild><a href={result.nextUrl}>Ir para o acesso</a></Button></section></main>
  if (!data) return null

  return <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-4 py-8 md:p-8">
    <header className="flex flex-col gap-3"><div className="flex items-center gap-2 text-sm font-medium text-primary"><FileCheck2 className="size-4" />Aceite eletrônico obrigatório</div><h1 className="text-3xl font-semibold tracking-tight">Revise e aceite os documentos</h1><p className="text-muted-foreground">Leia cada documento até o final e confirme os dados do representante.</p><Progress value={(acceptedCount / 3) * 100} aria-label={`${acceptedCount} de 3 documentos aceitos`} /><p className="text-sm text-muted-foreground">{acceptedCount} de 3 documentos aceitos</p></header>
    <section className="rounded-xl border bg-card p-4 md:p-6">
      <Tabs defaultValue={data.documentSet.documents[0]?.id} className="flex flex-col gap-5">
        <TabsList className="grid h-auto grid-cols-1 gap-2 sm:grid-cols-3">{data.documentSet.documents.map((document, index) => <TabsTrigger key={document.id} value={document.id} className="min-h-11">{acceptedDocuments[document.id] ? <CheckCircle2 /> : null}{index + 1}. {document.title}</TabsTrigger>)}</TabsList>
        {data.documentSet.documents.map((document) => <TabsContent key={document.id} value={document.id} className="flex flex-col gap-4">
          <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/30 p-5" tabIndex={0} onScroll={(event) => { const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight < 24) setReadDocuments((current) => ({ ...current, [document.id]: true })) }}>{document.content.map((block, index) => <LegalBlock key={`${document.id}-${index}`} block={block} />)}</div>
          <Field orientation="horizontal" data-disabled={!readDocuments[document.id]}><Checkbox id={`accept-${document.id}`} disabled={!readDocuments[document.id]} checked={Boolean(acceptedDocuments[document.id])} onCheckedChange={(checked) => setAcceptedDocuments((current) => ({ ...current, [document.id]: checked === true }))} /><FieldLabel htmlFor={`accept-${document.id}`}>Li e concordo com {document.title}, versão {document.version}</FieldLabel></Field>
          {!readDocuments[document.id] ? <p className="text-sm text-muted-foreground">Role até o final do documento para liberar a confirmação.</p> : null}
        </TabsContent>)}
      </Tabs>
    </section>
    <section className="rounded-xl border bg-card p-4 md:p-6"><FieldGroup><h2 className="text-xl font-semibold">Dados da contratação</h2>{([
      ["companyLegalName", "Razão social"], ["companyTradeName", "Nome fantasia"], ["companyCnpj", "CNPJ"], ["representativeName", "Nome do representante"], ["representativeCpf", "CPF do representante"], ["representativeRole", "Cargo do representante"], ["representativeEmail", "E-mail do representante"], ["representativeWhatsapp", "WhatsApp do representante"],
    ] as const).map(([key, label]) => <Field key={key}><FieldLabel htmlFor={key}>{label}</FieldLabel><Input id={key} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}<Field orientation="horizontal"><Checkbox id="declaration" checked={form.declarationAccepted} onCheckedChange={(checked) => setForm((current) => ({ ...current, declarationAccepted: checked === true }))} /><FieldLabel htmlFor="declaration">Declaro possuir poderes para representar a empresa e confirmo a veracidade dos dados.</FieldLabel></Field></FieldGroup></section>
    <Button className="min-h-11 self-end" disabled={acceptedCount !== 3 || !formValid || isSubmitting} onClick={() => void submit(form)}>{isSubmitting ? "Registrando aceite…" : "Aceitar e continuar"}</Button>
  </main>
}
