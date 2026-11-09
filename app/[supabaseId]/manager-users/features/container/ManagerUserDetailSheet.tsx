"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, ExternalLink, Loader2, LogIn, Mail, Pencil, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ACCESS_EMAIL_KIND_LABEL,
  describeAccessEmailStatus,
  type AccessHistoryEmail,
  type TeamMemberAccessHistory,
} from "@/lib/team-member-access/access-history";
import type { ManagerUserTableRow } from "../types";
import { ACCESS_TONE_CLASS, ROLE_LABEL, delegationLabelsOf } from "../utils/managerUserDisplay";

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** O que saiu da tabela para ela não rolar para o lado: funções, delegações, Google e números. */
function UserDetails({ user }: { user: ManagerUserTableRow }) {
  const delegations = delegationLabelsOf(user);
  const isCloser = user.functions?.includes("CLOSER");
  return (
    <section aria-labelledby="user-details-title" className="flex flex-col gap-1">
      <h3 id="user-details-title" className="text-sm font-semibold text-foreground">Detalhes</h3>
      <dl className="flex flex-col divide-y divide-border">
        <DetailRow label="Funções">{user.functions?.length ? user.functions.join(", ") : "—"}</DetailRow>
        {delegations.length ? <DetailRow label="Delegações">{delegations.join(", ")}</DetailRow> : null}
        <DetailRow label="Google Agenda">{user.googleCalendarConnected ? "Conectado" : "Não conectado"}</DetailRow>
        <DetailRow label="Leads">{user.leadsCount ?? 0}</DetailRow>
        {isCloser ? <DetailRow label="Agendamentos">{user.meetingsCount ?? 0}</DetailRow> : null}
        <DetailRow label="Criado em">{DATE.format(new Date(user.createdAt))}</DetailRow>
      </dl>
    </section>
  );
}

type HistoryState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; history: TeamMemberAccessHistory };

function EmailRow({ email }: { email: AccessHistoryEmail }) {
  const status = describeAccessEmailStatus(email.status);
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{ACCESS_EMAIL_KIND_LABEL[email.category]}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", ACCESS_TONE_CLASS[status.tone])}>
          {status.label}
        </span>
      </div>
      <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {DATE_TIME.format(new Date(email.createdAt))} · {email.recipientEmail}
      </span>
      {status.hint ? <p className="text-xs text-muted-foreground">{status.hint}</p> : null}
    </li>
  );
}

function AccessSection({ state }: { state: HistoryState }) {
  if (state.kind === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }
  if (state.kind === "error") {
    return <p role="alert" className="text-sm text-destructive">{state.message}</p>;
  }
  const { history } = state;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <LogIn className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-semibold text-foreground">Último acesso</span>
          <span className="text-muted-foreground">
            {history.lastSignInAt ? DATE_TIME.format(new Date(history.lastSignInAt)) : "Ainda não acessou a plataforma"}
          </span>
        </div>
      </div>
      <section aria-labelledby="user-access-emails" className="flex flex-col gap-2">
        <h3 id="user-access-emails" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mail className="size-4 text-primary" aria-hidden />
          E-mails de acesso enviados por esta conta
        </h3>
        {history.emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum e-mail de acesso enviado por esta conta ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {history.emails.map((email) => <EmailRow key={email.id} email={email} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Histórico de acesso do usuário ativo, recarregado ao abrir e depois de um reenvio. */
function useAccessHistory(userId: string | null, loadHistory: (userId: string) => Promise<TeamMemberAccessHistory>) {
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  const refresh = useCallback(async () => {
    if (!userId) return;
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", history: await loadHistory(userId) });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Não foi possível carregar o histórico." });
    }
  }, [loadHistory, userId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { state, refresh };
}

export type ManagerUserDetailActions = {
  loadHistory: (userId: string) => Promise<TeamMemberAccessHistory>
  onResend: (email: string, userId: string) => Promise<void>
  onEdit: (user: ManagerUserTableRow) => void
  onDelete: (user: ManagerUserTableRow) => void
  onDeletePending: (user: ManagerUserTableRow) => void
  onViewPendingCheckout: (user: ManagerUserTableRow) => void
  onEditPendingPayment: (user: ManagerUserTableRow) => void
  canDelete: boolean
  canManagePendingPayments: boolean
}

function ActiveUserFooter({ user, actions, onClose, onResend, isResending }: {
  user: ManagerUserTableRow
  actions: ManagerUserDetailActions
  onClose: () => void
  onResend: () => void
  isResending: boolean
}) {
  return (
    <SheetFooter className="flex-col gap-2 sm:flex-col">
      <Button type="button" className="w-full max-lg:min-h-11" onClick={onResend} disabled={isResending}>
        {isResending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
        Reenviar e-mail de acesso
      </Button>
      <div className="grid grid-cols-2 gap-2">
        {user.canEdit ? (
          <Button type="button" variant="outline" className="max-lg:min-h-11" onClick={() => { onClose(); actions.onEdit(user); }}>
            <Pencil data-icon="inline-start" />
            Editar
          </Button>
        ) : null}
        {actions.canDelete ? (
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive max-lg:min-h-11" onClick={() => { onClose(); actions.onDelete(user); }}>
            <Trash2 data-icon="inline-start" />
            Remover
          </Button>
        ) : null}
      </div>
    </SheetFooter>
  );
}

function PendingUserBody({ user, actions, onClose }: {
  user: ManagerUserTableRow
  actions: ManagerUserDetailActions
  onClose: () => void
}) {
  const payment = user.pendingPayment;
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-semantic-warning-border bg-semantic-warning-surface px-4 py-3 text-sm text-foreground">
        Este usuário só é criado depois que o pagamento do usuário adicional for confirmado.
      </p>
      <div className="flex flex-col gap-2">
        {actions.canManagePendingPayments && payment?.checkoutUrl ? (
          <Button type="button" variant="outline" className="max-lg:min-h-11" onClick={() => actions.onViewPendingCheckout(user)}>
            <ExternalLink data-icon="inline-start" />
            Ver pagamento
          </Button>
        ) : null}
        {actions.canManagePendingPayments && payment?.pendingActionId ? (
          <Button type="button" variant="outline" className="max-lg:min-h-11" onClick={() => { onClose(); actions.onEditPendingPayment(user); }}>
            <CreditCard data-icon="inline-start" />
            Trocar forma de pagamento
          </Button>
        ) : null}
        {actions.canDelete ? (
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive max-lg:min-h-11" onClick={() => { onClose(); actions.onDeletePending(user); }}>
            <Trash2 data-icon="inline-start" />
            Cancelar este usuário
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Painel do usuário, aberto ao clicar na linha da tabela: situação de acesso, e-mails de acesso
 * desta conta e as ações (reenviar, editar, remover). Substitui o menu "⋯".
 */
export function ManagerUserDetailSheet({ user, onOpenChange, actions }: {
  user: ManagerUserTableRow | null
  onOpenChange: (open: boolean) => void
  actions: ManagerUserDetailActions
}) {
  const isActive = user?.status === "active";
  const { state, refresh } = useAccessHistory(isActive ? user.id : null, actions.loadHistory);
  const [isResending, setIsResending] = useState(false);
  const close = () => onOpenChange(false);

  const resend = async () => {
    if (!user) return;
    setIsResending(true);
    try {
      await actions.onResend(user.email, user.id);
      await refresh();
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Sheet open={Boolean(user)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="[overflow-wrap:anywhere]">{user?.name}</SheetTitle>
          <SheetDescription className="[overflow-wrap:anywhere]">
            {user ? `${ROLE_LABEL[user.role]} · ${user.email}` : null}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6">
          {user && isActive ? <AccessSection state={state} /> : null}
          {user && isActive ? <UserDetails user={user} /> : null}
          {user && !isActive ? <PendingUserBody user={user} actions={actions} onClose={close} /> : null}
        </div>
        {user && isActive ? (
          <ActiveUserFooter user={user} actions={actions} onClose={close} onResend={() => void resend()} isResending={isResending} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
