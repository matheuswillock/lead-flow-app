"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Copy, Link2, Loader2, Ban, FilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeContracts } from "../context/BackofficeContractsContext"
import type { BackofficeContractDetail } from "../context/BackofficeContractsTypes"
import { NewVersionDialog } from "./NewVersionDialog"

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  )
}

function formatFileSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function isShareActive(shareExpiresAt: string | null): boolean {
  if (!shareExpiresAt) return false
  return new Date(shareExpiresAt).getTime() > Date.now()
}

export function ContractVersionsSheet({
  contractId,
  open,
  onOpenChange,
}: {
  contractId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { canManage, getContractDetail, generateShareLink, revokeShareLink } =
    useBackofficeContracts()
  const [detail, setDetail] = useState<BackofficeContractDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null)
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({})
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!contractId) return
    setIsLoading(true)
    try {
      const result = await getContractDetail(contractId)
      setDetail(result)
    } catch (err) {
      console.error("[ContractVersionsSheet][loadDetail]", err)
      toast.error("Erro ao carregar versões do contrato")
    } finally {
      setIsLoading(false)
    }
  }, [contractId, getContractDetail])

  useEffect(() => {
    if (open && contractId) {
      void loadDetail()
    } else {
      setDetail(null)
      setGeneratedLinks({})
    }
  }, [open, contractId, loadDetail])

  async function handleGenerateShareLink(versionId: string) {
    setPendingVersionId(versionId)
    try {
      const result = await generateShareLink(versionId)
      if (result.isValid && result.result) {
        setGeneratedLinks((prev) => ({ ...prev, [versionId]: result.result!.shareUrl }))
        await loadDetail()
        toast.success("Link de compartilhamento gerado")
      } else {
        toast.error(result.errorMessages[0] ?? "Erro ao gerar link")
      }
    } finally {
      setPendingVersionId(null)
    }
  }

  async function handleRevokeShareLink(versionId: string) {
    setPendingVersionId(versionId)
    try {
      const result = await revokeShareLink(versionId)
      if (result.isValid) {
        setGeneratedLinks((prev) => {
          const next = { ...prev }
          delete next[versionId]
          return next
        })
        await loadDetail()
        toast.success("Link revogado")
      } else {
        toast.error(result.errorMessages[0] ?? "Erro ao revogar link")
      }
    } finally {
      setPendingVersionId(null)
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
    toast.success("Link copiado")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail?.title ?? "Versões do contrato"}</SheetTitle>
          <SheetDescription>
            Histórico de versões importadas, autor e link de compartilhamento (expira em 24h).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          {canManage && detail && (
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => setNewVersionDialogOpen(true)}
            >
              <FilePlus data-icon="inline-start" />
              Importar nova versão
            </Button>
          )}

          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versão</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Importado em</TableHead>
                  <TableHead>Compartilhamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.versions.map((version) => {
                  const shareActive = isShareActive(version.shareExpiresAt)
                  const generatedLink = generatedLinks[version.id]
                  const isPending = pendingVersionId === version.id

                  return (
                    <TableRow key={version.id}>
                      <TableCell>v{version.versionNumber}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{version.fileName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(version.fileSize)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {version.importedBy?.fullName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(version.importedAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {shareActive ? (
                            <Badge variant="secondary" className="w-fit">
                              Ativo até {formatDate(version.shareExpiresAt!)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="w-fit">
                              Sem link ativo
                            </Badge>
                          )}

                          {generatedLink && (
                            <div className="flex gap-2">
                              <Input value={generatedLink} readOnly className="text-xs" />
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => copyLink(generatedLink)}
                              >
                                <Copy data-icon="inline-start" />
                                <span className="sr-only">Copiar link</span>
                              </Button>
                            </div>
                          )}

                          {canManage && (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleGenerateShareLink(version.id)}
                              >
                                {isPending ? (
                                  <Loader2 className="animate-spin" />
                                ) : (
                                  <Link2 data-icon="inline-start" />
                                )}
                                {shareActive ? "Gerar novo link" : "Gerar link"}
                              </Button>
                              {shareActive && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={isPending}
                                  onClick={() => handleRevokeShareLink(version.id)}
                                >
                                  <Ban data-icon="inline-start" />
                                  Revogar
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>

      {detail && (
        <NewVersionDialog
          contractId={detail.id}
          contractTitle={detail.title}
          open={newVersionDialogOpen}
          onOpenChange={(nextOpen) => {
            setNewVersionDialogOpen(nextOpen)
            if (!nextOpen) void loadDetail()
          }}
        />
      )}
    </Sheet>
  )
}
