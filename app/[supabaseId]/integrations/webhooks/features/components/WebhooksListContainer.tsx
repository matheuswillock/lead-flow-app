"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import type { TeamWebhookDirection, TeamWebhookSummary } from "../services/ITeamWebhooksService";
import { WebhookStatusBadge } from "./WebhookStatusBadge";

type Props = {
  supabaseId: string;
  direction: TeamWebhookDirection;
};

export function WebhooksListContainer({ supabaseId, direction }: Props) {
  const { activeTeam, isLoading: isTeamLoading } = useTeamContext();
  const { tz } = useTimezone();
  const [items, setItems] = useState<TeamWebhookSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const isInbound = direction === "inbound";
  const title = isInbound ? "Webhooks de entrada" : "Webhooks de saída";
  const description = isInbound
    ? "Receba eventos externos e crie leads no CRM."
    : "Envie eventos do CRM para ferramentas externas.";
  const basePath = `/${supabaseId}/integrations/webhooks/${direction}`;

  useEffect(() => {
    if (!activeTeam?.id) return;
    let cancelled = false;
    setLoading(true);
    teamWebhooksService
      .list(supabaseId, activeTeam.id, { direction, page: 1, pageSize: 50 })
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Erro ao listar webhooks");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTeam?.id, direction, supabaseId]);

  if (isTeamLoading || loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" asChild className="w-fit px-0">
            <Link href={`/${supabaseId}/integrations`}>
              <ArrowLeft data-icon="inline-start" />
              Integrações
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild>
          <Link href={`${basePath}/new`}>
            <Plus data-icon="inline-start" />
            Criar webhook
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              {!isInbound ? <TableHead>Destino</TableHead> : null}
              <TableHead>Último uso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isInbound ? 4 : 5} className="text-center text-muted-foreground">
                  Nenhum webhook cadastrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <WebhookStatusBadge status={item.status} />
                  </TableCell>
                  {!isInbound ? (
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">
                      {item.destinationPreset ?? "generic"}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-muted-foreground">
                    {item.lastUsedAt
                      ? formatIntimezone(new Date(item.lastUsedAt), "dd/MM/yyyy HH:mm", tz)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`${basePath}/${item.id}`}>Abrir</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
