"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { estimateRadarOutboxThroughputPerHour } from "@/lib/email/email-contact-radar-sync-outbox-config";
import { useBackofficeRadarOutboxThroughput } from "../context/BackofficeRadarOutboxThroughputContext";

export function BackofficeRadarOutboxThroughputContainer() {
  const { snapshot, isLoading, isSaving, error, canManage, save } =
    useBackofficeRadarOutboxThroughput();

  const [batchSize, setBatchSize] = useState(250);
  const [concurrency, setConcurrency] = useState(8);

  useEffect(() => {
    if (!snapshot) return;
    setBatchSize(snapshot.effective.batchSize);
    setConcurrency(snapshot.effective.concurrency);
  }, [snapshot]);

  const limits = snapshot?.limits;
  const estimatedThroughput = useMemo(
    () => estimateRadarOutboxThroughputPerHour(batchSize),
    [batchSize]
  );

  const batchInvalid =
    !limits ||
    !Number.isInteger(batchSize) ||
    batchSize < limits.minBatchSize ||
    batchSize > limits.maxBatchSize;
  const concurrencyInvalid =
    !limits ||
    !Number.isInteger(concurrency) ||
    concurrency < limits.minConcurrency ||
    concurrency > limits.maxConcurrency;
  const formInvalid = batchInvalid || concurrencyInvalid;
  const submitDisabled = !canManage || isSaving || formInvalid || !snapshot;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full max-w-xl" />
      </div>
    );
  }

  if (error || !snapshot || !limits) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar</AlertTitle>
        <AlertDescription>{error ?? "Dados de vazão indisponíveis."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              O cron <code className="text-xs">{snapshot.howItWorks.cronPath}</code> roda a cada{" "}
              <strong>5 minutos</strong> ({snapshot.howItWorks.cronRunsPerHour}×/hora), reivindica um
              lote de contatos <em>pending</em> da outbox e sincroniza no Radar.
            </p>
            <p>
              Em cada tick: claim de até <strong>batch</strong> linhas, processadas em paralelo com
              até <strong>concorrência</strong> workers. Fórmula:{" "}
              <code className="text-xs">{snapshot.howItWorks.formula}</code>.
            </p>
            <p>
              Precedência da config:{" "}
              <strong>{snapshot.howItWorks.precedence}</strong>. Orçamento de pool ≈{" "}
              {snapshot.howItWorks.connectionBudgetHint}.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      <Alert>
        <AlertTitle>Como configurar</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Ajuste só dentro dos limites do código — a UI e a API{" "}
              <strong>rejeitam valores fora do intervalo</strong>:
            </p>
            <ul className="list-disc pl-5">
              <li>
                Batch: {limits.minBatchSize}–{limits.maxBatchSize} (default {limits.defaultBatchSize})
              </li>
              <li>
                Concorrência: {limits.minConcurrency}–{limits.maxConcurrency} (default{" "}
                {limits.defaultConcurrency})
              </li>
            </ul>
            <p>
              Subir o batch acelera a drenagem do backlog; subir a concorrência aumenta pressão no
              pool Postgres. Em incidente de P2024, reduza a concorrência primeiro.
            </p>
            <p>
              A mudança vale no <strong>próximo tick</strong> do cron (até ~5 min). Não dispara o
              worker imediatamente.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Vazão efetiva agora</CardTitle>
          <CardDescription>
            Fonte ativa e estimativa teórica com o cron atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={snapshot.effective.source === "backoffice" ? "default" : "secondary"}>
            fonte: {snapshot.effective.source === "backoffice" ? "backoffice" : "env/default"}
          </Badge>
          <Badge variant="outline">batch {snapshot.effective.batchSize}</Badge>
          <Badge variant="outline">concorrência {snapshot.effective.concurrency}</Badge>
          <Badge variant="outline">
            ~{snapshot.effective.theoreticalThroughputPerHour.toLocaleString("pt-BR")}/h
          </Badge>
          {snapshot.effective.updatedAt ? (
            <span className="text-xs text-muted-foreground">
              atualizado em {new Date(snapshot.effective.updatedAt).toLocaleString("pt-BR")}
            </span>
          ) : null}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Ajustar knobs</CardTitle>
          <CardDescription>
            Estimativa com o batch do formulário: ~{estimatedThroughput.toLocaleString("pt-BR")}{" "}
            syncs/hora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (submitDisabled) return;
              void save({ batchSize, concurrency });
            }}
          >
            <FieldGroup>
              <Field data-invalid={batchInvalid || undefined}>
                <FieldLabel htmlFor="outbox-batch-size">Tamanho do lote (batch)</FieldLabel>
                <Input
                  id="outbox-batch-size"
                  type="number"
                  min={limits.minBatchSize}
                  max={limits.maxBatchSize}
                  step={1}
                  value={batchSize}
                  disabled={!canManage || isSaving}
                  onChange={(event) => setBatchSize(Number(event.target.value))}
                />
                <FieldDescription>
                  Mín. {limits.minBatchSize} · máx. {limits.maxBatchSize}. Quantos pending o cron
                  tenta claimar por execução.
                </FieldDescription>
              </Field>

              <Field data-invalid={concurrencyInvalid || undefined}>
                <FieldLabel htmlFor="outbox-concurrency">Concorrência</FieldLabel>
                <Input
                  id="outbox-concurrency"
                  type="number"
                  min={limits.minConcurrency}
                  max={limits.maxConcurrency}
                  step={1}
                  value={concurrency}
                  disabled={!canManage || isSaving}
                  onChange={(event) => setConcurrency(Number(event.target.value))}
                />
                <FieldDescription>
                  Mín. {limits.minConcurrency} · máx. {limits.maxConcurrency}. Syncs Radar em
                  paralelo dentro do lote.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <Separator />

            {!canManage ? (
              <p className="text-sm text-muted-foreground">
                Operators só visualizam. Masters/managers podem salvar.
              </p>
            ) : null}

            <Button type="submit" disabled={submitDisabled}>
              {isSaving ? "Salvando…" : "Salvar vazão"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
