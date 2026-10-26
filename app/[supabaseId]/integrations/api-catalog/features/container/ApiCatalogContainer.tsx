"use client";

import Link from "next/link";
import { ArrowLeft, Copy, KeyRound, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates";
import { useApiCatalogContext } from "../context/ApiCatalogContext";

const AVAILABILITY_PATH = "/api/studio/v1/availability";

function buildExample(origin: string, token: string): string {
  return [
    `curl -G "${origin}${AVAILABILITY_PATH}" \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  --data-urlencode "date=AAAA-MM-DD"`,
  ].join("\n");
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  } catch {
    toast.error(`Não foi possível copiar ${label.toLowerCase()}`);
  }
}

export function ApiCatalogContainer() {
  const { supabaseId, loading, error, activation, revealedToken, pending, activate, toggleStatus, dismissToken, reload } =
    useApiCatalogContext();
  const { tz } = useTimezone();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const isActive = activation?.status === "active";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0 max-lg:h-11">
          <Link href={`/${supabaseId}/integrations`}>
            <ArrowLeft data-icon="inline-start" />
            Integrações
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Catálogo de API</h1>
        <p className="text-sm text-muted-foreground">
          Recursos da API do Studio para sistemas de vocês chamarem de servidor para servidor. Cada recurso tem o
          próprio token.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border p-5" aria-labelledby="availability-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="availability-title" className="text-lg font-semibold">
              Horários disponíveis
            </h2>
            <p className="text-sm text-muted-foreground">
              Consulta, por dia, os horários livres de cada closer do time. Use antes de enviar um lead com reunião
              pelo webhook v2.
            </p>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-20" />
          ) : activation ? (
            <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Ativo" : "Inativo"}</Badge>
          ) : (
            <Badge variant="outline">Não ativado</Badge>
          )}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar o recurso</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" className="w-fit max-lg:h-11" onClick={() => void reload()}>
                <RefreshCcw data-icon="inline-start" />
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {revealedToken ? (
          <div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="availability-token">Token do recurso</Label>
              <p className="text-sm text-muted-foreground">
                Copie agora e guarde em um cofre. Depois de sair desta tela ele não será exibido de novo. O token
                identifica o time; nunca o coloque na URL nem no navegador.
              </p>
            </div>
            <div className="flex gap-2">
              <Input id="availability-token" readOnly value={revealedToken} className="font-mono text-sm" />
              <Button type="button" variant="outline" className="max-lg:h-11" onClick={() => void copy(revealedToken, "Token")}>
                <Copy data-icon="inline-start" />
                Copiar
              </Button>
            </div>
            <Label htmlFor="availability-example">Exemplo de chamada</Label>
            <pre
              id="availability-example"
              className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed"
            >
              {buildExample(origin, revealedToken)}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-lg:h-11"
                onClick={() => void copy(buildExample(origin, revealedToken), "Exemplo")}
              >
                <Copy data-icon="inline-start" />
                Copiar exemplo
              </Button>
              <Button type="button" size="sm" className="max-lg:h-11" onClick={dismissToken}>
                Já copiei o token
              </Button>
            </div>
          </div>
        ) : null}

        {!loading && activation && !revealedToken ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Token</dt>
              <dd className="font-mono">{activation.tokenPreview}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Último uso</dt>
              <dd>
                {activation.lastUsedAt
                  ? formatIntimezone(new Date(activation.lastUsedAt), "dd/MM/yyyy HH:mm", tz)
                  : "Nunca usado"}
              </dd>
            </div>
          </dl>
        ) : null}

        {!loading && !error ? (
          <div className="flex flex-wrap gap-2">
            {!activation ? (
              <Button type="button" className="max-lg:h-11" disabled={pending} onClick={() => void activate()}>
                <KeyRound data-icon="inline-start" />
                {pending ? "Gerando..." : "Ativar e gerar token"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="max-lg:h-11"
                  disabled={pending}
                  onClick={() => void toggleStatus()}
                >
                  {isActive ? "Desativar" : "Reativar"}
                </Button>
                <Button type="button" variant="outline" className="max-lg:h-11" disabled={pending} onClick={() => void activate()}>
                  <RefreshCcw data-icon="inline-start" />
                  Gerar novo token
                </Button>
              </>
            )}
          </div>
        ) : null}

        {activation ? (
          <p className="text-sm text-muted-foreground">
            Gerar um novo token invalida o anterior na hora: atualize o sistema que usa o recurso antes. Desativar não
            apaga o token; reativar volta a aceitar o mesmo.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-5" aria-labelledby="availability-docs">
        <h2 id="availability-docs" className="text-lg font-semibold">
          Como usar
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
          <li>
            <code>GET {AVAILABILITY_PATH}?date=AAAA-MM-DD</code> com o header <code>Authorization: Bearer &lt;token&gt;</code>.
          </li>
          <li>A data vai de hoje até 180 dias à frente. Os horários vêm com fuso, nas 24 horas do dia, no tamanho da reunião configurado no time.</li>
          <li>Limite de 30 consultas por minuto por token. Acima disso a resposta é 429 com <code>Retry-After</code>.</li>
          <li>
            Use o <code>closer_id</code> e um <code>starts_at</code> da resposta em <code>schedule</code> ao enviar o
            lead pelo webhook v2.
          </li>
        </ul>
      </section>
    </div>
  );
}
