"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Braces, CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUILTIN_EMAIL_VARIABLES,
  extractTemplateVariableKeys,
} from "@/lib/email/interpolate";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type { TemplateVariable } from "../context/TemplateEditorTypes";

type GlobalVariable = {
  id: string;
  key: string;
  description: string | null;
  defaultValue: string | null;
};

function sanitizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]/g, "");
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

export function VariablesPanel() {
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

  function addVariable() {
    const next: TemplateVariable = { key: "", type: "string", fallbackValue: "" };
    updateDraft({ variables: [next, ...declared] });
  }

  function updateVariable(index: number, patch: Partial<TemplateVariable>) {
    updateDraft({
      variables: declared.map((variable, i) => (i === index ? { ...variable, ...patch } : variable)),
    });
  }

  function removeVariable(index: number) {
    updateDraft({ variables: declared.filter((_, i) => i !== index) });
  }

  function markVariableReviewed(index: number) {
    updateVariable(index, { reviewStatus: "reviewed" });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2">
        <Braces className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Variáveis</h2>
        <Badge variant="outline" className="ml-auto text-muted-foreground">
          {usedKeys.length} {usedKeys.length === 1 ? "usada" : "usadas"}
        </Badge>
      </div>

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

        {declared.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma variável declarada. Declare variáveis específicas deste template com um valor
            padrão usado no preview e no envio de teste.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {declared.map((variable, index) => (
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
    </div>
  );
}
