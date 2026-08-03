"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type LeadTag = {
  id: string;
  name: string;
  color: string;
};

type LeadTagAssignment = {
  id: string;
  tagId: string;
  tag: LeadTag;
};

const TAG_PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
] as const;

function tagChipStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
    color,
  };
}

interface LeadTagsTabProps {
  leadId: string;
  teamId: string;
  supabaseId: string;
}

export function LeadTagsTab({ leadId, teamId, supabaseId }: LeadTagsTabProps) {
  const [applied, setApplied] = useState<LeadTagAssignment[]>([]);
  const [teamTags, setTeamTags] = useState<LeadTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_PALETTE[4]);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    }),
    [supabaseId, teamId]
  );

  const load = useCallback(async () => {
    const key = `${leadId}:${teamId}`;
    if (inFlightRef.current && requestKeyRef.current === key) return;
    inFlightRef.current = true;
    requestKeyRef.current = key;
    setIsLoading(true);
    try {
      const [appliedRes, teamRes] = await Promise.all([
        fetch(`/api/v1/leads/${leadId}/tags`, { headers }),
        fetch("/api/v1/leads/tags", { headers }),
      ]);
      if (!appliedRes.ok || !teamRes.ok) {
        throw new Error("Falha ao carregar tags");
      }
      const appliedData = (await appliedRes.json()) as LeadTagAssignment[];
      const teamData = (await teamRes.json()) as LeadTag[];
      setApplied(Array.isArray(appliedData) ? appliedData : []);
      setTeamTags(Array.isArray(teamData) ? teamData : []);
    } catch (error) {
      console.error("[LeadTagsTab] Erro ao carregar tags:", error);
      toast.error("Não foi possível carregar as tags");
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [headers, leadId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const appliedIds = useMemo(() => new Set(applied.map((a) => a.tagId)), [applied]);
  const suggestions = useMemo(
    () => teamTags.filter((tag) => !appliedIds.has(tag.id)),
    [teamTags, appliedIds]
  );

  const applyTag = async (tagId: string) => {
    if (pendingTagId) return;
    setPendingTagId(tagId);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/tags`, {
        method: "POST",
        headers,
        body: JSON.stringify({ tagId }),
      });
      if (!res.ok) {
        throw new Error("Falha ao aplicar tag");
      }
      toast.success("Tag aplicada");
      await load();
    } catch (error) {
      console.error("[LeadTagsTab] Erro ao aplicar tag:", error);
      toast.error("Não foi possível aplicar a tag");
    } finally {
      setPendingTagId(null);
    }
  };

  const removeTag = async (tagId: string) => {
    if (pendingTagId) return;
    setPendingTagId(tagId);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/tags/${tagId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        throw new Error("Falha ao remover tag");
      }
      toast.success("Tag removida");
      await load();
    } catch (error) {
      console.error("[LeadTagsTab] Erro ao remover tag:", error);
      toast.error("Não foi possível remover a tag");
    } finally {
      setPendingTagId(null);
    }
  };

  const createAndApply = async () => {
    const name = newTagName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      const createRes = await fetch("/api/v1/leads/tags", {
        method: "POST",
        headers,
        body: JSON.stringify({ name, color: newTagColor }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => null);
        throw new Error(err?.errorMessages?.[0] ?? "Falha ao criar tag");
      }
      const created = (await createRes.json()) as LeadTag;
      const applyRes = await fetch(`/api/v1/leads/${leadId}/tags`, {
        method: "POST",
        headers,
        body: JSON.stringify({ tagId: created.id }),
      });
      if (!applyRes.ok) {
        throw new Error("Tag criada, mas falhou ao aplicar no lead");
      }
      setNewTagName("");
      toast.success("Tag criada e aplicada");
      await load();
    } catch (error) {
      console.error("[LeadTagsTab] Erro ao criar tag:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a tag");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-1">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-1">
      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Tags aplicadas</h4>
        {applied.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tag aplicada</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {applied.map((assignment) => (
              <Badge
                key={assignment.id}
                variant="outline"
                className="gap-1 rounded-md px-2 py-1"
                style={tagChipStyle(assignment.tag.color)}
              >
                {assignment.tag.name}
                <button
                  type="button"
                  className="rounded-sm opacity-70 hover:opacity-100"
                  disabled={pendingTagId === assignment.tagId}
                  onClick={() => void removeTag(assignment.tagId)}
                  aria-label={`Remover tag ${assignment.tag.name}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </section>

      {suggestions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Sugestões</h4>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                disabled={pendingTagId === tag.id}
                onClick={() => void applyTag(tag.id)}
                className="rounded-md border px-2 py-1 text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
                style={tagChipStyle(tag.color)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
        <h4 className="text-sm font-medium">Nova tag</h4>
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="new-tag-name">Nome</FieldLabel>
            <Input
              id="new-tag-name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Ex.: Quente"
              maxLength={40}
            />
          </Field>
          <Field>
            <FieldLabel>Cor</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TAG_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Selecionar cor ${color}`}
                  onClick={() => setNewTagColor(color)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform",
                    newTagColor === color ? "scale-110 border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                >
                  {newTagColor === color ? <Check className="mx-auto size-3 text-white" /> : null}
                </button>
              ))}
            </div>
          </Field>
        </FieldGroup>
        <Button
          type="button"
          size="sm"
          disabled={!newTagName.trim() || isCreating}
          onClick={() => void createAndApply()}
        >
          {isCreating ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          Adicionar
        </Button>
      </section>
    </div>
  );
}
