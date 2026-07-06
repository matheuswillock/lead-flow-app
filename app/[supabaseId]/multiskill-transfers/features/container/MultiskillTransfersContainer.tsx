"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRightLeft,
} from "lucide-react";
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
import { useMultiskillTransfersContext } from "../context/MultiskillTransfersContext";
import { MultiskillTransfersFiltersBar } from "../components/MultiskillTransfersFiltersBar";
import type { MultiskillTransferTargetRow } from "../context/MultiskillTransfersTypes";

function TargetMobileCard({ row }: { row: MultiskillTransferTargetRow }) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <p className="font-medium">{row.masterName ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.masterEmail}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>
            Time padrão: <span className="text-foreground">{row.defaultTeamName}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.closers.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nenhum closer</span>
          ) : (
            row.closers.map((closer) => (
              <Badge key={closer.profileId} variant="secondary">
                {closer.fullName ?? closer.email}
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MultiskillTransfersContainer() {
  const { isLoading, error, data, filters, setFilters, load } = useMultiskillTransfersContext();

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const handleRefresh = () => {
    void load();
  };

  return (
    <div className="container mx-auto flex flex-col gap-6 px-6 py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">MultiSkill — Destinos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Contas habilitadas para receber transferências cross-account. O lead sempre cai no time
          padrão do master destino.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <MultiskillTransfersFiltersBar onRefresh={handleRefresh} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading && items.length === 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum destino MultiSkill encontrado.
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Master</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Time padrão</TableHead>
                      <TableHead>Closers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row.masterId}>
                        <TableCell className="font-medium">{row.masterName ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.masterEmail}</TableCell>
                        <TableCell>{row.defaultTeamName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.closers.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              row.closers.map((closer) => (
                                <Badge key={closer.profileId} variant="secondary">
                                  {closer.fullName ?? closer.email}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {items.map((row) => (
                  <TargetMobileCard key={row.masterId} row={row} />
                ))}
              </div>
            </>
          )}

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages} ({pagination.totalItems}{" "}
                destinos)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!pagination.hasPreviousPage || isLoading}
                  onClick={() => setFilters({ page: 1 })}
                >
                  <ChevronsLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!pagination.hasPreviousPage || isLoading}
                  onClick={() => setFilters({ page: Math.max(1, filters.page - 1) })}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!pagination.hasNextPage || isLoading}
                  onClick={() => setFilters({ page: filters.page + 1 })}
                >
                  <ChevronRight />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!pagination.hasNextPage || isLoading}
                  onClick={() => setFilters({ page: pagination.totalPages })}
                >
                  <ChevronsRight />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
