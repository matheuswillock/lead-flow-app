"use client";

import { RefreshCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIntimezone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ApiResourceUsageItem } from "../services/IApiResourcesService";

type Props = {
  items: ApiResourceUsageItem[];
  loading: boolean;
  error: string | null;
  timezone: string;
  onReload: () => void;
};

/** Texto curto de cada código estável da API; código desconhecido aparece como veio. */
const ERROR_LABELS: Record<string, string> = {
  invalid_date: "Data em formato inválido",
  date_out_of_range: "Data fora da janela de 180 dias",
  resource_inactive: "Recurso desativado",
  feature_unavailable: "Time sem acesso à API de integrações",
  account_restricted: "Conta pausada",
  rate_limited: "Limite de 30 consultas por minuto",
};

function statusVariant(statusCode: number): "default" | "secondary" | "destructive" {
  if (statusCode < 300) return "default";
  return statusCode === 429 ? "secondary" : "destructive";
}

export function AvailabilityUsage({ items, loading, error, timezone, onReload }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-5" aria-labelledby="availability-usage" data-testid="availability-usage">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="availability-usage" className="text-lg font-semibold">
            Últimas consultas
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            As 20 consultas mais recentes ao recurso, mantidas por 30 dias. Só data, resposta e dia consultado: o
            token e os dados dos leads nunca aparecem aqui.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="max-lg:h-11" disabled={loading} onClick={onReload}>
          <RefreshCcw data-icon="inline-start" className={cn(loading && "animate-spin motion-reduce:animate-none")} />
          Atualizar
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading && items.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma consulta ainda. Elas aparecem aqui assim que o parceiro chamar a API.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Dia consultado</TableHead>
                <TableHead>Resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">
                    {formatIntimezone(new Date(item.createdAt), "dd/MM/yyyy HH:mm:ss", timezone)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.requestedDate ?? "-"}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(item.statusCode)}>{item.statusCode}</Badge>
                      {item.errorCode ? (
                        <span className="text-sm text-muted-foreground">
                          {ERROR_LABELS[item.errorCode] ?? item.errorCode}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
