"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Button } from "@/components/ui/button";
import { useTeamContext } from "@/app/context/TeamContext";
import type { CreateOutboundWebhookPayload, TeamWebhookSummary } from "../services/ITeamWebhooksService";
import {
  WebhookOutboundConfigFields,
  type WebhookOutboundFormValues,
} from "./WebhookOutboundConfigFields";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — a chamada real de
 * criação passa pelo Service page-local (`OutboundWebhookCreateService`),
 * injetado via Hook/Context da rota, em vez deste componente compartilhado
 * importar `teamWebhooksService` direto.
 */
type OutboundWebhookCreateServiceLike = {
  create(supabaseId: string, teamId: string, payload: CreateOutboundWebhookPayload): Promise<TeamWebhookSummary>;
};

type Props = {
  supabaseId: string;
  /** SPEC 10, R10-5: caminhos vêm do Hook page-local (OutboundWebhookCreateHook), não hardcoded aqui. */
  listPath: string;
  buildDetailPath: (webhookId: string) => string;
  service: OutboundWebhookCreateServiceLike;
};

export function OutboundWebhookCreateContainer({ supabaseId, listPath, buildDetailPath, service }: Props) {
  const router = useRouter();
  const { activeTeam } = useTeamContext();
  const [values, setValues] = useState<WebhookOutboundFormValues>({
    name: "",
    targetUrl: "",
    destinationPreset: "generic",
    selectedEvents: ["lead_created"],
    failureThreshold: 10,
  });
  const [saving, setSaving] = useState(false);

  const canSubmit =
    Boolean(activeTeam?.id) &&
    values.name.trim().length > 0 &&
    values.targetUrl.trim().length > 0 &&
    values.selectedEvents.length > 0 &&
    !saving;

  const onSubmit = async () => {
    if (!activeTeam?.id || !canSubmit) return;
    setSaving(true);
    try {
      const created = await service.create(supabaseId, activeTeam.id, {
        direction: "outbound",
        name: values.name.trim(),
        targetUrl: values.targetUrl.trim(),
        destinationPreset: values.destinationPreset,
        selectedEvents: values.selectedEvents,
        failureThreshold: values.failureThreshold,
      });
      toast.success("Webhook de saída criado");
      router.push(buildDetailPath(created.id));
    } catch (error) {
      toastUserError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0">
          <Link href={listPath}>
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Novo webhook de saída</h1>
      </div>

      <WebhookOutboundConfigFields
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
