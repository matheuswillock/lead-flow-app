"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  UpsertFormEngagementScoreRulePayload,
  UpsertRadarEngagementConfigPayload,
} from "../services/IBackofficeRadarEngagementService";

type WeightDraft = {
  eventType: string;
  weight: number;
  description: string | null;
  isActive: boolean;
};

type FormRuleDraft = UpsertFormEngagementScoreRulePayload & { key: string };

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
    formScoreRules,
    isLoading,
    isSavingWeights,
    isSavingConfig,
    isSavingFormRules,
    error,
    canManage,
    saveWeights,
    saveConfig,
    saveFormScoreRules,
    deleteFormScoreRule,
  } = useBackofficeRadarEngagement();

  const [weightDrafts, setWeightDrafts] = useState<WeightDraft[]>([]);
  const [configDraft, setConfigDraft] =
    useState<UpsertRadarEngagementConfigPayload>(DEFAULT_CONFIG);
  const [formRuleDrafts, setFormRuleDrafts] = useState<FormRuleDraft[]>([]);

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

  useEffect(() => {
    setFormRuleDrafts(
      formScoreRules.map((item) => ({
        key: item.id,
        id: item.id,
        minPercent: item.minPercent,
        maxPercent: item.maxPercent,
        multiplier: item.multiplier,
        label: item.label,
        isActive: item.isActive,
      }))
    );
  }, [formScoreRules]);

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

  const handleSaveFormRules = async () => {
    await saveFormScoreRules(
      formRuleDrafts.map(({ key: _key, ...item }) => ({
        id: item.id,
        minPercent: item.minPercent,
        maxPercent: item.maxPercent,
        multiplier: item.multiplier,
        label: item.label,
        isActive: item.isActive ?? true,
      }))
    );
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
          <h2 className="text-lg font-medium">Score do formulário → temperatura</h2>
          <p className="text-sm text-muted-foreground">
            Mapeia o percentual de qualidade da submissão para o multiplicador do evento
            form.completed.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Mín. %</TableHead>
                <TableHead className="w-28">Máx. %</TableHead>
                <TableHead className="w-28">Multiplicador</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="w-24">Ativo</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {formRuleDrafts.map((item, index) => (
                <TableRow key={item.key}>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.minPercent}
                      disabled={!canManage || isSavingFormRules}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setFormRuleDrafts((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  minPercent: Number.isFinite(next) ? next : row.minPercent,
                                }
                              : row
                          )
                        );
                      }}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.maxPercent}
                      disabled={!canManage || isSavingFormRules}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setFormRuleDrafts((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  maxPercent: Number.isFinite(next) ? next : row.maxPercent,
                                }
                              : row
                          )
                        );
                      }}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={item.multiplier}
                      disabled={!canManage || isSavingFormRules}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setFormRuleDrafts((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  multiplier: Number.isFinite(next) ? next : row.multiplier,
                                }
                              : row
                          )
                        );
                      }}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.label}
                      disabled={!canManage || isSavingFormRules}
                      onChange={(event) => {
                        const label = event.target.value;
                        setFormRuleDrafts((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, label } : row
                          )
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.isActive ?? true}
                      disabled={!canManage || isSavingFormRules}
                      onCheckedChange={(checked) => {
                        setFormRuleDrafts((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, isActive: checked } : row
                          )
                        );
                      }}
                      aria-label={`Ativar regra ${item.label}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={!canManage || isSavingFormRules}
                      onClick={() => {
                        if (item.id) {
                          void deleteFormScoreRule(item.id);
                          return;
                        }
                        setFormRuleDrafts((prev) => prev.filter((_, i) => i !== index));
                      }}
                      aria-label="Remover regra"
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canManage || isSavingFormRules}
            onClick={() =>
              setFormRuleDrafts((prev) => [
                ...prev,
                {
                  key: `new-${crypto.randomUUID()}`,
                  minPercent: 0,
                  maxPercent: 0,
                  multiplier: 1,
                  label: "Nova faixa",
                  isActive: true,
                },
              ])
            }
          >
            <Plus data-icon="inline-start" />
            Adicionar faixa
          </Button>
          <Button
            type="button"
            onClick={() => void handleSaveFormRules()}
            disabled={!canManage || isSavingFormRules || formRuleDrafts.length === 0}
          >
            {isSavingFormRules ? "Salvando..." : "Salvar regras de score"}
          </Button>
        </div>
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
