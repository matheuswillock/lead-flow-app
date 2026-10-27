import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface IntegrationFlowStep {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  locked: boolean;
}

export function buildIntegrationFlowSteps(params: {
  supabaseId: string;
  webhooksLocked: boolean;
  apiCatalogLocked: boolean;
}): IntegrationFlowStep[] {
  const base = `/${params.supabaseId}`;
  const subscription = `${base}/subscription`;
  const pick = (locked: boolean, href: string) => (locked ? subscription : href);

  return [
    {
      title: "Criar o webhook de entrada",
      description: "Escolha a versão 2, os SDRs que recebem os leads e se o webhook pode agendar reuniões.",
      href: pick(params.webhooksLocked, `${base}/integrations/webhooks/inbound/new`),
      linkLabel: "Criar webhook",
      locked: params.webhooksLocked,
    },
    {
      title: "Copiar a URL e o token",
      description: "O token aparece uma única vez. Guarde em um cofre e envie ao parceiro por um canal seguro.",
      href: pick(params.webhooksLocked, `${base}/integrations/webhooks/inbound`),
      linkLabel: "Ver webhooks",
      locked: params.webhooksLocked,
    },
    {
      title: "Ativar a API de horários",
      description: "Só para leads com reunião: gere o token da consulta de horários livres dos closers.",
      href: pick(params.apiCatalogLocked, `${base}/integrations/api-catalog`),
      linkLabel: "Abrir Catálogo de API",
      locked: params.apiCatalogLocked,
    },
    {
      title: "Enviar um lead de teste",
      description: "Use os exemplos da aba Guia do webhook e confira o evento na aba Logs.",
      href: pick(params.webhooksLocked, `${base}/integrations/webhooks/inbound`),
      linkLabel: "Abrir o guia",
      locked: params.webhooksLocked,
    },
    {
      title: "Conferir o lead no CRM",
      description: "O lead entra como nova oportunidade ou agendado. Conflito de horário aparece com o selo \"Remarcar urgente\".",
      href: `${base}/board`,
      linkLabel: "Abrir o quadro",
      locked: false,
    },
  ];
}

/** Passo a passo de ativação da integração (webhook v2 + API de horários), exibido no hub. */
export function IntegrationFlowChecklist({ steps }: { steps: IntegrationFlowStep[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="integration-flow-title" data-testid="integration-flow">
      <div className="flex flex-col gap-1">
        <h2 id="integration-flow-title" className="text-sm font-semibold text-muted-foreground">
          Como colocar uma integração para funcionar
        </h2>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3 rounded-lg border p-3">
            <Badge variant="outline" className="mt-0.5 size-6 shrink-0 justify-center rounded-full p-0">
              {index + 1}
            </Badge>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              <Link
                href={step.href}
                className="inline-flex min-h-11 w-fit shrink-0 items-center gap-1 rounded-md text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={step.locked ? `${step.linkLabel}: recurso bloqueado, ver planos` : step.linkLabel}
              >
                {step.locked ? <Lock className="size-3.5" aria-hidden="true" /> : null}
                {step.linkLabel}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
