"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { API_CLIENT_BASE } from "@/lib/route-map";

type ExternalMemberInviteFormProps = {
  teamId: string;
  supabaseId: string;
  onSuccess: () => void;
};

export function ExternalMemberInviteForm({
  teamId,
  supabaseId,
  onSuccess,
}: ExternalMemberInviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "backoffice" | "operator">("operator");
  const [sdrEnabled, setSdrEnabled] = useState(true);
  const [closerEnabled, setCloserEnabled] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    name?: string;
    email?: string;
    hasActiveAccount?: boolean;
  } | null>(null);

  const functions = useMemo(() => {
    const values: ("SDR" | "CLOSER")[] = [];
    if (sdrEnabled) values.push("SDR");
    if (closerEnabled) values.push("CLOSER");
    return values;
  }, [sdrEnabled, closerEnabled]);

  const runLookup = useCallback(async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setLookupResult(null);
      return;
    }

    setLookupLoading(true);
    try {
      const response = await fetch(
        `${API_CLIENT_BASE}/teams/${teamId}/members/external/lookup?email=${encodeURIComponent(normalized)}`,
        {
          headers: { "x-supabase-user-id": supabaseId },
        }
      );
      const output = await response.json();
      if (!output.isValid) {
        setLookupResult(null);
        return;
      }
      setLookupResult(output.result as typeof lookupResult);
    } catch (error) {
      console.error("[ExternalMemberInviteForm] lookup error:", error);
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  }, [supabaseId, teamId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runLookup(email);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [email, runLookup]);

  const handleSubmit = async () => {
    if (submitLoading) return;

    setSubmitLoading(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/teams/${teamId}/members/external`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({ email, role, functions }),
      });
      const output = await response.json();

      if (!output.isValid) {
        toast.error(output.errorMessages?.join(", ") || "Não foi possível convidar o membro externo.");
        return;
      }

      const result = output.result as {
        requiresPayment?: boolean;
        checkoutUrl?: string;
      };

      if (result?.requiresPayment && result.checkoutUrl) {
        toast.info("Pagamento pendente. Você será redirecionado para concluir a cobrança.");
        window.location.href = result.checkoutUrl;
        return;
      }

      toast.success("Membro externo adicionado com sucesso.");
      setEmail("");
      setLookupResult(null);
      onSuccess();
    } catch (error) {
      console.error("[ExternalMemberInviteForm] submit error:", error);
      toast.error("Erro ao convidar membro externo.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserPlus data-icon="inline-start" />
        Membro externo
      </div>
      <p className="text-xs text-muted-foreground">
        Convide um usuário de outra conta pelo e-mail. A vaga será cobrada nesta conta após o pagamento.
      </p>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="external-member-email">E-mail</FieldLabel>
          <Input
            id="external-member-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@empresa.com"
          />
        </Field>

        {lookupLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : lookupResult?.found ? (
          <div className="flex flex-col gap-1 rounded-md border border-border/60 p-3 text-sm">
            <span className="font-medium">{lookupResult.name}</span>
            <span className="text-muted-foreground">{lookupResult.email}</span>
            {!lookupResult.hasActiveAccount ? (
              <Badge variant="outline">Conta inativa</Badge>
            ) : null}
          </div>
        ) : email.includes("@") ? (
          <p className="text-xs text-muted-foreground">Usuário não encontrado na plataforma.</p>
        ) : null}

        <Field>
          <FieldLabel>Papel</FieldLabel>
          <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="backoffice">Backoffice</SelectItem>
                <SelectItem value="manager">Gerente</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Funções</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={sdrEnabled ? "default" : "outline"}
              onClick={() => setSdrEnabled((current) => !current)}
              disabled={submitLoading}
            >
              SDR
            </Button>
            <Button
              type="button"
              size="sm"
              variant={closerEnabled ? "default" : "outline"}
              onClick={() => setCloserEnabled((current) => !current)}
              disabled={submitLoading}
            >
              Closer
            </Button>
          </div>
        </Field>

        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitLoading || !lookupResult?.found || !lookupResult.hasActiveAccount}
        >
          {submitLoading ? "Enviando..." : "Convidar membro externo"}
        </Button>
      </FieldGroup>
    </div>
  );
}
