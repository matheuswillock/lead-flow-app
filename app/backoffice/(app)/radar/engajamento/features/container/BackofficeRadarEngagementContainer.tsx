"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useBackofficeRadarEngagement } from "../context/BackofficeRadarEngagementContext";
import type {
  RadarEngagementConfigItem,
  UpsertRadarEngagementConfigPayload,
} from "../services/IBackofficeRadarEngagementService";

type WeightDraft = {
  eventType: string;
  weight: number;
  description: string | null;
  isActive: boolean;
};

const DEFAULT_CONFIG: UpsertRadarEngagementConfigPayload = {
  windowRecentDays: 7,
  windowMidDays: 30,
  windowOldDays: 90,
  recentMultiplier: 2,
  oldMultiplier: 0.2,
  hotThreshold: 60,
  warmThreshold: 30,
  lukewarmThreshold: 10,
};

function configToDraft(config: RadarEngagementConfigItem | null): UpsertRadarEngagementConfigPayload {
  if (!config) return { ...DEFAULT_CONFIG };
  return {
    windowRecentDays: config.windowRecentDays,
    windowMidDays: config.windowMidDays,
    windowOldDays: config.windowOldDays,
    recentMultiplier: config.recentMultiplier,
    oldMultiplier: config.oldMultiplier,
    hotThreshold: config.hotThreshold,
    warmThreshold: config.warmThreshold,
    lukewarmThreshold: config.lukewarmThreshold,
  };
}

export function BackofficeRadarEngagementContainer() {
  const {
    weights,
    config,
    isLoading,
    isSavingWeights,
    isSavingConfig,
    error,
    canManage,
    saveWeights,
    saveConfig,
  } = useBackofficeRadarEngagement();

  const [weightDrafts, setWeightDrafts] = useState<WeightDraft[]>([]);
  const [configDraft, setConfigDraft] =
    useState<UpsertRadarEngagementConfigPayload>(DEFAULT_CONFIG);

  useEffect(() => {
    setWeightDrafts(
      weights.map((item) => ({
        eventType: item.eventType,
        weight: item.weight,
        description: item.description,
        isActive: item.isActive,
      }))
    );
  }, [weights]);

  useEffect(() => {
    setConfigDraft(configToDraft(config));
  }, [config]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  const handleSaveWeights = async () => {
    await saveWeights(
      weightDrafts.map((item) => ({
        eventType: item.eventType,
        weight: item.weight,
        description: item.description,
        isActive: item.isActive,
      }))
    );
  };

  const handleSaveConfig = async () => {
    await saveConfig(configDraft);
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Pesos por tipo de evento</h2>
          <p className="text-sm text-muted-foreground">
            Ajuste o peso e o status ativo de cada evento usado no score de engajamento.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de evento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-28">Peso</TableHead>
                <TableHead className="w-28">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weightDrafts.map((item, index) => (
                <TableRow key={item.eventType}>
                  <TableCell className="font-mono text-sm">{item.eventType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step={1}
                      value={item.weight}
                      disabled={!canManage || isSavingWeights}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setWeightDrafts((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, weight: Number.isFinite(next) ? next : row.weight }
                              : row
                          )
                        );
                      }}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.isActive}
                      disabled={!canManage || isSavingWeights}
                      onCheckedChange={(checked) => {
                        setWeightDrafts((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, isActive: checked } : row
                          )
                        );
                      }}
                      aria-label={`Ativar ${item.eventType}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button
          type="button"
          onClick={() => void handleSaveWeights()}
          disabled={!canManage || isSavingWeights || weightDrafts.length === 0}
        >
          {isSavingWeights ? "Salvando..." : "Salvar pesos"}
        </Button>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Configuração de janelas e limiares</h2>
          <p className="text-sm text-muted-foreground">
            Defina decaimento temporal e faixas de banda (quente, morno, morno-frio).
          </p>
        </div>

        <FieldGroup className="max-w-2xl grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>Janela recente (dias)</FieldLabel>
            <Input
              type="number"
              min={1}
              value={configDraft.windowRecentDays}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  windowRecentDays: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Janela intermediária (dias)</FieldLabel>
            <Input
              type="number"
              min={1}
              value={configDraft.windowMidDays}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  windowMidDays: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Janela antiga (dias)</FieldLabel>
            <Input
              type="number"
              min={1}
              value={configDraft.windowOldDays}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  windowOldDays: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Multiplicador recente</FieldLabel>
            <Input
              type="number"
              step="0.1"
              min={0}
              value={configDraft.recentMultiplier}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  recentMultiplier: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Multiplicador antigo</FieldLabel>
            <Input
              type="number"
              step="0.1"
              min={0}
              value={configDraft.oldMultiplier}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  oldMultiplier: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Limiar quente</FieldLabel>
            <Input
              type="number"
              value={configDraft.hotThreshold}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  hotThreshold: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Limiar morno</FieldLabel>
            <Input
              type="number"
              value={configDraft.warmThreshold}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  warmThreshold: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Limiar morno-frio</FieldLabel>
            <Input
              type="number"
              value={configDraft.lukewarmThreshold}
              disabled={!canManage || isSavingConfig}
              onChange={(event) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  lukewarmThreshold: Number(event.target.value),
                }))
              }
            />
          </Field>
        </FieldGroup>

        <Button
          type="button"
          onClick={() => void handleSaveConfig()}
          disabled={!canManage || isSavingConfig}
        >
          {isSavingConfig ? "Salvando..." : "Salvar configuração"}
        </Button>
      </section>
    </div>
  );
}
