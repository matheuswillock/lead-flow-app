"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Handshake } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAssociadosContext } from "../context/AssociadosContext";
import type { AssociateProposalRow } from "../context/AssociadosTypes";
import { AssociadosFiltersBar } from "../components/AssociadosFiltersBar";
import { AssociadoLeadDrawer } from "../components/AssociadoLeadDrawer";

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProposalRowActions({ onOpen }: { row: AssociateProposalRow; onOpen: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onOpen}>
      Detalhes
    </Button>
  );
}

function ProposalMobileCard({
  row,
  onOpen,
}: {
  row: AssociateProposalRow;
  onOpen: () => void;
}) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{row.leadName}</p>
            <p className="text-xs text-muted-foreground">{row.leadCode}</p>
          </div>
          <Badge
            variant="outline"
            className="border-precision-border-soft bg-precision-indigo/10 text-precision-indigo"
          >
            Associado
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <p>Conta: {row.associateAccountName}</p>
          <p>Time: {row.teamName}</p>
          <p>Plano: {row.soldPlan ?? "—"}</p>
          <p>Valor: {formatCurrency(row.ticket)}</p>
          <p>Closer: {row.closerName ?? "—"}</p>
          <p>Enviado: {new Date(row.statusEnteredAt).toLocaleDateString("pt-BR")}</p>
        </div>
        <ProposalRowActions row={row} onOpen={onOpen} />
      </CardContent>
    </Card>
  );
}

export function AssociadosContainer() {
  const {
    isLoading,
    error,
    data,
    filters,
    setFilters,
    load,
    openLead,
    selectedLeadId,
  } = useAssociadosContext();

  const selectedRow = data?.items.find((item) => item.leadId === selectedLeadId) ?? null;
  const items = data?.items ?? [];
  const totalItems = data?.pagination.totalItems ?? 0;
  const totalPages = Math.max(data?.pagination.totalPages ?? 1, 1);
  const currentPage = data?.pagination.page ?? filters.page;
  const pageSize = data?.pagination.pageSize ?? filters.pageSize;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Associados</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {totalItems} proposta(s) aguardando registro de venda na operadora
        </p>
      </div>

      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="gap-4 pb-0">
          <AssociadosFiltersBar
            filters={filters}
            items={items}
            onChange={setFilters}
            onRefresh={() => void load()}
          />
        </CardHeader>
        <CardContent className="pt-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              {filters.search || filters.associateAccountId || filters.teamId || filters.closerId
                ? "Nenhum resultado encontrado."
                : "Nenhuma proposta aguardando registro."}
            </p>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border/60 md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Closer</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row.leadId}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{row.associateAccountName}</span>
                            <Badge
                              variant="outline"
                              className="w-fit border-precision-border-soft bg-precision-indigo/10 text-precision-indigo"
                            >
                              Associado
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{row.teamName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{row.leadName}</span>
                            <span className="text-xs text-muted-foreground">{row.leadCode}</span>
                          </div>
                        </TableCell>
                        <TableCell>{row.soldPlan ?? "—"}</TableCell>
                        <TableCell>{formatCurrency(row.ticket)}</TableCell>
                        <TableCell>{row.closerName ?? "—"}</TableCell>
                        <TableCell>
                          {new Date(row.statusEnteredAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <ProposalRowActions row={row} onOpen={() => openLead(row.leadId)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {items.map((row) => (
                  <ProposalMobileCard
                    key={row.leadId}
                    row={row}
                    onOpen={() => openLead(row.leadId)}
                  />
                ))}
              </div>

              <div className="flex items-center justify-end px-2 pt-4">
                <div className="flex items-center gap-6 lg:gap-8">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Linhas por página</p>
                    <select
                      aria-label="Linhas por página"
                      title="Linhas por página"
                      value={pageSize}
                      onChange={(event) =>
                        setFilters({ pageSize: Number(event.target.value), page: 1 })
                      }
                      className="h-8 w-[70px] rounded-md border border-input bg-background px-2"
                    >
                      {[10, 20, 30, 40, 50].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex w-[120px] items-center justify-center text-sm font-medium">
                    Página {currentPage} de {totalPages}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setFilters({ page: 1 })}
                      disabled={currentPage <= 1}
                    >
                      <span className="sr-only">Ir para primeira página</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setFilters({ page: currentPage - 1 })}
                      disabled={currentPage <= 1}
                    >
                      <span className="sr-only">Página anterior</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setFilters({ page: currentPage + 1 })}
                      disabled={currentPage >= totalPages}
                    >
                      <span className="sr-only">Próxima página</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setFilters({ page: totalPages })}
                      disabled={currentPage >= totalPages}
                    >
                      <span className="sr-only">Ir para última página</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AssociadoLeadDrawer row={selectedRow} />
    </div>
  );
}
