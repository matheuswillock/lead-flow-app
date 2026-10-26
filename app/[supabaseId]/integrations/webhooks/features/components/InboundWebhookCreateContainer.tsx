"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup } from "@/components/ui/field";
import { useTeamContext } from "@/app/context/TeamContext";
import type { CreateInboundWebhookPayload, TeamWebhookSummary } from "../services/ITeamWebhooksService";
import {
  WebhookInboundConfigFields,
  type WebhookInboundFormValues,
} from "./WebhookInboundConfigFields";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — a chamada real de
 * criação passa pelo Service page-local (`InboundWebhookCreateService`),
 * injetado via Hook/Context da rota, em vez deste componente compartilhado
 * importar `teamWebhooksService` direto.
 */
type InboundWebhookCreateServiceLike = {
  create(supabaseId: string, teamId: string, payload: CreateInboundWebhookPayload): Promise<TeamWebhookSummary>;
};

type Props = {
  supabaseId: string;
  /** SPEC 10, R10-5: caminhos vêm do Hook page-local (InboundWebhookCreateHook), não hardcoded aqui. */
  listPath: string;
  buildDetailPath: (webhookId: string) => string;
  service: InboundWebhookCreateServiceLike;
};

export function InboundWebhookCreateContainer({ supabaseId, listPath, buildDetailPath, service }: Props) {
  const router = useRouter();
  const { activeTeam } = useTeamContext();
  const [values, setValues] = useState<WebhookInboundFormValues>({
    name: "Webhook Genérico de Leads",
    tokenMode: "auto",
    manualToken: "",
    expiryMode: "indeterminate",
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<TeamWebhookSummary | null>(null);

  const canSubmit =
    Boolean(activeTeam?.id) &&
    values.name.trim().length > 0 &&
    (values.tokenMode !== "manual" || values.manualToken.trim().length >= 8) &&
    !saving;

  const onSubmit = async () => {
    if (!activeTeam?.id || !canSubmit) return;
    setSaving(true);
    try {
      const result = await service.create(supabaseId, activeTeam.id, {
        direction: "inbound",
        name: values.name.trim(),
        tokenMode: values.tokenMode,
        manualToken: values.tokenMode === "manual" ? values.manualToken.trim() : undefined,
        expiryMode: values.expiryMode,
      });
      toast.success("Webhook de entrada criado");
      setCreated(result);
    } catch (error) {
      toastUserError(error);
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}`);
    }
  };

  if (created) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Webhook criado</h1>
          <p className="text-sm text-muted-foreground">
            Copie a URL (e o token, se houver) agora. Depois desta tela o token completo não será
            exibido novamente.
          </p>
        </div>

        <FieldGroup>
          <Field>
            <Label htmlFor="created-url">URL do webhook</Label>
            <div className="flex gap-2">
              <Input id="created-url" readOnly value={created.webhookUrl ?? ""} />
              <Button
                type="button"
                variant="outline"
                disabled={!created.webhookUrl}
                onClick={() => {
                  if (created.webhookUrl) void copyText(created.webhookUrl, "URL");
                }}
              >
                <Copy data-icon="inline-start" />
                Copiar
              </Button>
            </div>
          </Field>
          {created.token ? (
            <Field>
              <Label htmlFor="created-token">Token</Label>
              <div className="flex gap-2">
                <Input id="created-token" readOnly value={created.token} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void copyText(created.token!, "Token");
                  }}
                >
                  <Copy data-icon="inline-start" />
                  Copiar
                </Button>
              </div>
            </Field>
          ) : null}
        </FieldGroup>

        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              router.push(buildDetailPath(created.id));
            }}
          >
            Ir para detalhes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0">
          <Link href={listPath}>
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Novo webhook de entrada</h1>
      </div>

      <WebhookInboundConfigFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild disabled={saving}>
          <Link href={listPath}>Cancelar</Link>
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {saving ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </div>
  );
}
