"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Archive, ArchiveRestore, FileText, History, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { useBackofficeContracts } from "../context/BackofficeContractsContext"
import { NewContractDialog } from "../components/NewContractDialog"
import { ContractVersionsSheet } from "../components/ContractVersionsSheet"

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value))
}

export function BackofficeContractsContainer() {
  const { items, isLoading, canManage, updateContract, deleteContract } = useBackofficeContracts()
  const [versionsSheetContractId, setVersionsSheetContractId] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string; isActive: boolean } | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  async function handleToggleActive() {
    if (!archiveTarget) return
    const result = await updateContract(archiveTarget.id, { isActive: !archiveTarget.isActive })
    if (result.isValid) {
      toast.success(archiveTarget.isActive ? "Contrato arquivado" : "Contrato reativado")
    } else {
      toast.error(result.errorMessages[0] ?? "Erro ao atualizar contrato")
    }
    setArchiveTarget(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const result = await deleteContract(deleteTarget.id)
    if (result.isValid) {
      toast.success("Contrato excluído")
    } else {
      toast.error(result.errorMessages[0] ?? "Erro ao excluir contrato")
    }
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Documentos de contrato em PDF, com versionamento e link de compartilhamento.
          </p>
        </div>
        {canManage && <NewContractDialog />}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-center text-muted-foreground">
          <FileText className="size-8" />
          <p>Nenhum contrato cadastrado ainda.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Versões</TableHead>
              <TableHead>Última versão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">{contract.title}</TableCell>
                <TableCell>{contract.client?.fullName ?? "—"}</TableCell>
                <TableCell>{contract.versionsCount}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {contract.latestVersion
                    ? `v${contract.latestVersion.versionNumber} · ${
                        contract.latestVersion.importedBy?.fullName ?? "—"
                      } · ${formatDate(contract.latestVersion.importedAt)}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={contract.isActive ? "default" : "outline"}>
                    {contract.isActive ? "Ativo" : "Arquivado"}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVersionsSheetContractId(contract.id)}
                  >
                    <History data-icon="inline-start" />
                    Versões
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setArchiveTarget({
                            id: contract.id,
                            title: contract.title,
                            isActive: contract.isActive,
                          })
                        }
                      >
                        {contract.isActive ? (
                          <Archive data-icon="inline-start" />
                        ) : (
                          <ArchiveRestore data-icon="inline-start" />
                        )}
                        {contract.isActive ? "Arquivar" : "Reativar"}
                      </Button>
                      {contract.versionsCount === 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget({ id: contract.id, title: contract.title })}
                        >
                          <Trash2 data-icon="inline-start" />
                          Excluir
                        </Button>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ContractVersionsSheet
        contractId={versionsSheetContractId}
        open={versionsSheetContractId !== null}
        onOpenChange={(open) => {
          if (!open) setVersionsSheetContractId(null)
        }}
      />

      <AlertDialog open={archiveTarget !== null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.isActive ? "Arquivar contrato" : "Reativar contrato"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.isActive
                ? `Tem certeza que deseja arquivar "${archiveTarget?.title}"? Ele deixará de aparecer como ativo, mas suas versões e links permanecem preservados.`
                : `Tem certeza que deseja reativar "${archiveTarget?.title}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
