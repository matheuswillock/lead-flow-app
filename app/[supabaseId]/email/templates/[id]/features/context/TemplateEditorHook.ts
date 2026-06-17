"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import type {
  Template,
  TemplateEditorDraft,
  TemplateEditorState,
} from "./TemplateEditorTypes";
import { createTemplateEditorService } from "../services/TemplateEditorService";

const service = createTemplateEditorService();

const EMPTY_DRAFT: TemplateEditorDraft = {
  name: "",
  subject: "",
  previewText: "",
  html: "",
  mailyJson: null,
  variables: [],
};

interface UseTemplateEditorReturn extends TemplateEditorState {
  activeRole: "manager" | "backoffice" | "operator" | null;
  reloadTemplate: () => Promise<void>;
  saveTemplate: (patch?: Partial<TemplateEditorDraft>) => Promise<Template | null>;
  publishTemplate: (id?: string) => Promise<Template | null>;
  unpublishTemplate: () => Promise<Template | null>;
  submitForApproval: () => Promise<void>;
  approveTemplate: () => Promise<void>;
  rejectTemplate: (reviewNote: string) => Promise<void>;
  updateDraft: (patch: Partial<TemplateEditorDraft>) => void;
  setMailyJson: (json: unknown) => void;
  setHtml: (html: string) => void;
}

function createDraftFromTemplate(template: Template): TemplateEditorDraft {
  return {
    name: template.name,
    subject: template.subject,
    previewText: template.previewText ?? "",
    html: template.html ?? "",
    mailyJson: template.mailyJson ?? null,
    variables: template.variables ?? [],
  };
}

export function useTemplateEditor(
  supabaseId: string,
  templateId: string
): UseTemplateEditorReturn {
  const { activeTeamId, activeRole, isLoading: teamLoading } = useTeamContext();
  const isNewTemplate = templateId === "new";
  const [template, setTemplate] = useState<Template | null>(null);
  const [draft, setDraft] = useState<TemplateEditorDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(!isNewTemplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDraftRef = useRef<TemplateEditorDraft>(EMPTY_DRAFT);

  const isFetchingRef = useRef(false);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current),
    [draft]
  );

  const reloadTemplate = useCallback(async () => {
    if (teamLoading) return;

    if (!activeTeamId) {
      setLoading(false);
      setError("Selecione um time para editar templates.");
      return;
    }

    if (isNewTemplate) {
      setTemplate(null);
      setDraft(EMPTY_DRAFT);
      initialDraftRef.current = EMPTY_DRAFT;
      setLoading(false);
      setError(null);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const nextTemplate = await service.getTemplate(supabaseId, templateId, activeTeamId);
      const nextDraft = createDraftFromTemplate(nextTemplate);
      setTemplate(nextTemplate);
      setDraft(nextDraft);
      initialDraftRef.current = nextDraft;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar template";
      console.error("[useTemplateEditor] Failed to load template", err);
      setError(message);
      toast.error("Erro ao carregar template", { description: message });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [activeTeamId, isNewTemplate, supabaseId, teamLoading, templateId]);

  useEffect(() => {
    void reloadTemplate();
  }, [reloadTemplate]);

  const updateDraft = useCallback((patch: Partial<TemplateEditorDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const setMailyJson = useCallback(
    (json: unknown) => updateDraft({ mailyJson: json }),
    [updateDraft]
  );

  const setHtml = useCallback(
    (html: string) => updateDraft({ html }),
    [updateDraft]
  );

  const saveTemplate = useCallback(async (patch: Partial<TemplateEditorDraft> = {}) => {
    if (saving) return null;
    if (!activeTeamId) {
      toast.error("Selecione um time para salvar templates.");
      return null;
    }
    const draftToSave = { ...draft, ...patch };
    if (!draftToSave.name.trim() || !draftToSave.subject.trim()) {
      toast.error("Informe nome e assunto do template.");
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = isNewTemplate
        ? await service.createTemplate(supabaseId, draftToSave, activeTeamId)
        : await service.updateTemplate(supabaseId, templateId, draftToSave, activeTeamId);
      const savedDraft = createDraftFromTemplate(saved);
      setTemplate(saved);
      setDraft(savedDraft);
      initialDraftRef.current = savedDraft;
      toast.success("Rascunho salvo com sucesso");
      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar template";
      console.error("[useTemplateEditor] Failed to save template", err);
      setError(message);
      toast.error("Erro ao salvar template", { description: message });
      return null;
    } finally {
      setSaving(false);
    }
  }, [activeTeamId, draft, isNewTemplate, saving, supabaseId, templateId]);

  const publishTemplate = useCallback(async (id?: string) => {
    if (!activeTeamId) {
      toast.error("Selecione um time para publicar templates.");
      return null;
    }
    const targetId = id ?? template?.id;
    if (!targetId) {
      toast.error("Salve o template antes de publicar.");
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const published = await service.publishTemplate(supabaseId, targetId, activeTeamId);
      const publishedDraft = createDraftFromTemplate(published);
      setTemplate(published);
      setDraft(publishedDraft);
      initialDraftRef.current = publishedDraft;
      toast.success("Template publicado com sucesso");
      return published;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao publicar template";
      console.error("[useTemplateEditor] Failed to publish template", err);
      setError(message);
      toast.error("Erro ao publicar template", { description: message });
      return null;
    } finally {
      setSaving(false);
    }
  }, [activeTeamId, supabaseId, template?.id]);

  const unpublishTemplate = useCallback(async () => {
    if (saving) return null;
    if (!activeTeamId || !template?.id) {
      toast.error("Salve o template antes de despublicar.");
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await service.unpublishTemplate(supabaseId, template.id, activeTeamId);
      const updatedDraft = createDraftFromTemplate(updated);
      setTemplate(updated);
      setDraft(updatedDraft);
      initialDraftRef.current = updatedDraft;
      toast.success("Template movido para rascunho");
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao despublicar template";
      console.error("[useTemplateEditor] Failed to unpublish template", err);
      setError(message);
      toast.error("Erro ao despublicar template", { description: message });
      return null;
    } finally {
      setSaving(false);
    }
  }, [activeTeamId, saving, supabaseId, template?.id]);

  const submitForApproval = useCallback(async () => {
    if (saving || !activeTeamId || !template?.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await service.submitForApproval(supabaseId, template.id, activeTeamId);
      const updatedDraft = createDraftFromTemplate(updated);
      setTemplate(updated);
      setDraft(updatedDraft);
      initialDraftRef.current = updatedDraft;
      toast.success("Template enviado para aprovação");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar para aprovação";
      console.error("[useTemplateEditor] Failed to submit for approval", err);
      setError(message);
      toast.error("Erro ao enviar para aprovação", { description: message });
    } finally {
      setSaving(false);
    }
  }, [activeTeamId, saving, supabaseId, template?.id]);

  const approveTemplate = useCallback(async () => {
    if (saving || !activeTeamId || !template?.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await service.approveTemplate(supabaseId, template.id, activeTeamId);
      const updatedDraft = createDraftFromTemplate(updated);
      setTemplate(updated);
      setDraft(updatedDraft);
      initialDraftRef.current = updatedDraft;
      toast.success("Template aprovado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao aprovar template";
      console.error("[useTemplateEditor] Failed to approve template", err);
      setError(message);
      toast.error("Erro ao aprovar template", { description: message });
    } finally {
      setSaving(false);
    }
  }, [activeTeamId, saving, supabaseId, template?.id]);

  const rejectTemplate = useCallback(async (reviewNote: string) => {
    if (saving || !activeTeamId || !template?.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await service.rejectTemplate(supabaseId, template.id, reviewNote, activeTeamId);
      const updatedDraft = createDraftFromTemplate(updated);
      setTemplate(updated);
      setDraft(updatedDraft);
      initialDraftRef.current = updatedDraft;
      toast.success("Template recusado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao recusar template";
      console.error("[useTemplateEditor] Failed to reject template", err);
      setError(message);
      toast.error("Erro ao recusar template", { description: message });
    } finally {
      setSaving(false);
    }
  }, [activeTeamId, saving, supabaseId, template?.id]);

  return {
    template,
    draft,
    loading,
    saving,
    error,
    isDirty,
    isNewTemplate,
    activeRole,
    reloadTemplate,
    saveTemplate,
    publishTemplate,
    unpublishTemplate,
    submitForApproval,
    approveTemplate,
    rejectTemplate,
    updateDraft,
    setMailyJson,
    setHtml,
  };
}
