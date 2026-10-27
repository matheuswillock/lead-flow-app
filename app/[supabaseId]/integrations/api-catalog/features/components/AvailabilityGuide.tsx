"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AVAILABILITY_PATH = "/api/studio/v1/availability";

const RESPONSE_EXAMPLE = JSON.stringify(
  {
    date: "2026-11-03",
    timezone: "America/Sao_Paulo",
    slot_minutes: 30,
    closers: [
      {
        closer_id: "uuid-do-closer",
        name: "Ana Lima",
        slots: [
          { starts_at: "2026-11-03T09:00:00-03:00", ends_at: "2026-11-03T09:30:00-03:00" },
          { starts_at: "2026-11-03T14:00:00-03:00", ends_at: "2026-11-03T14:30:00-03:00" },
        ],
      },
    ],
    generated_at: "2026-11-02T18:02:11-03:00",
  },
  null,
  2,
);

const RESPONSES: Array<{ status: string; meaning: string }> = [
  { status: "200", meaning: "Consulta feita." },
  { status: "400", meaning: "invalid_date (formato errado) ou date_out_of_range (data no passado ou a mais de 180 dias)." },
  { status: "401", meaning: "Token ausente ou inválido." },
  { status: "403", meaning: "resource_inactive: o recurso está desativado para o time." },
  { status: "429", meaning: "rate_limited: 30 consultas por minuto por token. Espere o tempo do header Retry-After." },
];

type Props = { webhooksHref: string };

/** Guia de uso do recurso "Horários disponíveis" (SPEC 14), exibido ao time logado no Catálogo de API. */
export function AvailabilityGuide({ webhooksHref }: Props) {
  return (
    <section className="flex flex-col gap-5 rounded-lg border p-5" aria-labelledby="availability-docs">
      <h2 id="availability-docs" className="text-lg font-semibold">
        Como usar
      </h2>

      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
        <li>Ative o recurso e guarde o token em um cofre. Ele só aparece uma vez.</li>
        <li>
          Consulte o dia desejado: <code>GET {AVAILABILITY_PATH}?date=AAAA-MM-DD</code> com o header{" "}
          <code>Authorization: Bearer &lt;token&gt;</code>.
        </li>
        <li>
          Escolha um <code>closer_id</code> e um <code>starts_at</code> da resposta e envie o lead pelo{" "}
          <Link href={webhooksHref} className="underline underline-offset-4">
            webhook v2
          </Link>{" "}
          em <code>schedule.closer.profile_id</code> e <code>schedule.starts_at</code>.
        </li>
      </ol>

      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
        <li>A data vai de hoje até 180 dias à frente. Para hoje, só aparecem horários a partir de 5 minutos depois da consulta.</li>
        <li>Os horários cobrem as 24 horas do dia, no fuso do time. Cada horário dura o tempo de reunião configurado no time (padrão de 30 minutos). Se o seu sistema atende só em horário comercial, filtre os horários por lá.</li>
        <li>A agenda do closer é uma só, mesmo que ele participe de mais de um time: reuniões em qualquer time ocupam o horário.</li>
        <li>Um closer sem horário livre aparece com <code>slots: []</code>.</li>
        <li>Um horário livre na consulta pode ser ocupado antes do envio. Nesse caso o lead entra como nova oportunidade, com o selo &quot;Remarcar urgente&quot; no CRM.</li>
        <li>Chamada de servidor para servidor, sempre por HTTPS. O token nunca vai na URL nem no navegador.</li>
      </ul>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Exemplo de resposta</h3>
        <pre
          role="region"
          aria-label="Exemplo de resposta"
          tabIndex={0}
          className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed"
        >
          <code>{RESPONSE_EXAMPLE}</code>
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Respostas</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resposta</TableHead>
                <TableHead>Significado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RESPONSES.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">{row.meaning}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
