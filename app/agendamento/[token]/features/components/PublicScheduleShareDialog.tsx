"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatIntimezone } from "@/lib/dates";
import { ExternalLink, RefreshCcw } from "lucide-react";
import type { PublicScheduleShareData } from "../services/IPublicScheduleShareService";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Reunião pronta";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}min`);
  parts.push(`${seconds}seg`);
  return `Faltam ${parts.join(" ")} para a reunião`;
}

export function PublicScheduleShareDialog({
  status,
  data,
  error,
  onRetry,
}: {
  status: "loading" | "ready" | "error";
  data: PublicScheduleShareData | null;
  error: string | null;
  onRetry: () => Promise<void>;
}) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!data?.availableAt) {
      setTimeLeft(null);
      return;
    }
    const availableAtMs = new Date(data.availableAt).getTime();
    const tick = () => setTimeLeft(availableAtMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.availableAt]);

  const isReady = status === "ready" && !!data;
  const isWithinWindow = timeLeft !== null && timeLeft <= 0;
  const joinAllowed = isWithinWindow && !!data?.meetingLink;

  return (
    <Dialog open>
      <DialogContent className="max-h-[90vh] flex flex-col border-border bg-surface-3 shadow-[var(--precision-shadow-2)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Agendamento</DialogTitle>
          <DialogDescription>
            Resumo público da reunião compartilhada no Corretor Studio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {status === "loading" && (
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-5 text-sm text-muted-foreground">
              Carregando informações do agendamento...
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--semantic-danger-border)] bg-[color:var(--semantic-danger-surface)] px-4 py-5">
              <Badge variant="outline" className="w-fit border-[color:var(--semantic-danger-border)] text-[color:var(--semantic-danger)]">
                Link indisponível
              </Badge>
              <p className="text-sm text-foreground">{error}</p>
              <Button type="button" variant="outline" className="w-fit" onClick={() => void onRetry()}>
                <RefreshCcw data-icon="inline-start" />
                Tentar novamente
              </Button>
            </div>
          )}

          {isReady && (
            <>
              <div className="rounded-2xl border border-border bg-surface-2 px-4 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Reunião com {data.leadName}</p>
                    <h2 className="text-xl font-semibold text-foreground">{data.meetingTitle}</h2>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      joinAllowed
                        ? "border-[color:var(--semantic-success-border)] text-[color:var(--semantic-success)]"
                        : "border-[color:var(--semantic-warning-border)] text-[color:var(--semantic-warning)]"
                    }
                  >
                    {joinAllowed ? "Reunião pronta" : "Aguardando liberação"}
                  </Badge>
                </div>

                <Separator className="my-4" />

                <div className="grid gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Data e horário</p>
                    <p className="font-medium text-foreground">
                      {formatIntimezone(new Date(data.meetingDate), "dd/MM/yyyy 'às' HH:mm", data.timezone)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-medium capitalize text-foreground">{data.meetingType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Validade do link</p>
                    <p className="font-medium text-foreground">
                      {formatIntimezone(new Date(data.expiresAt), "dd/MM/yyyy 'às' HH:mm", data.timezone)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface-2 px-4 py-5">
                <p className="text-sm text-muted-foreground">
                  {timeLeft === null
                    ? "Verificando disponibilidade..."
                    : joinAllowed
                    ? "Sua reunião está pronta. Clique para acessar."
                    : formatCountdown(timeLeft)}
                </p>
                <Button
                  type="button"
                  className="mt-4 w-full bg-primary text-primary-foreground"
                  disabled={!joinAllowed}
                  asChild={joinAllowed}
                >
                  {joinAllowed ? (
                    <a href={data.meetingLink!} target="_blank" rel="noreferrer">
                      <ExternalLink data-icon="inline-end" />
                      Acessar reunião
                    </a>
                  ) : (
                    <span>Acessar reunião</span>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
