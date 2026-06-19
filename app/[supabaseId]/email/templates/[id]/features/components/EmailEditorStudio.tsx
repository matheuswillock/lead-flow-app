"use client";

import {
  forwardRef,
  type ReactNode,
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
import {
  Code2,
  Copy,
  ImagePlus,
  Link2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { MonacoCodeEditor } from "@/components/editors/MonacoCodeEditor";
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
  extractTemplateVariableKeys,
} from "@/lib/email/interpolate";
import { cn } from "@/lib/utils";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type { TemplateEditorDraft } from "../context/TemplateEditorTypes";

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
  openHtmlEditor: () => Promise<void>;
}

interface EmailEditorStudioProps {
  bottomSlot?: ReactNode;
}

function getFallbackPreviewHtml() {
  return '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:360px;color:#8a8a8a;font-family:sans-serif;font-size:14px;">Sem HTML para renderizar</div>';
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

export const EmailEditorStudio = forwardRef<EmailEditorStudioRef, EmailEditorStudioProps>(function EmailEditorStudio(
  { bottomSlot },
  ref
) {
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
  const [htmlEditorOpen, setHtmlEditorOpen] = useState(false);
  const [htmlEditorValue, setHtmlEditorValue] = useState("");
  const [htmlEditorOpening, setHtmlEditorOpening] = useState(false);
  const [visualEditorTouched, setVisualEditorTouched] = useState(false);
  const [htmlSourceActive, setHtmlSourceActive] = useState(false);
  const [visualContentRevision, setVisualContentRevision] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [eventStatus, setEventStatus] = useState("Pronto");
  const htmlPreviewContent = htmlEditorValue.trim() ? htmlEditorValue : getFallbackPreviewHtml();
  const shouldPreviewHtmlSource = htmlSourceActive && !visualEditorTouched && draft.html.trim().length > 0;
  const editorContent = useMemo(() => {
    if (draft.mailyJson && !isEditorJsonEmpty(draft.mailyJson)) {
      return draft.mailyJson;
    }
    return undefined;
  }, [draft.mailyJson]);
  const editorContentKey = `${template?.id ?? "new"}:${template?.versionNumber ?? 1}:${visualContentRevision}`;
  const htmlEditorOptions = useMemo(
    () => ({
      formatOnPaste: true,
      formatOnType: true,
      minimap: { enabled: false },
      tabSize: 2,
      wordWrap: "on" as const,
    }),
    []
  );
  const builtinVariableKeys = useMemo(
    () => new Set(BUILTIN_EMAIL_VARIABLES.map((variable) => variable.key.toLowerCase())),
    []
  );

  useEffect(() => {
    const subscription = editorEventBus.on("bubble-menu:add-link", () => {
      setEventStatus("Link acionado");
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!draft.mailyJson && draft.html.trim().length > 0 && !visualEditorTouched) {
      setHtmlSourceActive(true);
    }
  }, [draft.html, draft.mailyJson, visualEditorTouched]);

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
    (ref: EmailEditorRef) => {
      setVisualEditorTouched(true);
      setHtmlSourceActive(false);
      setMailyJson(ref.getJSON());
    },
    [setMailyJson]
  );

  const syncEditorDraft = useCallback(async (): Promise<EditorSnapshot | null> => {
    const ref = editorRef.current;
    const editor = ref?.editor;
    if (!ref || !editor) {
      toast.error("Editor ainda não está pronto.");
      return null;
    }

    const { html } = await composeReactEmail({ editor });
    const mailyJson = ref.getJSON();

    setHtml(html);
    setMailyJson(mailyJson);
    return { html, mailyJson, previewText: "" };
  }, [setHtml, setMailyJson]);

  const handleExportHtml = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      if (htmlSourceActive && !visualEditorTouched) {
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
  }, [draft.html, exporting, htmlSourceActive, syncEditorDraft, visualEditorTouched]);

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

  const handlePublish = useCallback(async () => {
    if (saving) return;
    if (!visualEditorTouched) {
      await saveTemplate();
      return;
    }

    const snapshot = await syncEditorDraft();
    if (!snapshot) return;
    await saveTemplate(snapshot);
  }, [saveTemplate, saving, syncEditorDraft, visualEditorTouched]);

  const handleSaveAndPublish = useCallback(async () => {
    if (saving) return;
    let saved;
    if (!visualEditorTouched) {
      saved = await saveTemplate();
    } else {
      const snapshot = await syncEditorDraft();
      if (!snapshot) return;
      saved = await saveTemplate(snapshot);
    }
    if (saved) {
      await publishTemplate(saved.id);
    }
  }, [publishTemplate, saveTemplate, saving, syncEditorDraft, visualEditorTouched]);

  const handleOpenHtmlEditor = useCallback(async () => {
    if (htmlEditorOpening) return;

    setHtmlEditorOpening(true);
    try {
      let nextHtml = draft.html;

      if (visualEditorTouched) {
        const snapshot = await syncEditorDraft();
        if (!snapshot) return;
        nextHtml = snapshot.html;
      }

      setHtmlEditorValue(nextHtml);
      setHtmlSourceActive(true);
      setVisualEditorTouched(false);
      setHtmlEditorOpen(true);
      setEventStatus(`HTML pronto com ${nextHtml.length} caracteres`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao abrir editor HTML";
      toast.error("Erro ao abrir editor HTML", { description: message });
    } finally {
      setHtmlEditorOpening(false);
    }
  }, [draft.html, htmlEditorOpening, setHtml, syncEditorDraft, visualEditorTouched]);

  const handleHtmlEditorChange = useCallback(
    (value: string) => {
      setHtmlEditorValue(value);
    },
    []
  );

  const handleSaveHtml = useCallback(() => {
    if (saving || htmlEditorOpening) return;

    const declaredKeys = new Set(draft.variables.map((variable) => variable.key.toLowerCase()));
    const discoveredVariables = extractTemplateVariableKeys(htmlEditorValue)
      .filter((key) => !builtinVariableKeys.has(key.toLowerCase()))
      .filter((key) => !declaredKeys.has(key.toLowerCase()))
      .map((key) => ({
        key,
        type: "string" as const,
        fallbackValue: "",
        reviewStatus: "pending" as const,
      }));

    updateDraft({
      html: htmlEditorValue,
      mailyJson: null,
      variables: [...draft.variables, ...discoveredVariables],
    });
    setHtmlSourceActive(true);
    setVisualEditorTouched(false);
    setHtmlEditorOpen(false);
    setVisualContentRevision((current) => current + 1);
    setEventStatus(`HTML salvo no rascunho com ${htmlEditorValue.length} caracteres`);
    toast.success(
      discoveredVariables.length > 0
        ? `${discoveredVariables.length} variável(is) adicionada(s) para revisão`
        : "HTML salvo no rascunho"
    );
  }, [builtinVariableKeys, draft.variables, htmlEditorOpening, htmlEditorValue, saving, updateDraft]);

  useImperativeHandle(
    ref,
    () => ({
      publish: handlePublish,
      saveAndPublish: handleSaveAndPublish,
      openHtmlEditor: handleOpenHtmlEditor,
    }),
    [handleOpenHtmlEditor, handlePublish, handleSaveAndPublish]
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
        <EditorBlocksPanel
          isDirty={isDirty}
          eventStatus={eventStatus}
          exporting={exporting}
          uploadingImage={uploadingImage}
          onExportHtml={handleExportHtml}
          onImportImage={handleImportImage}
          onAddLink={handleAddLink}
          bottomSlot={bottomSlot}
        />
        {shouldPreviewHtmlSource ? (
          <div className="min-w-0 flex-1 overflow-hidden bg-muted/20 p-6">
            <div className="mx-auto h-full max-w-3xl overflow-hidden rounded-lg border bg-background shadow-sm">
              <iframe
                srcDoc={draft.html}
                title="Prévia do HTML do e-mail"
                sandbox="allow-same-origin"
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
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
            <Button variant="outline" onClick={handleCopyHtml} disabled={!exportedHtml || copying}>
              {copying ? <Spinner data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copying ? "Copiando..." : "Copiar"}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">Voltar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={htmlEditorOpen} onOpenChange={setHtmlEditorOpen}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-7xl flex flex-col">
          <DialogHeader>
            <DialogTitle>Editor HTML</DialogTitle>
            <DialogDescription>
              Edite o código do e-mail e acompanhe a renderização ao lado.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid min-h-[64vh] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
              <section className="flex min-h-[52vh] flex-col overflow-hidden rounded-md border bg-background">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">Código HTML</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {htmlEditorOpening ? "Sincronizando editor visual" : "Fonte manual do template"}
                    </p>
                  </div>
                  <Badge variant="secondary">HTML</Badge>
                </div>
                <div className="min-h-0 flex-1">
                  <MonacoCodeEditor
                    value={htmlEditorValue}
                    onChange={handleHtmlEditorChange}
                    language="html"
                    height="100%"
                    themeVariant="resend-dark"
                    placeholder="Cole ou edite o HTML do e-mail..."
                    options={htmlEditorOptions}
                  />
                </div>
              </section>

              <section className="flex min-h-[52vh] flex-col overflow-hidden rounded-md border bg-background">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">Prévia do e-mail</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      Atualizada em tempo real
                    </p>
                  </div>
                  <Badge variant="outline">Preview</Badge>
                </div>
                <div className="min-h-0 flex-1 bg-white">
                  <iframe
                    srcDoc={htmlPreviewContent}
                    title="Prévia do HTML do e-mail"
                    sandbox="allow-same-origin"
                    className="h-full w-full border-0 bg-white"
                  />
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              onClick={handleSaveHtml}
              disabled={saving || htmlEditorOpening}
            >
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {saving ? "Salvando..." : "Salvar HTML"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Voltar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

function EditorBlocksPanel({
  isDirty,
  eventStatus,
  exporting,
  uploadingImage,
  onExportHtml,
  onImportImage,
  onAddLink,
  bottomSlot,
}: {
  isDirty: boolean;
  eventStatus: string;
  exporting: boolean;
  uploadingImage: boolean;
  onExportHtml: () => void;
  onImportImage: () => void;
  onAddLink: () => void;
  bottomSlot?: ReactNode;
}) {
  return (
    <aside className="h-full min-h-0 w-72 shrink-0 overflow-y-auto border-r bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Blocos</h2>
        <Badge variant="secondary">Editor</Badge>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={onImportImage}
          disabled={uploadingImage}
        >
          {uploadingImage ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ImagePlus data-icon="inline-start" />
          )}
          {uploadingImage ? "Importando..." : "Importar imagem"}
        </Button>
        <Button type="button" variant="outline" className="justify-start" onClick={onAddLink}>
          <Link2 data-icon="inline-start" />
          Link
        </Button>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Exportação</h3>
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={onExportHtml}
          disabled={exporting}
        >
          {exporting ? <Spinner data-icon="inline-start" /> : <Code2 data-icon="inline-start" />}
          {exporting ? "Exportando..." : "Exportar HTML"}
        </Button>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-wrap gap-2">
        <Badge variant={isDirty ? "default" : "secondary"}>
          {isDirty ? "Alterado" : "Sincronizado"}
        </Badge>
        <Badge variant="outline">{eventStatus}</Badge>
      </div>

      {bottomSlot ? (
        <>
          <Separator className="my-4" />
          {bottomSlot}
        </>
      ) : null}
    </aside>
  );
}

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
