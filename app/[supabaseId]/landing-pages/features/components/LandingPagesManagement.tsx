"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Archive, Copy, LayoutTemplate, MoreHorizontal, Plus, RefreshCw, Search, Send, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useLandingPages } from "../context/LandingPagesContext"
import type { LandingPageListItem } from "../context/LandingPagesTypes"
import { StudioDomainCard } from "./StudioDomainCard"
import { StudioTrackingCard } from "./StudioTrackingCard"

const statusConfig = {
  draft: { label: "Rascunho", className: "border-border bg-muted text-muted-foreground" },
  published: { label: "Publicado", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  archived: { label: "Arquivado", className: "border-border bg-muted text-muted-foreground" },
} as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

function getLandingUrl(hostname: string | undefined, publicId: string) {
  return hostname ? `https://${hostname}/conversao/${publicId}` : null
}

function LandingRow({ item }: { item: LandingPageListItem }) {
  const params = useParams<{ supabaseId: string }>()
  const { domain, publish, archive } = useLandingPages()
  const [isWorking, setIsWorking] = useState(false)
  const url = getLandingUrl(domain?.hostname, item.publicId)
  const status = statusConfig[item.status]

  async function execute(action: () => Promise<boolean>) {
    setIsWorking(true)
    await action()
    setIsWorking(false)
  }

  async function copyUrl() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    toast.success("Link copiado")
  }

  return (
    <div className="group grid gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,1fr)_160px_150px_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LayoutTemplate className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{item.name}</p>
            <p className="truncate text-xs text-muted-foreground">Atualizada em {formatDate(item.updatedAt)}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Status</span>
        <Badge variant="outline" className={`w-fit ${status.className}`}>{status.label}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Oferta</span>
        <span className="text-sm">{item.offer?.enabled ? `${item.offer.percentage ?? 40}% OFF` : "Sem oferta"}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label={`Ações para ${item.name}`} disabled={isWorking}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.status === "published" && url ? <DropdownMenuItem onClick={() => void copyUrl()}><Copy data-icon="inline-start" />Copiar link</DropdownMenuItem> : null}
          {item.status === "draft" ? <DropdownMenuItem onClick={() => void execute(() => publish(item.id))}><Send data-icon="inline-start" />Publicar</DropdownMenuItem> : null}
          {item.status !== "archived" ? <DropdownMenuItem onClick={() => void execute(() => archive(item.id))}><Archive data-icon="inline-start" />Arquivar</DropdownMenuItem> : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href={`/${params.supabaseId}/landing-pages/new?edit=${item.id}`}>Editar configuração</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function LandingPagesManagement() {
  const params = useParams<{ supabaseId: string }>()
  const { items, isLoading, error, refresh } = useLandingPages()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | LandingPageListItem["status"]>("all")
  const [domainSheetOpen, setDomainSheetOpen] = useState(false)
  const filteredItems = useMemo(() => items.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (statusFilter === "all" || item.status === statusFilter)), [items, query, statusFilter])

  return (
    <main className="container mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="mb-1 text-sm font-medium text-primary">Landing pages</p><h1 className="text-2xl font-semibold tracking-tight">Páginas de cotação</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Crie experiências de conversão para suas campanhas e acompanhe o que está pronto para receber contatos.</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-11" aria-label="Configurar domínio de cotação" onClick={() => setDomainSheetOpen(true)}><Settings2 /></Button>
          <Button asChild className="min-h-11"><Link href={`/${params.supabaseId}/landing-pages/new`}><Plus data-icon="inline-start" />Criar landing</Link></Button>
        </div>
      </div>

      <Sheet open={domainSheetOpen} onOpenChange={setDomainSheetOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader className="border-b pb-5">
            <SheetTitle>Domínio de cotação</SheetTitle>
            <SheetDescription>Conecte e verifique o endereço usado nos links das suas campanhas.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-6"><div className="flex flex-col gap-6"><StudioDomainCard /><StudioTrackingCard /></div></div>
        </SheetContent>
      </Sheet>
      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">Suas landing pages</h2><p className="text-sm text-muted-foreground">Uma landing pode usar qualquer formulário publicado do seu time.</p></div><Button variant="ghost" className="min-h-11" onClick={() => void refresh()}><RefreshCw data-icon="inline-start" />Atualizar</Button></div>
        <div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar landing page" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="flex gap-2"><Button className="min-h-11" variant={statusFilter === "all" ? "secondary" : "outline"} onClick={() => setStatusFilter("all")}>Todas</Button><Button className="min-h-11" variant={statusFilter === "published" ? "secondary" : "outline"} onClick={() => setStatusFilter("published")}>Publicadas</Button><Button className="min-h-11" variant={statusFilter === "draft" ? "secondary" : "outline"} onClick={() => setStatusFilter("draft")}>Rascunhos</Button></div></div>
      </section>

      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {isLoading ? <div className="flex flex-col gap-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full rounded-lg" />)}</div> : filteredItems.length > 0 ? <div className="flex flex-col gap-3">{filteredItems.map((item) => <LandingRow key={item.id} item={item} />)}</div> : <Empty className="min-h-72 border"><EmptyHeader><EmptyMedia variant="icon"><LayoutTemplate /></EmptyMedia><EmptyTitle>{items.length === 0 ? "Nenhuma landing criada" : "Nenhum resultado encontrado"}</EmptyTitle><EmptyDescription>{items.length === 0 ? "Crie uma página de cotação e conecte um formulário publicado para começar." : "Tente buscar por outro nome ou remova o filtro de status."}</EmptyDescription></EmptyHeader>{items.length === 0 ? <EmptyContent><Button asChild className="min-h-11"><Link href={`/${params.supabaseId}/landing-pages/new`}><Plus data-icon="inline-start" />Criar primeira landing</Link></Button></EmptyContent> : null}</Empty>}
    </main>
  )
}
