"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTeamContext } from "@/app/context/TeamContext";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import {
  WebhookOutboundConfigFields,
  type WebhookOutboundFormValues,
} from "./WebhookOutboundConfigFields";

type Props = { supabaseId: string };

export function OutboundWebhookCreateContainer({ supabaseId }: Props) {
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
      const created = await teamWebhooksService.create(supabaseId, activeTeam.id, {
        direction: "outbound",
        name: values.name.trim(),
        targetUrl: values.targetUrl.trim(),
        destinationPreset: values.destinationPreset,
        selectedEvents: values.selectedEvents,
        failureThreshold: values.failureThreshold,
      });
      toast.success("Webhook de saída criado");
      router.push(`/${supabaseId}/integrations/webhooks/outbound/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar webhook");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0">
          <Link href={`/${supabaseId}/integrations/webhooks/outbound`}>
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
          <Link href={`/${supabaseId}/integrations/webhooks/outbound`}>Cancelar</Link>
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {saving ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </div>
  );
}
