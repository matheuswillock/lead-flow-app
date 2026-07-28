"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import type {
  TeamWebhookDirection,
  TeamWebhookLogItem,
  TeamWebhookSummary,
} from "../services/ITeamWebhooksService";
import { WEBHOOK_EVENT_OPTIONS } from "../services/ITeamWebhooksService";
import { WebhookStatusBadge } from "./WebhookStatusBadge";

type Props = {
  supabaseId: string;
  webhookId: string;
  direction: TeamWebhookDirection;
};

export function WebhookDetailContainer({ supabaseId, webhookId, direction }: Props) {
  const { activeTeam } = useTeamContext();
  const { tz } = useTimezone();
  const [webhook, setWebhook] = useState<TeamWebhookSummary | null>(null);
  const [logs, setLogs] = useState<TeamWebhookLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);

  const listPath = `/${supabaseId}/integrations/webhooks/${direction}`;

  const load = useCallback(async () => {
    if (!activeTeam?.id) return;
    setLoading(true);
    try {
      const [detail, logResult] = await Promise.all([
        teamWebhooksService.getById(supabaseId, activeTeam.id, webhookId),
        teamWebhooksService.listLogs(supabaseId, activeTeam.id, webhookId, {
          page: logsPage,
          pageSize: 20,
        }),
      ]);
      setWebhook(detail);
      setLogs(logResult.items);
      setLogsTotal(logResult.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar webhook");
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id, logsPage, supabaseId, webhookId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runStatus = async (body: { status: "active" | "disabled" } | { action: "reactivate" }) => {
    if (!activeTeam?.id || actionPending) return;
    setActionPending(true);
    try {
      const updated = await teamWebhooksService.changeStatus(
        supabaseId,
        activeTeam.id,
        webhookId,
        body
      );
      setWebhook(updated);
      toast.success("Status atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar status");
    } finally {
      setActionPending(false);
    }
  };

  const runTest = async () => {
    if (!activeTeam?.id || actionPending) return;
    setActionPending(true);
    try {
      await teamWebhooksService.testDelivery(supabaseId, activeTeam.id, webhookId);
      toast.success("Envio de teste concluído");
      setLogsPage(1);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no teste");
    } finally {
      setActionPending(false);
    }
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (loading || !webhook) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const eventLabels = webhook.selectedEvents
    .map((key) => WEBHOOK_EVENT_OPTIONS.find((option) => option.value === key)?.label ?? key)
    .join(", ");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" asChild className="w-fit px-0">
            <Link href={listPath}>
              <ArrowLeft data-icon="inline-start" />
              Voltar
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{webhook.name}</h1>
            <WebhookStatusBadge status={webhook.status} />
            <Badge variant="outline">{direction === "inbound" ? "Entrada" : "Saída"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {webhook.status === "paused" ? (
            <Button onClick={() => runStatus({ action: "reactivate" })} disabled={actionPending}>
              Reativar
            </Button>
          ) : null}
          {webhook.status === "active" ? (
            <Button variant="outline" onClick={() => runStatus({ status: "disabled" })} disabled={actionPending}>
              Desativar
            </Button>
          ) : null}
          {webhook.status === "disabled" ? (
            <Button onClick={() => runStatus({ status: "active" })} disabled={actionPending}>
              Ativar
            </Button>
          ) : null}
          {direction === "outbound" ? (
            <Button variant="secondary" onClick={runTest} disabled={actionPending}>
              Testar envio
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={() => void load()} disabled={actionPending}>
            <RefreshCcw />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="flex flex-col gap-4 pt-4">
          {direction === "inbound" ? (
            <div className="flex flex-col gap-2">
              <Label>URL do webhook</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhook.webhookUrl ?? ""} />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => webhook.webhookUrl && void copyValue(webhook.webhookUrl)}
                >
                  <Copy />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Token: {webhook.tokenPreview ?? "—"} · Expiração: {webhook.expiryMode ?? "—"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>URL de destino</Label>
                <Input readOnly value={webhook.targetUrl ?? ""} />
              </div>
              <p className="text-sm text-muted-foreground">
                Preset: {webhook.destinationPreset ?? "generic"} · Falhas: {webhook.failureStreak}/
                {webhook.failureThreshold}
              </p>
              <p className="text-sm text-muted-foreground">Eventos: {eventLabels || "—"}</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum log ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatIntimezone(new Date(log.createdAt), "dd/MM/yyyy HH:mm", tz)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.result === "success"
                              ? "default"
                              : log.result === "rejected"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {log.result}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.statusCode ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">
                        {log.errorMessage ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {logsPage} · {logsTotal} registro(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={logsPage <= 1 || actionPending}
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={logsPage * 20 >= logsTotal || actionPending}
                onClick={() => setLogsPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
