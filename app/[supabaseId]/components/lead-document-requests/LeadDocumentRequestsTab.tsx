"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Check, Clock, Copy, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_CLIENT_BASE } from "@/lib/route-map";
import { LeadDocumentRequestsDialog } from "./LeadDocumentRequestsDialog";
import { LeadDocumentRequestsSkeleton } from "./LeadDocumentRequestsSkeleton";

type DocumentRequestItem = {
  id: string;
  name: string;
  description?: string | null;
  isRequired?: boolean;
  uploadedAt: string | null;
  attachmentId?: string | null;
};

type DocumentRequest = {
  id: string;
  publicToken: string;
  message?: string | null;
  status: "pending" | "partially_filled" | "completed" | string;
  createdAt: string;
  items: DocumentRequestItem[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  partially_filled: "Parcial",
  completed: "Completo",
};

function statusVariant(status: string): "secondary" | "outline" | "default" {
  if (status === "completed") return "default";
  if (status === "partially_filled") return "secondary";
  return "outline";
}

interface LeadDocumentRequestsTabProps {
  leadId: string;
  teamId: string;
  supabaseId: string;
}

export function LeadDocumentRequestsTab({
  leadId,
  teamId,
  supabaseId,
}: LeadDocumentRequestsTabProps) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    }),
    [supabaseId, teamId]
  );

  const load = useCallback(async () => {
    const key = `${leadId}:${teamId}`;
    if (inFlightRef.current && requestKeyRef.current === key) return;
    inFlightRef.current = true;
    requestKeyRef.current = key;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/document-requests`, { headers });
      if (!res.ok) throw new Error("Falha ao carregar solicitações");
      const data = await res.json();
      const list = data?.result ?? data;
      setRequests(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("[LeadDocumentRequestsTab] Erro ao carregar:", error);
      toast.error("Não foi possível carregar as solicitações");
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [headers, leadId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const publicUrl = (token: string) => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "";
    return `${origin}/documentos/${token}`;
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(token));
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const resendEmail = async (requestId: string) => {
    if (resendingId) return;
    setResendingId(requestId);
    try {
      const res = await fetch(
        `${API_CLIENT_BASE}/leads/${leadId}/document-requests/${requestId}/resend`,
        { method: "POST", headers }
      );
      const data = await res.json();
      if (!res.ok || data?.isValid === false) {
        throw new Error(data?.errorMessages?.[0] ?? "Falha ao reenviar e-mail");
      }
      toast.success("E-mail reenviado");
    } catch (error) {
      console.error("[LeadDocumentRequestsTab] Erro ao reenviar:", error);
      toastUserError(error);
    } finally {
      setResendingId(null);
    }
  };

  if (isLoading) {
    return (
      <LeadDocumentRequestsSkeleton />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Solicitações de documentos</h4>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          Gerar nova solicitação
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Nenhuma solicitação de documentos ainda
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            Gerar primeira solicitação
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => {
            const url = publicUrl(request.publicToken);
            return (
              <article
                key={request.id}
                className="rounded-lg border border-border/60 bg-card p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">
                      {new Date(request.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {request.items.length} documento(s)
                    </p>
                  </div>
                  <Badge variant={statusVariant(request.status)}>
                    {STATUS_LABEL[request.status] ?? request.status}
                  </Badge>
                </div>

                <ul className="mb-3 flex flex-col gap-1.5">
                  {request.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      {item.uploadedAt ? (
                        <Check className="size-3.5 text-primary" />
                      ) : (
                        <Clock className="size-3.5 text-muted-foreground" />
                      )}
                      <span className={cn(!item.uploadedAt && "text-muted-foreground")}>
                        {item.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-2">
                  <code className="max-w-[180px] truncate rounded-md bg-muted px-2 py-1 text-xs">
                    {url}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => void copyLink(request.publicToken)}
                    aria-label="Copiar link"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={resendingId === request.id}
                    onClick={() => void resendEmail(request.id)}
                  >
                    {resendingId === request.id ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : null}
                    Reenviar e-mail
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <LeadDocumentRequestsDialog
        open={createOpen}
        leadId={leadId}
        teamId={teamId}
        supabaseId={supabaseId}
        onOpenChange={setCreateOpen}
        onRequestCreated={load}
      />
    </div>
  );
}
