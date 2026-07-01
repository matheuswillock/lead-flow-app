"use client";

import { Handshake } from "lucide-react";
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
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{row.leadName}</p>
            <p className="text-muted-foreground text-xs">{row.leadCode}</p>
          </div>
          <Badge
            variant="outline"
            className="border-precision-border-soft bg-precision-indigo/10 text-precision-indigo"
          >
            Associado
          </Badge>
        </div>
        <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Handshake />
          <h1 className="text-2xl font-semibold tracking-tight">Associados</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Propostas aguardando registro de venda na operadora
        </p>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <AssociadosFiltersBar
            filters={filters}
            items={items}
            onChange={setFilters}
            onRefresh={() => void load()}
          />
          <p className="text-muted-foreground text-sm">
            {data?.pagination.totalItems ?? 0} proposta(s) pendente(s)
          </p>
        </CardHeader>
        <CardContent>
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
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center">
              {filters.search || filters.associateAccountId || filters.teamId
                ? "Nenhum resultado"
                : "Nenhuma proposta aguardando registro"}
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Closer</TableHead>
                      <TableHead>Enviado</TableHead>
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
                            <span className="text-muted-foreground text-xs">{row.leadCode}</span>
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
            </>
          )}
        </CardContent>
      </Card>

      <AssociadoLeadDrawer row={selectedRow} />
    </div>
  );
}
