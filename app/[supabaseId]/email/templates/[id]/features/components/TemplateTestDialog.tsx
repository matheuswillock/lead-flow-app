"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  BUILTIN_EMAIL_VARIABLES,
  extractTemplateVariableKeys,
} from "@/lib/email/interpolate";
import { cn } from "@/lib/utils";
import type {
  TemplateFunctionOperator,
  TemplateTestRequest,
  TemplateTestVariableValue,
  TemplateVariable,
} from "../context/TemplateEditorTypes";

type TestVariableDefinition = TemplateVariable & {
  source: "declared" | "discovered";
};

interface TemplateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabaseId: string;
  templateId: string;
  subject: string;
  html: string;
  variables: TemplateVariable[];
  sending: boolean;
  onSend: (input: TemplateTestRequest) => Promise<void>;
}

type TestDraftCache = {
  to: string;
  values: Record<string, string>;
};

function getFunctionTypeLabel(operator: TemplateFunctionOperator) {
  switch (operator) {
    case "current_year":
      return "Ano atual";
    case "current_month":
      return "Mês atual";
    case "current_day":
      return "Dia atual";
    case "current_date":
      return "Data atual";
    case "current_time":
      return "Horário atual";
    case "current_date_time":
      return "Data e horário";
    case "sum":
      return "Soma";
    case "subtract":
      return "Subtração";
    case "multiply":
      return "Multiplicação";
    case "divide":
      return "Divisão";
    case "concat":
      return "Concatenação";
    default:
      return operator;
  }
}

const BUILTIN_KEYS = new Set(BUILTIN_EMAIL_VARIABLES.map((variable) => variable.key.toLowerCase()));

function makeStorageKey(supabaseId: string, templateId: string) {
  return `email-template-test:${supabaseId}:${templateId}`;
}

function readCache(storageKey: string): TestDraftCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TestDraftCache>;
    return {
      to: typeof parsed.to === "string" ? parsed.to : "",
      values: parsed.values && typeof parsed.values === "object" ? (parsed.values as Record<string, string>) : {},
    };
  } catch {
    return null;
  }
}

function writeCache(storageKey: string, cache: TestDraftCache) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(cache));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function TemplateTestDialog({
  open,
  onOpenChange,
  supabaseId,
  templateId,
  subject,
  html,
  variables,
  sending,
  onSend,
}: TemplateTestDialogProps) {
  const storageKey = useMemo(() => makeStorageKey(supabaseId, templateId), [supabaseId, templateId]);
  const discoveredVariables = useMemo(() => {
    const keys = extractTemplateVariableKeys(`${subject}\n${html}`);
    return keys.filter((key) => !BUILTIN_KEYS.has(key.toLowerCase()));
  }, [html, subject]);

  const variableDefinitions = useMemo<TestVariableDefinition[]>(() => {
    const result: TestVariableDefinition[] = [];
    const seen = new Set<string>();

    for (const variable of variables) {
      if (!variable.key?.trim()) continue;
      if (BUILTIN_KEYS.has(variable.key.toLowerCase())) continue;
      const normalizedKey = variable.key.toLowerCase();
      if (seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);
      result.push({ ...variable, source: "declared" });
    }

    for (const key of discoveredVariables) {
      const normalizedKey = key.toLowerCase();
      if (seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);
      result.push({
        key,
        type: "string",
        fallbackValue: "",
        reviewStatus: "pending",
        source: "discovered",
      });
    }

    return result;
  }, [discoveredVariables, variables]);

  const inputVariables = useMemo(
    () => variableDefinitions.filter((variable) => variable.kind !== "function"),
    [variableDefinitions]
  );
  const functionVariables = useMemo(
    () => variableDefinitions.filter((variable) => variable.kind === "function"),
    [variableDefinitions]
  );

  const [email, setEmail] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const cache = readCache(storageKey);
    const nextValues = variableDefinitions.reduce<Record<string, string>>((acc, variable) => {
      const cachedValue = cache?.values?.[variable.key];
      acc[variable.key] =
        typeof cachedValue === "string"
          ? cachedValue
          : variable.fallbackValue?.trim() || "";
      return acc;
    }, {});

    setEmail(cache?.to ?? "");
    setValues(nextValues);
    setFormError(null);
  }, [open, storageKey, variableDefinitions]);

  useEffect(() => {
    if (!open) return;
    writeCache(storageKey, { to: email, values });
  }, [email, open, storageKey, values]);

  const missingVariables = useMemo(() => {
    return inputVariables.filter((variable) => {
      const value = values[variable.key] ?? "";
      return !value.trim() && !variable.fallbackValue?.trim();
    });
  }, [inputVariables, values]);

  const canSend = isValidEmail(email) && missingVariables.length === 0 && html.trim().length > 0 && !sending;

  const handleValueChange = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFormError("Informe um e-mail de teste válido.");
      return;
    }
    if (missingVariables.length > 0) {
      setFormError("Preencha as variáveis pendentes antes de enviar.");
      return;
    }

    const payloadVariables: TemplateTestVariableValue[] = variableDefinitions.map((variable) => ({
      key: variable.key,
      kind: variable.kind ?? "variable",
      type: variable.type ?? "string",
      fallbackValue: variable.fallbackValue ?? "",
      reviewStatus: variable.reviewStatus ?? "reviewed",
      definition: variable.definition
        ? {
            operator: variable.definition.operator,
            arguments: variable.definition.arguments ?? [],
            separator: variable.definition.separator ?? null,
            timezone: variable.definition.timezone ?? null,
          }
        : null,
      value: values[variable.key] ?? "",
    }));

    setFormError(null);
    try {
      await onSend({
        to: normalizedEmail,
        subject,
        html,
        variables: payloadVariables,
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar e-mail de teste.";
      setFormError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-4xl flex flex-col">
          <DialogHeader>
          <DialogTitle>Testar envio</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Envie um único e-mail de teste com o conteúdo atual do rascunho. Os dados digitados ficam salvos neste navegador.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertCircle />
              <AlertTitle>Teste real sem cobrança</AlertTitle>
              <AlertDescription>
                O teste usa o conteúdo atual do editor, gera exatamente um disparo real e não desconta crédito no modo beta.
              </AlertDescription>
            </Alert>

            {missingVariables.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Variáveis pendentes</AlertTitle>
                <AlertDescription>
                  {missingVariables.map((variable) => `{{${variable.key}}}`).join(", ")}
                </AlertDescription>
              </Alert>
            ) : null}

            {formError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Não foi possível enviar</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <FieldGroup className="gap-5">
              <Field>
                <FieldContent>
                  <FieldTitle>E-mail de teste</FieldTitle>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teste@dominio.com"
                  />
                  <FieldDescription>Esse endereço vai receber o disparo de teste.</FieldDescription>
                  <FieldError />
                </FieldContent>
              </Field>

              {inputVariables.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">Variáveis do template</h3>
                      <p className="text-xs text-muted-foreground">
                        Preencha os valores usados na interpolação do e-mail de teste.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground">
                      {variableDefinitions.length}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-4">
                    {inputVariables.map((variable) => {
                      const fieldId = `template-test-variable-${variable.key}`;
                      const currentValue = values[variable.key] ?? "";
                      const showPendingBadge =
                        variable.source === "discovered" || variable.reviewStatus === "pending";

                      return (
                        <Field key={variable.key}>
                          <FieldContent>
                            <div className="flex items-center gap-2">
                              <FieldTitle className="m-0 w-auto">{`{{${variable.key}}}`}</FieldTitle>
                              {showPendingBadge ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "border-warning/30 bg-warning/10 text-warning",
                                    variable.source === "discovered" ? "uppercase" : ""
                                  )}
                                >
                                  {variable.source === "discovered" ? "Nova" : "Revisão pendente"}
                                </Badge>
                              ) : null}
                              {variable.type === "number" ? (
                                <Badge variant="secondary">Número</Badge>
                              ) : null}
                            </div>
                            <Input
                              id={fieldId}
                              value={currentValue}
                              onChange={(event) => handleValueChange(variable.key, event.target.value)}
                              placeholder={variable.fallbackValue || `Valor para ${variable.key}`}
                              inputMode={variable.type === "number" ? "numeric" : "text"}
                            />
                            <FieldDescription>
                              {variable.fallbackValue?.trim()
                                ? `Valor padrão atual: ${variable.fallbackValue}`
                                : "Sem valor padrão salvo."}
                            </FieldDescription>
                            <FieldError />
                          </FieldContent>
                        </Field>
                      );
                    })}
                  </div>
                </div>
              ) : functionVariables.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Nenhuma variável detectada no template atual.
                </div>
              ) : null}

              {functionVariables.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">Funções do template</h3>
                      <p className="text-xs text-muted-foreground">
                        As funções são resolvidas no backend e reaproveitam os valores do rascunho atual.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground">
                      {functionVariables.length}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    {functionVariables.map((variable) => {
                      const definition = variable.definition
                      const operatorLabel = definition ? getFunctionTypeLabel(definition.operator) : "Função"

                      return (
                        <div key={variable.key} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <FieldTitle className="m-0 w-auto">{`{{${variable.key}}}`}</FieldTitle>
                            <Badge variant="outline" className="text-muted-foreground">
                              {operatorLabel}
                            </Badge>
                            {variable.reviewStatus === "pending" ? (
                              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                                Revisão pendente
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {definition?.arguments?.length
                              ? `Argumentos: ${definition.arguments.join(", ")}`
                              : "Sem argumentos informados."}
                          </p>
                          {definition?.separator ? (
                            <p className="text-xs text-muted-foreground">Separador: {definition.separator}</p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </FieldGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSend()} disabled={!canSend}>
            {sending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
            {sending ? "Enviando..." : "Enviar teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
