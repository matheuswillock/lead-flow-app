"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Braces, CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUILTIN_EMAIL_VARIABLES,
  BUILTIN_EMAIL_FUNCTIONS,
  BUILTIN_EMAIL_FUNCTION_KEYS,
  extractTemplateVariableKeys,
} from "@/lib/email/interpolate";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type {
  TemplateFunctionDefinition,
  TemplateFunctionOperator,
  TemplateVariable,
} from "../context/TemplateEditorTypes";

type GlobalVariable = {
  id: string;
  key: string;
  description: string | null;
  defaultValue: string | null;
};

function sanitizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]/g, "");
}

function createDefaultFunctionDefinition(operator: TemplateFunctionOperator): TemplateFunctionDefinition {
  return {
    operator,
    arguments: [],
    separator: null,
    timezone: null,
  };
}

function createDefaultFunctionVariable(): TemplateVariable {
  return {
    key: "resultado_funcao",
    kind: "function",
    type: "number",
    fallbackValue: "",
    reviewStatus: "pending",
    definition: createDefaultFunctionDefinition("sum"),
  };
}

function createUniqueFunctionVariable(existingKeys: string[]): TemplateVariable {
  const base = "resultado_funcao";
  const normalizedKeys = new Set(existingKeys.map((key) => key.toLowerCase()));
  let suffix = 1;
  let key = base;

  while (normalizedKeys.has(key.toLowerCase())) {
    suffix += 1;
    key = `${base}_${suffix}`;
  }

  return {
    ...createDefaultFunctionVariable(),
    key,
  };
}

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

async function copyToken(key: string) {
  try {
    await navigator.clipboard.writeText(`{{${key}}}`);
    toast.success(`{{${key}}} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

function VariableChip({ label, hint }: { label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => void copyToken(label)}
      title={hint ? `${hint} — clique para copiar` : "Clique para copiar"}
      className="group inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/5"
    >
      <code className="font-mono text-[11px]">{`{{${label}}}`}</code>
      <Copy className="size-3 text-muted-foreground group-hover:text-primary" />
    </button>
  );
}

interface VariablesPanelProps {
  embedded?: boolean;
}

export function VariablesPanel({ embedded = false }: VariablesPanelProps) {
  const { draft, updateDraft } = useTemplateEditorContext();
  const [globalVariables, setGlobalVariables] = useState<GlobalVariable[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/v1/email/settings/variables", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.isValid) setGlobalVariables(json.result as GlobalVariable[]);
      } catch (err) {
        console.error("[VariablesPanel] failed to load global variables", err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const declared = draft.variables;
  const pendingReviewCount = declared.filter((variable) => variable.reviewStatus === "pending").length;

  const knownKeys = useMemo(() => {
    const set = new Set<string>();
    BUILTIN_EMAIL_VARIABLES.forEach((v) => set.add(v.key.toLowerCase()));
    BUILTIN_EMAIL_FUNCTION_KEYS.forEach((key) => set.add(key));
    globalVariables.forEach((v) => set.add(v.key.toLowerCase()));
    declared.forEach((v) => set.add(v.key.toLowerCase()));
    return set;
  }, [globalVariables, declared]);

  const usedKeys = useMemo(
    () => extractTemplateVariableKeys(`${draft.subject}\n${draft.html}`),
    [draft.subject, draft.html]
  );

  const undeclaredKeys = useMemo(
    () => usedKeys.filter((key) => !knownKeys.has(key.toLowerCase())),
    [usedKeys, knownKeys]
  );

  const declaredEntries = useMemo(
    () => declared.map((variable, index) => ({ variable, index })),
    [declared]
  );
  const variableEntries = declaredEntries.filter(({ variable }) => variable.kind !== "function");
  const functionEntries = declaredEntries.filter(({ variable }) => variable.kind === "function");

  function addVariable() {
    const next: TemplateVariable = { key: "", kind: "variable", type: "string", fallbackValue: "" };
    updateDraft({ variables: [next, ...declared] });
  }

  function addFunction() {
    updateDraft({ variables: [createUniqueFunctionVariable(declared.map((variable) => variable.key)), ...declared] });
  }

  function updateVariable(index: number, patch: Partial<TemplateVariable>) {
    updateDraft({
      variables: declared.map((variable, i) => (i === index ? { ...variable, ...patch } : variable)),
    });
  }

  function updateFunction(index: number, patch: Partial<TemplateVariable>) {
    const entry = functionEntries[index]
    if (!entry) return
    updateVariable(entry.index, patch)
  }

  function removeVariable(index: number) {
    updateDraft({ variables: declared.filter((_, i) => i !== index) });
  }

  function removeFunction(index: number) {
    const entry = functionEntries[index]
    if (!entry) return
    removeVariable(entry.index)
  }

  function markVariableReviewed(index: number) {
    updateVariable(index, { reviewStatus: "reviewed" });
  }

  function markFunctionReviewed(index: number) {
    updateFunction(index, { reviewStatus: "reviewed" });
  }

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-lg border bg-background p-4"}>
      {!embedded ? (
        <div className="flex items-center gap-2">
          <Braces className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Variáveis</h2>
          <Badge variant="outline" className="ml-auto text-muted-foreground">
            {usedKeys.length} {usedKeys.length === 1 ? "usada" : "usadas"}
          </Badge>
        </div>
      ) : null}

      {pendingReviewCount > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 p-3 text-xs text-semantic-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              {pendingReviewCount} variável(is) pendente(s) de revisão.
            </span>
            <span>Revise chave, tipo e valor padrão antes de enviar para aprovação ou publicar.</span>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Use <code className="rounded bg-muted px-1 font-mono text-[11px]">{"{{chave}}"}</code> no
        assunto e no conteúdo. Clique em uma variável para copiar.
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Padrão</p>
        <div className="flex flex-wrap gap-1.5">
          {BUILTIN_EMAIL_VARIABLES.map((v) => (
            <VariableChip key={v.key} label={v.key} hint={v.description} />
          ))}
        </div>
      </div>

      {globalVariables.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Globais do time
          </p>
          <div className="flex flex-wrap gap-1.5">
            {globalVariables.map((v) => (
              <VariableChip key={v.id} label={v.key} hint={v.description ?? undefined} />
            ))}
          </div>
        </div>
      ) : null}

      {undeclaredKeys.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 p-3 text-xs text-semantic-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">Variáveis não declaradas usadas no template:</span>
            <div className="flex flex-wrap gap-1.5">
              {undeclaredKeys.map((key) => (
                <code key={key} className="rounded bg-background px-1 font-mono">{`{{${key}}}`}</code>
              ))}
            </div>
            <span>Crie-as como variáveis globais (Configurações) ou declare um valor padrão abaixo.</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Variáveis do template
          </p>
          <Button type="button" variant="outline" size="sm" onClick={addVariable}>
            <Plus data-icon="inline-start" />
            Adicionar
          </Button>
        </div>

        {variableEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma variável declarada. Declare variáveis específicas deste template com um valor
            padrão usado no preview e no envio de teste.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {variableEntries.map(({ variable, index }) => (
              <div key={index} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={variable.key}
                    onChange={(event) => updateVariable(index, { key: sanitizeKey(event.target.value) })}
                    placeholder="NOME_DA_VARIAVEL"
                    className="min-w-40 flex-1 font-mono text-xs"
                  />
                  <Select
                    value={variable.type}
                    onValueChange={(value) => updateVariable(index, { type: value as "string" | "number" })}
                  >
                    <SelectTrigger className="w-28 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">Texto</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => removeVariable(index)}
                    aria-label="Remover variável"
                  >
                    <Trash2 />
                  </Button>
                  {variable.reviewStatus === "pending" ? (
                    <Badge variant="outline" className="border-semantic-warning/30 text-semantic-warning">
                      Revisão pendente
                    </Badge>
                  ) : null}
                </div>
                <Input
                  value={variable.fallbackValue ?? ""}
                  onChange={(event) => updateVariable(index, { fallbackValue: event.target.value })}
                  placeholder="Valor padrão (usado no preview e no teste)"
                  className="text-xs"
                />
                {variable.reviewStatus === "pending" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => markVariableReviewed(index)}
                  >
                    <CheckCircle2 data-icon="inline-start" />
                    Marcar como revisada
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Funções predefinidas
        </p>
        <p className="text-xs text-muted-foreground">
          Estas funções resolvem data e hora automaticamente no backend. Use os tokens abaixo no HTML.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BUILTIN_EMAIL_FUNCTIONS.map((fn) => (
            <VariableChip key={fn.key} label={fn.key} hint={fn.description} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Funções do template
            </p>
            <p className="text-xs text-muted-foreground">
              Monte funções com base em variáveis, como somas, subtrações, concatenação e outros cálculos.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addFunction}>
            <Plus data-icon="inline-start" />
            Adicionar função
          </Button>
        </div>

        {functionEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma função customizada declarada. Adicione uma função quando precisar combinar variáveis.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {functionEntries.map(({ variable, index }) => {
              const definition = variable.definition ?? createDefaultFunctionDefinition("sum")
              const operator = definition.operator
              const isConcat = operator === "concat"

              return (
                <div key={index} className="flex flex-col gap-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={variable.key}
                      onChange={(event) => updateFunction(index, { key: sanitizeKey(event.target.value) })}
                      placeholder="resultado_funcao"
                      className="min-w-40 flex-1 font-mono text-xs"
                    />
                    <Select
                      value={operator}
                      onValueChange={(value) =>
                        updateFunction(index, {
                          kind: "function",
                          type: value === "concat" ? "string" : value.startsWith("current_") ? "string" : "number",
                          definition: {
                            ...definition,
                            operator: value as TemplateFunctionOperator,
                            separator: value === "concat" ? definition.separator ?? "" : null,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="w-44 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">Soma</SelectItem>
                        <SelectItem value="subtract">Subtração</SelectItem>
                        <SelectItem value="multiply">Multiplicação</SelectItem>
                        <SelectItem value="divide">Divisão</SelectItem>
                        <SelectItem value="concat">Concatenação</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={variable.type}
                      onValueChange={(value) => updateFunction(index, { type: value as "string" | "number" })}
                    >
                      <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">Texto</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => removeFunction(index)}
                      aria-label="Remover função"
                    >
                      <Trash2 />
                    </Button>
                    {variable.reviewStatus === "pending" ? (
                      <Badge variant="outline" className="border-semantic-warning/30 text-semantic-warning">
                        Revisão pendente
                      </Badge>
                    ) : null}
                  </div>

                  <FieldGroup className="gap-3">
                    <Field>
                      <FieldContent>
                        <FieldTitle>Argumentos</FieldTitle>
                        <Input
                          value={(definition.arguments ?? []).join(", ")}
                          onChange={(event) =>
                            updateFunction(index, {
                              definition: {
                                ...definition,
                                arguments: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                                separator: isConcat ? definition.separator ?? "" : definition.separator ?? null,
                              },
                            })
                          }
                          placeholder="valor1, valor2, valor3"
                        />
                        <FieldDescription>
                          Use nomes de variáveis, tokens ou valores literais separados por vírgula.
                        </FieldDescription>
                        <FieldError />
                      </FieldContent>
                    </Field>

                    {isConcat ? (
                      <Field>
                        <FieldContent>
                          <FieldTitle>Separador</FieldTitle>
                          <Input
                            value={definition.separator ?? ""}
                            onChange={(event) =>
                              updateFunction(index, {
                                definition: {
                                  ...definition,
                                  separator: event.target.value,
                                },
                              })
                            }
                            placeholder="Ex.: espaço, hífen ou /"
                          />
                          <FieldDescription>
                            Opcional. Deixe vazio para concatenar os valores diretamente.
                          </FieldDescription>
                          <FieldError />
                        </FieldContent>
                      </Field>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {getFunctionTypeLabel(operator)} será resolvida no backend com base nos argumentos informados.
                      </p>
                    )}
                  </FieldGroup>

                  {variable.reviewStatus === "pending" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => markFunctionReviewed(index)}
                    >
                      <CheckCircle2 data-icon="inline-start" />
                      Marcar como revisada
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
}
