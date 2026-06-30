"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import type {
  Template,
  TemplateEditorDraft,
  TemplateEditorMode,
  TemplateEditorState,
  TemplateTestRequest,
  TemplateVariable,
} from "./TemplateEditorTypes";
import { createTemplateEditorService } from "../services/TemplateEditorService";

const service = createTemplateEditorService();

const EMPTY_DRAFT: TemplateEditorDraft = {
  name: "",
  subject: "",
  previewText: "",
  html: "",
  mailyJson: null,
  editorMode: "html",
  variables: [],
};

function resolveEditorMode(_template: Template): TemplateEditorMode {
  return "html";
}

interface UseTemplateEditorReturn extends TemplateEditorState {
  activeRole: "manager" | "backoffice" | "operator" | null;
  reloadTemplate: () => Promise<void>;
  saveTemplate: (patch?: Partial<TemplateEditorDraft>) => Promise<Template | null>;
  publishTemplate: (id?: string) => Promise<Template | null>;
  unpublishTemplate: () => Promise<Template | null>;
  submitForApproval: () => Promise<void>;
  approveTemplate: () => Promise<void>;
  rejectTemplate: (reviewNote: string) => Promise<void>;
  sendTestTemplate: (input: TemplateTestRequest) => Promise<void>;
  updateDraft: (patch: Partial<TemplateEditorDraft>) => void;
  setHtml: (html: string) => void;
}

function createDraftFromTemplate(template: Template): TemplateEditorDraft {
  return {
    name: template.name,
    subject: template.subject,
    previewText: template.previewText ?? "",
    html: template.html ?? "",
    mailyJson: template.mailyJson ?? null,
    editorMode: resolveEditorMode(template),
    variables: template.variables ?? [],
  };
}

function hasPendingVariableReview(variables: TemplateVariable[]) {
  return variables.some((variable) => variable.reviewStatus === "pending");
}

export function useTemplateEditor(
  supabaseId: string,
  templateId: string
): UseTemplateEditorReturn {
  const router = useRouter();
  const { activeTeamId, activeRole, isLoading: teamLoading } = useTeamContext();
  const isNewTemplate = templateId === "new";
  const [template, setTemplate] = useState<Template | null>(null);
  const [draft, setDraft] = useState<TemplateEditorDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(!isNewTemplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateApprovalRequired, setTemplateApprovalRequired] = useState(false);
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

    const loadApprovalSettings = async () => {
      const settings = await service.getApprovalSettings(supabaseId, activeTeamId);
      setTemplateApprovalRequired(settings.templateApprovalRequired);
    };

    if (isNewTemplate) {
      await loadApprovalSettings().catch((err) => {
        console.error("[useTemplateEditor] Failed to load approval settings", err);
        setTemplateApprovalRequired(false);
      });
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
      const [nextTemplate] = await Promise.all([
        service.getTemplate(supabaseId, templateId, activeTeamId),
        loadApprovalSettings(),
      ]);
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
      if (saved.id !== templateId) {
        router.replace(`/${supabaseId}/email/templates/${saved.id}`);
      }
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
  }, [activeTeamId, draft, isNewTemplate, router, saving, supabaseId, templateId]);

  const publishTemplate = useCallback(async (id?: string) => {
    if (hasPendingVariableReview(draft.variables)) {
      toast.error("Revise as variáveis pendentes antes de publicar.");
      return null;
    }
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
  }, [activeTeamId, draft.variables, supabaseId, template?.id]);

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
    if (hasPendingVariableReview(draft.variables)) {
      toast.error("Revise as variáveis pendentes antes de enviar para aprovação.");
      return;
    }
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
  }, [activeTeamId, draft.variables, saving, supabaseId, template?.id]);

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

  const sendTestTemplate = useCallback(async (input: TemplateTestRequest) => {
    if (saving) return;
    if (!activeTeamId) {
      toast.error("Selecione um time para enviar o teste.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await service.sendTest(supabaseId, templateId, activeTeamId, input);
      toast.success(`Email de teste enviado para ${input.to}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar email de teste";
      console.error("[useTemplateEditor] Failed to send test email", err);
      setError(message);
      toast.error("Erro ao enviar email de teste", { description: message });
      throw err;
    } finally {
      setSaving(false);
    }
  }, [activeTeamId, saving, supabaseId, templateId]);

  return {
    template,
    draft,
    loading,
    saving,
    error,
    isDirty,
    isNewTemplate,
    templateApprovalRequired,
    activeRole,
    reloadTemplate,
    saveTemplate,
    publishTemplate,
    unpublishTemplate,
    submitForApproval,
    approveTemplate,
    rejectTemplate,
    sendTestTemplate,
    updateDraft,
    setHtml,
  };
}
