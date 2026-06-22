"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmailEditor, type EmailEditorRef } from "@react-email/editor";
import { composeReactEmail, editorEventBus } from "@react-email/editor/core";
import { Inspector, getNodeMeta } from "@react-email/editor/ui";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BUILTIN_EMAIL_VARIABLES,
  BUILTIN_EMAIL_FUNCTION_KEYS,
  extractTemplateVariableKeys,
} from "@/lib/email/interpolate";
import { cn } from "@/lib/utils";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type { TemplateEditorDraft } from "../context/TemplateEditorTypes";
import { EditorHtmlModeAside } from "./EditorHtmlModeAside";
import { EditorHtmlWorkspace } from "./EditorHtmlWorkspace";
import { EditorModeSwitchDialog } from "./EditorModeSwitchDialog";
import { EditorSidebar } from "./EditorSidebar";
import type { EditorMode, SidebarSection } from "./EditorStudioTypes";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const TEXT_MARKS = [
  { value: "bold", label: "B" },
  { value: "italic", label: "I" },
  { value: "underline", label: "U" },
  { value: "strike", label: "S" },
  { value: "code", label: "{}" },
] as const;

const ALIGNMENTS = [
  { value: "left", label: "Esq." },
  { value: "center", label: "Centro" },
  { value: "right", label: "Dir." },
] as const;

type EditorSnapshot = Pick<TemplateEditorDraft, "html" | "mailyJson" | "previewText">;
type ImageUploadCommand = { commands: { uploadImage: () => boolean } };

export interface EmailEditorStudioRef {
  publish: () => Promise<void>;
  saveAndPublish: () => Promise<void>;
  getCurrentSnapshot: () => Promise<EditorSnapshot | null>;
  requestModeSwitch: (mode: EditorMode) => void;
  getEditorMode: () => EditorMode;
}

interface EmailEditorStudioProps {
  onModeChange?: (mode: EditorMode) => void;
}

function normalizeColor(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function isEditorJsonEmpty(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content) || content.length === 0) return true;
  return content.every((node) => {
    if (!node || typeof node !== "object") return true;
    const childContent = (node as { content?: unknown }).content;
    return !Array.isArray(childContent) || childContent.length === 0;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Não foi possível ler a imagem."));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function discoverTemplateVariables(
  html: string,
  existingVariables: TemplateEditorDraft["variables"],
  builtinVariableKeys: Set<string>
) {
  const declaredKeys = new Set(existingVariables.map((variable) => variable.key.toLowerCase()));
  return extractTemplateVariableKeys(html)
    .filter((key) => !builtinVariableKeys.has(key.toLowerCase()))
    .filter((key) => !BUILTIN_EMAIL_FUNCTION_KEYS.has(key.toLowerCase()))
    .filter((key) => !declaredKeys.has(key.toLowerCase()))
    .map((key) => ({
      key,
      type: "string" as const,
      fallbackValue: "",
      reviewStatus: "pending" as const,
    }));
}

export const EmailEditorStudio = forwardRef<EmailEditorStudioRef, EmailEditorStudioProps>(
  function EmailEditorStudio({ onModeChange }, ref) {
    const {
      template,
      draft,
      isDirty,
      saving,
      saveTemplate,
      publishTemplate,
      updateDraft,
      setHtml,
      setMailyJson,
    } = useTemplateEditorContext();

    const editorRef = useRef<EmailEditorRef>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportedHtml, setExportedHtml] = useState("");
    const [exporting, setExporting] = useState(false);
    const [copying, setCopying] = useState(false);
    const [editorMode, setEditorMode] = useState<EditorMode>("blocks");
    const [sidebarSection, setSidebarSection] = useState<SidebarSection>("menu");
    const [pendingMode, setPendingMode] = useState<EditorMode | null>(null);
    const [modeSwitchOpen, setModeSwitchOpen] = useState(false);
    const [modeSwitching, setModeSwitching] = useState(false);
    const [htmlModeValue, setHtmlModeValue] = useState("");
    const [visualEditorTouched, setVisualEditorTouched] = useState(false);
    const [visualContentRevision, setVisualContentRevision] = useState(0);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [eventStatus, setEventStatus] = useState("Pronto");

    const builtinVariableKeys = useMemo(
      () => new Set(BUILTIN_EMAIL_VARIABLES.map((variable) => variable.key.toLowerCase())),
      []
    );

    const editorContent = useMemo(() => {
      if (draft.mailyJson && !isEditorJsonEmpty(draft.mailyJson)) {
        return draft.mailyJson;
      }
      if (draft.html.trim()) {
        return draft.html;
      }
      return undefined;
    }, [draft.mailyJson, draft.html]);

    const editorContentKey = `${template?.id ?? "new"}:${template?.versionNumber ?? 1}:${visualContentRevision}:${editorMode}`;

    useEffect(() => {
      const subscription = editorEventBus.on("bubble-menu:add-link", () => {
        setEventStatus("Link acionado");
      });
      return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
      onModeChange?.(editorMode);
    }, [editorMode, onModeChange]);

    const uploadImage = useCallback(async (file: File) => {
      setUploadingImage(true);
      try {
        if (!file.type.startsWith("image/")) {
          throw new Error("Selecione um arquivo de imagem.");
        }
        if (file.size > MAX_IMAGE_SIZE) {
          throw new Error("A imagem deve ter no máximo 5MB.");
        }
        const url = await fileToDataUrl(file);
        toast.success("Imagem importada");
        return { url };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao importar imagem";
        toast.error("Erro ao importar imagem", { description: message });
        throw error;
      } finally {
        setUploadingImage(false);
      }
    }, []);

    const handleEditorUpdate = useCallback(
      (editorStudioRef: EmailEditorRef) => {
        setVisualEditorTouched(true);
        setMailyJson(editorStudioRef.getJSON());
      },
      [setMailyJson]
    );

    const syncEditorDraft = useCallback(async (): Promise<EditorSnapshot | null> => {
      const studioRef = editorRef.current;
      const editor = studioRef?.editor;
      if (!studioRef || !editor) {
        toast.error("Editor ainda não está pronto.");
        return null;
      }

      const { html } = await composeReactEmail({ editor });
      const mailyJson = studioRef.getJSON();
      setHtml(html);
      setMailyJson(mailyJson);
      return { html, mailyJson, previewText: draft.previewText };
    }, [draft.previewText, setHtml, setMailyJson]);

    const mergeHtmlDraft = useCallback(
      (html: string, options?: { clearMailyJson?: boolean }) => {
        const discoveredVariables = discoverTemplateVariables(
          html,
          draft.variables,
          builtinVariableKeys
        );
        updateDraft({
          html,
          ...(options?.clearMailyJson ? { mailyJson: null } : {}),
          ...(discoveredVariables.length > 0
            ? { variables: [...draft.variables, ...discoveredVariables] }
            : {}),
        });
        if (discoveredVariables.length > 0) {
          toast.success(
            `${discoveredVariables.length} variável(is) adicionada(s) para revisão`
          );
        }
      },
      [builtinVariableKeys, draft.variables, updateDraft]
    );

    const applyModeSwitch = useCallback(
      async (targetMode: EditorMode) => {
        if (targetMode === editorMode) return;

        setModeSwitching(true);
        try {
          if (targetMode === "html") {
            let nextHtml = draft.html;
            if (editorMode === "blocks" && visualEditorTouched) {
              const snapshot = await syncEditorDraft();
              if (!snapshot) return;
              nextHtml = snapshot.html;
            }
            setHtmlModeValue(nextHtml);
            setEditorMode("html");
            setSidebarSection("menu");
            setEventStatus(`Modo HTML com ${nextHtml.length} caracteres`);
            return;
          }

          const htmlToImport = htmlModeValue || draft.html;
          mergeHtmlDraft(htmlToImport, { clearMailyJson: true });
          setVisualEditorTouched(false);
          setVisualContentRevision((current) => current + 1);
          setEditorMode("blocks");
          setSidebarSection("menu");
          setEventStatus("Modo blocos ativo");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao alternar modo";
          toast.error("Erro ao alternar modo", { description: message });
        } finally {
          setModeSwitching(false);
          setModeSwitchOpen(false);
          setPendingMode(null);
        }
      },
      [
        draft.html,
        editorMode,
        htmlModeValue,
        mergeHtmlDraft,
        syncEditorDraft,
        visualEditorTouched,
      ]
    );

    const requestModeSwitch = useCallback(
      (mode: EditorMode) => {
        if (mode === editorMode || modeSwitching) return;
        setPendingMode(mode);
        setModeSwitchOpen(true);
      },
      [editorMode, modeSwitching]
    );

    const handleExportHtml = useCallback(async () => {
      if (exporting) return;
      setExporting(true);
      try {
        if (editorMode === "html") {
          const html = htmlModeValue || draft.html;
          setExportedHtml(html);
          setExportOpen(true);
          setEventStatus(`HTML exportado com ${html.length} caracteres`);
          return;
        }

        if (!visualEditorTouched && draft.html.trim()) {
          setExportedHtml(draft.html);
          setExportOpen(true);
          setEventStatus(`HTML exportado com ${draft.html.length} caracteres`);
          return;
        }

        const snapshot = await syncEditorDraft();
        if (!snapshot) return;
        setExportedHtml(snapshot.html);
        setExportOpen(true);
        setEventStatus(`HTML exportado com ${snapshot.html.length} caracteres`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao exportar HTML";
        toast.error("Erro ao exportar HTML", { description: message });
      } finally {
        setExporting(false);
      }
    }, [draft.html, editorMode, exporting, htmlModeValue, syncEditorDraft, visualEditorTouched]);

    const handleCopyHtml = useCallback(async () => {
      if (!exportedHtml || copying) return;
      setCopying(true);
      try {
        await navigator.clipboard.writeText(exportedHtml);
        toast.success("HTML copiado");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível copiar o HTML";
        toast.error("Erro ao copiar", { description: message });
      } finally {
        setCopying(false);
      }
    }, [copying, exportedHtml]);

    const buildHtmlModeSnapshot = useCallback((): EditorSnapshot => {
      const html = htmlModeValue || draft.html;
      return {
        html,
        mailyJson: draft.mailyJson,
        previewText: draft.previewText,
      };
    }, [draft.mailyJson, draft.html, draft.previewText, htmlModeValue]);

    const handlePublish = useCallback(async () => {
      if (saving) return;

      if (editorMode === "html") {
        const snapshot = buildHtmlModeSnapshot();
        mergeHtmlDraft(snapshot.html);
        await saveTemplate(snapshot);
        return;
      }

      if (!visualEditorTouched) {
        await saveTemplate();
        return;
      }

      const snapshot = await syncEditorDraft();
      if (!snapshot) return;
      await saveTemplate(snapshot);
    }, [
      buildHtmlModeSnapshot,
      editorMode,
      mergeHtmlDraft,
      saveTemplate,
      saving,
      syncEditorDraft,
      visualEditorTouched,
    ]);

    const handleSaveAndPublish = useCallback(async () => {
      if (saving) return;

      let saved;
      if (editorMode === "html") {
        const snapshot = buildHtmlModeSnapshot();
        mergeHtmlDraft(snapshot.html);
        saved = await saveTemplate(snapshot);
      } else if (!visualEditorTouched) {
        saved = await saveTemplate();
      } else {
        const snapshot = await syncEditorDraft();
        if (!snapshot) return;
        saved = await saveTemplate(snapshot);
      }

      if (saved) {
        await publishTemplate(saved.id);
      }
    }, [
      buildHtmlModeSnapshot,
      editorMode,
      mergeHtmlDraft,
      publishTemplate,
      saveTemplate,
      saving,
      syncEditorDraft,
      visualEditorTouched,
    ]);

    const getCurrentSnapshot = useCallback(async (): Promise<EditorSnapshot | null> => {
      if (editorMode === "html") {
        return buildHtmlModeSnapshot();
      }

      const studioRef = editorRef.current;
      const editor = studioRef?.editor;
      if (!studioRef || !editor) {
        if (draft.html.trim()) {
          return {
            html: draft.html,
            mailyJson: draft.mailyJson,
            previewText: draft.previewText,
          };
        }
        return null;
      }

      const { html } = await composeReactEmail({ editor });
      const mailyJson = studioRef.getJSON();
      return { html, mailyJson, previewText: draft.previewText };
    }, [buildHtmlModeSnapshot, draft.html, draft.mailyJson, draft.previewText, editorMode]);

    const handleHtmlModeChange = useCallback(
      (value: string) => {
        setHtmlModeValue(value);
        updateDraft({ html: value });
      },
      [updateDraft]
    );

    useImperativeHandle(
      ref,
      () => ({
        publish: handlePublish,
        saveAndPublish: handleSaveAndPublish,
        getCurrentSnapshot,
        requestModeSwitch,
        getEditorMode: () => editorMode,
      }),
      [
        editorMode,
        getCurrentSnapshot,
        handlePublish,
        handleSaveAndPublish,
        requestModeSwitch,
      ]
    );

    const handleImportImage = useCallback(() => {
      const editor = editorRef.current?.editor;
      if (!editor) {
        toast.error("Editor ainda não está pronto.");
        return;
      }
      editor.chain().focus().run();
      (editor as typeof editor & ImageUploadCommand).commands.uploadImage();
      setEventStatus("Upload de imagem acionado");
    }, []);

    const handleAddLink = useCallback(() => {
      const editor = editorRef.current?.editor;
      if (!editor) {
        toast.error("Editor ainda não está pronto.");
        return;
      }
      editor.chain().focus().run();
      editorEventBus.dispatch("bubble-menu:add-link", undefined);
    }, []);

    return (
      <div className="flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
        <div className="flex h-full min-h-0 flex-1 overflow-hidden">
          <EditorSidebar
            editorMode={editorMode}
            section={sidebarSection}
            history={template?.history ?? []}
            isDirty={isDirty}
            eventStatus={eventStatus}
            exporting={exporting}
            uploadingImage={uploadingImage}
            onSectionChange={setSidebarSection}
            onExportHtml={() => void handleExportHtml()}
            onImportImage={handleImportImage}
            onAddLink={handleAddLink}
          />

          {editorMode === "html" ? (
            <>
              <EditorHtmlWorkspace value={htmlModeValue || draft.html} onChange={handleHtmlModeChange} />
              <EditorHtmlModeAside />
            </>
          ) : (
            <EmailEditor
              key={editorContentKey}
              ref={editorRef}
              content={editorContent}
              onUpdate={handleEditorUpdate}
              onUploadImage={uploadImage}
              bubbleMenu={{
                hideWhenActiveNodes: ["image", "button"],
                hideWhenActiveMarks: ["link"],
              }}
              className={cn(
                "min-w-0 flex-1 overflow-y-auto bg-muted/20 p-6",
                "[&_.ProseMirror]:mx-auto [&_.ProseMirror]:min-h-150",
                "[&_.ProseMirror]:max-w-2xl [&_.ProseMirror]:rounded-lg",
                "[&_.ProseMirror]:border [&_.ProseMirror]:bg-background",
                "[&_.ProseMirror]:p-8 [&_.ProseMirror]:shadow-sm",
                "[&_.ProseMirror]:outline-none"
              )}
              placeholder="Pressione '/&#39; para usar comandos rápidos"
              theme="basic"
            >
              <CustomInspector />
            </EmailEditor>
          )}
        </div>

        <EditorModeSwitchDialog
          open={modeSwitchOpen}
          targetMode={pendingMode}
          switching={modeSwitching}
          onOpenChange={(open) => {
            setModeSwitchOpen(open);
            if (!open) setPendingMode(null);
          }}
          onConfirm={() => {
            if (pendingMode) void applyModeSwitch(pendingMode);
          }}
        />

        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="max-h-[90vh] max-w-5xl flex flex-col">
            <DialogHeader>
              <DialogTitle>HTML exportado</DialogTitle>
              <DialogDescription>
                Conteúdo pronto para envio pelo módulo de campanhas.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Textarea
                readOnly
                value={exportedHtml}
                className="min-h-[55vh] resize-none font-mono text-xs"
                aria-label="HTML exportado"
              />
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button variant="outline" onClick={() => void handleCopyHtml()} disabled={!exportedHtml || copying}>
                {copying ? <Spinner data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copying ? "Copiando..." : "Copiar"}
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">Voltar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

function CustomInspector() {
  return (
    <Inspector.Root className="h-full min-h-0 w-80 shrink-0 overflow-y-auto border-l bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Ajustes</h2>
        <Badge variant="secondary">Editor</Badge>
      </div>

      <div className="mt-3">
        <Inspector.Breadcrumb>
          {(segments) => (
            <div className="flex flex-wrap items-center gap-1">
              {segments.map((segment, index) => {
                const meta = getNodeMeta(segment.node.nodeType);
                return (
                  <Button
                    key={`${segment.node.nodeType}-${index}`}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={segment.focus}
                    className="h-7 px-2 text-xs"
                  >
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          )}
        </Inspector.Breadcrumb>
      </div>

      <Separator className="my-4" />

      <Inspector.Document>
        {({ findStyleValue, setGlobalStyle }) => (
          <div className="flex flex-col gap-4">
            <PanelTitle title="Documento" description="Tema global" />
            <ColorField
              label="Fundo"
              value={normalizeColor(findStyleValue("body", "backgroundColor"), "#ffffff")}
              onChange={(value) => setGlobalStyle("body", "backgroundColor", value)}
            />
            <ColorField
              label="Container"
              value={normalizeColor(findStyleValue("container", "backgroundColor"), "#ffffff")}
              onChange={(value) => setGlobalStyle("container", "backgroundColor", value)}
            />
            <ColorField
              label="Links"
              value={normalizeColor(findStyleValue("link", "color"), "#ff6900")}
              onChange={(value) => setGlobalStyle("link", "color", value)}
            />
            <ColorField
              label="Botões"
              value={normalizeColor(findStyleValue("button", "backgroundColor"), "#ff6900")}
              onChange={(value) => setGlobalStyle("button", "backgroundColor", value)}
            />
          </div>
        )}
      </Inspector.Document>

      <Inspector.Node>
        {({ nodeType, getAttr, setAttr, getStyle, setStyle }) => (
          <div className="flex flex-col gap-4">
            <PanelTitle title="Elemento" description={getNodeMeta(nodeType).label} />
            <TextField
              label="Link"
              value={String(getAttr("href") ?? "")}
              placeholder="https://..."
              onChange={(value) => setAttr("href", value || null)}
            />
            <TextField
              label="Alt"
              value={String(getAttr("alt") ?? "")}
              placeholder="Texto alternativo"
              onChange={(value) => setAttr("alt", value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Largura"
                value={String(getAttr("width") ?? getStyle("width") ?? "")}
                placeholder="600"
                onChange={(value) => setAttr("width", value)}
              />
              <TextField
                label="Altura"
                value={String(getAttr("height") ?? getStyle("height") ?? "")}
                placeholder="auto"
                onChange={(value) => setAttr("height", value)}
              />
            </div>
            <ColorField
              label="Cor"
              value={normalizeColor(getStyle("color"), "#111111")}
              onChange={(value) => setStyle("color", value)}
            />
            <ColorField
              label="Fundo"
              value={normalizeColor(getStyle("backgroundColor"), "#ffffff")}
              onChange={(value) => setStyle("backgroundColor", value)}
            />
            <TextField
              label="Padding"
              value={String(getStyle("padding") ?? "")}
              placeholder="16px"
              onChange={(value) => setStyle("padding", value)}
            />
            <TextField
              label="Raio"
              value={String(getStyle("borderRadius") ?? "")}
              placeholder="8px"
              onChange={(value) => setStyle("borderRadius", value)}
            />
            <AlignmentControl
              value={String(getAttr("alignment") ?? "left")}
              onChange={(value) => setAttr("alignment", value)}
            />
          </div>
        )}
      </Inspector.Node>

      <Inspector.Text>
        {({
          marks,
          toggleMark,
          alignment,
          setAlignment,
          isLinkActive,
          linkHref,
          linkColor,
          setLinkColor,
          getStyle,
          setStyle,
        }) => (
          <div className="flex flex-col gap-4">
            <PanelTitle title="Texto" description="Seleção atual" />
            <MarkControl marks={marks} onToggle={toggleMark} />
            <AlignmentControl value={alignment} onChange={setAlignment} />
            <ColorField
              label="Cor"
              value={normalizeColor(getStyle("color"), "#111111")}
              onChange={(value) => setStyle("color", value)}
            />
            <TextField
              label="Tamanho"
              value={String(getStyle("fontSize") ?? "")}
              placeholder="16px"
              onChange={(value) => setStyle("fontSize", value)}
            />
            {isLinkActive ? (
              <>
                <TextField label="URL" value={linkHref} readOnly />
                <ColorField
                  label="Cor do link"
                  value={normalizeColor(linkColor, "#ff6900")}
                  onChange={setLinkColor}
                />
              </>
            ) : null}
          </div>
        )}
      </Inspector.Text>
    </Inspector.Root>
  );
}

function PanelTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium">
      {label}
      <Input
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-8 text-xs"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs font-medium">
      {label}
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-8 rounded-md border bg-background"
          aria-label={label}
        />
        <span className="w-16 font-mono text-xs text-muted-foreground">{value}</span>
      </span>
    </label>
  );
}

function AlignmentControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">Alinhamento</span>
      <ToggleGroup
        type="single"
        value={value || "left"}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        className="justify-start"
      >
        {ALIGNMENTS.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value} className="h-8 px-2 text-xs">
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function MarkControl({
  marks,
  onToggle,
}: {
  marks: Record<string, boolean>;
  onToggle: (mark: string) => void;
}) {
  const activeMarks = TEXT_MARKS.filter((mark) => marks[mark.value]).map((mark) => mark.value);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">Formatação</span>
      <ToggleGroup
        type="multiple"
        value={activeMarks}
        onValueChange={(nextMarks) => {
          TEXT_MARKS.forEach((mark) => {
            const wasActive = activeMarks.includes(mark.value);
            const isActive = nextMarks.includes(mark.value);
            if (wasActive !== isActive) onToggle(mark.value);
          });
        }}
        className="justify-start"
      >
        {TEXT_MARKS.map((mark) => (
          <ToggleGroupItem key={mark.value} value={mark.value} className="h-8 min-w-8 px-2 text-xs">
            {mark.value === "bold" ? <strong>{mark.label}</strong> : mark.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
