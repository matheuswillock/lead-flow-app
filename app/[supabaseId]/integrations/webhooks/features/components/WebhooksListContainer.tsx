"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { WebhookListPlayPauseButton } from "./WebhookListPlayPauseButton";
import { WebhooksTablePagination } from "./WebhooksTablePagination";

type Props = {
  supabaseId: string;
  direction: TeamWebhookDirection;
};

export function WebhooksListContainer({ supabaseId, direction }: Props) {
  const { activeTeam, isLoading: isTeamLoading } = useTeamContext();
  const { tz } = useTimezone();
  const [items, setItems] = useState<TeamWebhookSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isInbound = direction === "inbound";
  const title = isInbound ? "Webhooks de entrada" : "Webhooks de saída";
  const description = isInbound
    ? "Receba eventos externos e crie leads no CRM."
    : "Envie eventos do CRM para ferramentas externas.";
  const basePath = `/${supabaseId}/integrations/webhooks/${direction}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!activeTeam?.id) return;
    let cancelled = false;
    setLoading(true);
    teamWebhooksService
      .list(supabaseId, activeTeam.id, { direction, page, pageSize, search: search || undefined })
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toastUserError(error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTeam?.id, direction, page, pageSize, search, supabaseId]);

  const handleToggleStatus = async (item: TeamWebhookSummary) => {
    if (!activeTeam?.id || togglingId) return;
    setTogglingId(item.id);
    try {
      const body =
        item.status === "active"
          ? { status: "disabled" as const }
          : item.status === "paused"
            ? { action: "reactivate" as const }
            : { status: "active" as const };
      const updated = await teamWebhooksService.changeStatus(
        supabaseId,
        activeTeam.id,
        item.id,
        body
      );
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
      toast.success("Status atualizado");
    } catch (error) {
      toastUserError(error);
    } finally {
      setTogglingId(null);
    }
  };

  if (isTeamLoading || (loading && items.length === 0 && !searchInput)) {
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

      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nome"
          className="pl-9"
          aria-label="Buscar webhook por nome"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              {!isInbound ? <TableHead>Destino</TableHead> : null}
              <TableHead>Último uso</TableHead>
              <TableHead className="w-[72px] text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isInbound ? 5 : 6} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isInbound ? 5 : 6} className="text-center text-muted-foreground">
                  {search ? "Nenhum webhook encontrado para esta busca." : "Nenhum webhook cadastrado ainda."}
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
                  <TableCell className="text-center">
                    <WebhookListPlayPauseButton
                      status={item.status}
                      disabled={togglingId === item.id}
                      onToggle={() => void handleToggleStatus(item)}
                    />
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
        <WebhooksTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          disabled={loading || Boolean(togglingId)}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
