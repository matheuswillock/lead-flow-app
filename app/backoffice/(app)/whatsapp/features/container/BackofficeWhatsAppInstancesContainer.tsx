"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { WhatsAppConnectionStatus } from "../context/BackofficeWhatsAppInstancesTypes"
import { useBackofficeWhatsAppInstances } from "../context/BackofficeWhatsAppInstancesHook"
import { BackofficeWhatsAppInstanceSheet } from "../components/BackofficeWhatsAppInstanceSheet"
import { BackofficeWhatsAppInstancesTable } from "../components/BackofficeWhatsAppInstancesTable"
import { BackofficeWhatsAppOpsUpdatesPanel } from "../components/BackofficeWhatsAppOpsUpdatesPanel"
import { BackofficeWhatsAppProvisionDialog } from "../components/BackofficeWhatsAppProvisionDialog"

const STATUS_OPTIONS: { value: WhatsAppConnectionStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "CONNECTED", label: "Conectado" },
  { value: "QR_READY", label: "Aguardando QR" },
  { value: "PENDING", label: "Pendente" },
  { value: "DISCONNECTED", label: "Desconectado" },
  { value: "ERROR", label: "Erro" },
  { value: "BANNED", label: "Bloqueado" },
]

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50]

export function BackofficeWhatsAppInstancesContainer() {
  const {
    filters,
    pagination,
    canManage,
    error,
    setFilters,
    setPage,
    setPageSize,
    openProvision,
  } = useBackofficeWhatsAppInstances()

  const [searchInput, setSearchInput] = useState(filters.q)
  const [tab, setTab] = useState("instancias")

  useEffect(() => {
    setSearchInput(filters.q)
  }, [filters.q])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== filters.q) {
        setFilters({ ...filters, q: searchInput })
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [filters, searchInput, setFilters])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as instâncias WhatsApp dos clientes Corretor Studio.
          </p>
        </div>
        {canManage && tab === "instancias" && (
          <Button onClick={openProvision}>
            <Plus data-icon="inline-start" />
            Provisionar instância
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList>
          <TabsTrigger value="instancias">Instâncias</TabsTrigger>
          <TabsTrigger value="atualizacoes">Atualizações</TabsTrigger>
        </TabsList>

        <TabsContent value="instancias" className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por master, time, telefone ou instância..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  status: value as WhatsAppConnectionStatus | "all",
                })
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <BackofficeWhatsAppInstancesTable />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {pagination.totalItems.toLocaleString("pt-BR")} instância
                {pagination.totalItems === 1 ? "" : "s"}
              </span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => setPageSize(Number.parseInt(value, 10))}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>por página</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setPage(pagination.page - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage(pagination.page + 1)}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage(pagination.totalPages)}
              >
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="atualizacoes" className="flex min-h-0 flex-1 flex-col gap-4">
          <BackofficeWhatsAppOpsUpdatesPanel />
        </TabsContent>
      </Tabs>

      <BackofficeWhatsAppInstanceSheet />
      <BackofficeWhatsAppProvisionDialog />
    </div>
  )
}
