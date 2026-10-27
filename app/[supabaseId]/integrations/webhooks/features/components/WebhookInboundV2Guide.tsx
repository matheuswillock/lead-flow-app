"use client";

import { Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BODY_FIELDS,
  DURATION_NOTE,
  HTTP_RESPONSES,
  OUTCOMES,
  PROCESSING_NOTE,
  REQUEST_HEADERS,
  SECURITY_NOTES,
  buildCurlCreate,
  buildCurlSchedule,
} from "./inboundV2Guide";

type Props = {
  webhookUrl: string | null;
  apiCatalogHref: string;
};

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  } catch {
    toast.error(`Não foi possível copiar ${label.toLowerCase()}`);
  }
}

function CodeBlock({ id, label, code }: { id: string; label: string; code: string }) {
  return (
    <div className="flex flex-col gap-2">
      <pre
        id={id}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed"
      >
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit max-lg:h-11"
        onClick={() => void copyText(code, label)}
      >
        <Copy data-icon="inline-start" />
        Copiar {label.toLowerCase()}
      </Button>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h3 id={id} className="text-base font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function WebhookInboundV2Guide({ webhookUrl, apiCatalogHref }: Props) {
  const url = webhookUrl ?? "https://SEU_DOMINIO/api/webhooks/studio/v2/ID_DO_TIME";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8" data-testid="inbound-v2-guide">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Como integrar</h2>
        <p className="text-sm text-muted-foreground">
          O sistema de vocês envia cada lead como um evento para este webhook. O Corretor Studio responde só que
          recebeu e processa em seguida; o resultado aparece na aba Logs.
        </p>
      </div>

      <Section id="guide-steps" title="Passo a passo">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
          <li>Copie a URL deste webhook e o token (mostrado uma única vez, na criação ou ao gerar um novo).</li>
          <li>Envie um evento de teste sem agendamento e confira o lead no CRM e o evento na aba Logs.</li>
          <li>
            Para leads com reunião, ative a API de horários no{" "}
            <Link href={apiCatalogHref} className="underline underline-offset-4">
              Catálogo de API
            </Link>
            , consulte os horários livres e envie o evento com o horário escolhido.
          </li>
        </ol>
      </Section>

      <Section id="guide-request" title="A requisição">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">POST</Badge>
          <code className="break-all font-mono text-xs">{url}</code>
        </div>
        <ul className="flex flex-col gap-2">
          {REQUEST_HEADERS.map((header) => (
            <li key={header.name} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
              <Badge variant="outline" className="w-fit font-mono text-xs">
                {header.name}
              </Badge>
              <span className="text-sm text-muted-foreground">{header.description}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="guide-create" title="Lead sem agendamento">
        <CodeBlock id="guide-curl-create" label="Exemplo sem agendamento" code={buildCurlCreate(url)} />
      </Section>

      <Section id="guide-schedule" title="Lead com agendamento">
        <p className="text-sm text-muted-foreground">
          Consulte antes os horários livres no{" "}
          <Link href={apiCatalogHref} className="underline underline-offset-4">
            Catálogo de API
          </Link>{" "}
          e use o <code>closer_id</code> como <code>schedule.closer.profile_id</code> e um <code>starts_at</code> da
          lista. {DURATION_NOTE}
        </p>
        <CodeBlock id="guide-curl-schedule" label="Exemplo com agendamento" code={buildCurlSchedule(url)} />
      </Section>

      <Section id="guide-fields" title="Campos do corpo">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BODY_FIELDS.map((field) => (
                <TableRow key={field.name}>
                  <TableCell className="font-mono text-xs">{field.name}</TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">{field.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">Campos fora desta lista são aceitos e ignorados.</p>
      </Section>

      <Section id="guide-outcomes" title="O que acontece com o lead">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Situação</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {OUTCOMES.map((row) => (
                <TableRow key={row.situation}>
                  <TableCell className="whitespace-normal text-sm">{row.situation}</TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">{row.result}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section id="guide-responses" title="Respostas da chamada">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resposta</TableHead>
                <TableHead>Significado</TableHead>
                <TableHead>O que fazer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {HTTP_RESPONSES.map((row) => (
                <TableRow key={row.status}>
                  <TableCell className="font-mono text-xs">{row.status}</TableCell>
                  <TableCell className="whitespace-normal text-sm">{row.meaning}</TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">{row.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">{PROCESSING_NOTE}</p>
      </Section>

      <Section id="guide-security" title="Cuidados">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
          {SECURITY_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
