"use client";

import SmoothButton from "@/components/smoothui/smooth-button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";

export interface AnimatedFileUploadProps {
  accept?: string;
  helperText?: string;
  className?: string;
  disabled?: boolean;
  maxSize?: number;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
}

const SPRING = { bounce: 0.1, duration: 0.25, type: "spring" as const };
const SPRING_BOUNCY = { bounce: 0.2, duration: 0.3, type: "spring" as const };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon({ isDragOver }: { isDragOver: boolean }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div animate={shouldReduceMotion ? undefined : isDragOver ? { scale: 1.12, y: -3 } : { scale: 1, y: 0 }} transition={shouldReduceMotion ? { duration: 0 } : SPRING_BOUNCY}>
      <svg aria-hidden="true" className={cn("mb-3 h-9 w-9 transition-colors duration-200", isDragOver ? "text-primary" : "text-muted-foreground")} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}

export default function AnimatedFileUpload({ onFilesSelected, accept, multiple = true, maxSize, helperText, className, disabled = false }: AnimatedFileUploadProps) {
  const shouldReduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback((newFiles: File[]) => {
    setError(null);
    const allowedTypes = accept?.split(",").map((type) => type.trim()).filter(Boolean) ?? [];
    const unsupported = newFiles.some((file) => allowedTypes.length > 0 && !allowedTypes.includes(file.type));
    const oversized = newFiles.some((file) => maxSize !== undefined && file.size > maxSize);
    const valid = newFiles.filter((file) =>
      (!allowedTypes.length || allowedTypes.includes(file.type)) && (maxSize === undefined || file.size <= maxSize)
    );
    if (unsupported || oversized) {
      setError(unsupported ? "Use uma imagem PNG, JPG ou WebP." : `Cada arquivo deve ter no máximo ${formatFileSize(maxSize ?? 0)}.`);
    }
    if (!valid.length) return;
    const updated = multiple ? [...files, ...valid] : valid.slice(0, 1);
    setFiles(updated);
    onFilesSelected(updated);
  }, [accept, files, maxSize, multiple, onFilesSelected]);

  const removeFile = useCallback((index: number) => {
    const updated = files.filter((_, currentIndex) => currentIndex !== index);
    setFiles(updated);
    onFilesSelected(updated);
  }, [files, onFilesSelected]);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (!disabled) handleFiles(Array.from(event.dataTransfer.files));
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files ? Array.from(event.target.files) : []);
    event.currentTarget.value = "";
  }

  const openPicker = () => { if (!disabled) inputRef.current?.click(); };

  return (
    <div className={cn("w-full space-y-3", className)}>
      <input accept={accept} aria-hidden="true" className="sr-only" disabled={disabled} multiple={multiple} onChange={handleInputChange} ref={inputRef} tabIndex={-1} type="file" />
      <motion.div
        animate={shouldReduceMotion ? undefined : isDragOver ? { scale: 1.01 } : { scale: 1}}
        aria-label="Enviar imagem da logo; arraste o arquivo ou selecione no dispositivo"
        className={cn("relative flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 py-7 text-center", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", "transition-colors duration-200", isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30", disabled && "pointer-events-none opacity-50")}
        onClick={openPicker}
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) { dragCounter.current += 1; setIsDragOver(true) } }}
        onDragLeave={(event) => { event.preventDefault(); dragCounter.current -= 1; if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragOver(false) } }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !disabled) { event.preventDefault(); openPicker() } }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        transition={shouldReduceMotion ? { duration: 0 } : SPRING}
      >
        <UploadIcon isDragOver={isDragOver} />
        <p className="font-medium text-foreground text-sm">{isDragOver ? "Solte a imagem aqui" : "Arraste a imagem ou clique para selecionar"}</p>
        <p className="mt-1 text-muted-foreground text-xs">{helperText ?? `${accept?.split(",").map((type) => type.replace("image/", "").toUpperCase()).join(", ") || "Qualquer arquivo"}${maxSize ? ` · até ${formatFileSize(maxSize)}` : ""}`}</p>
      </motion.div>
      <AnimatePresence>
        {error && <motion.p animate={{ opacity: 1 }} className="text-destructive text-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }} role="alert">{error}</motion.p>}
      </AnimatePresence>
      {files.length > 0 && (
        <ul aria-label="Arquivos selecionados" className="space-y-2">
          <AnimatePresence initial={false}>
            {files.map((file, index) => (
              <motion.li key={`${file.name}-${file.size}-${file.lastModified}`} animate={{ opacity: 1, x: 0 }} className="flex min-h-14 items-center gap-3 rounded-md border bg-muted/50 px-3 py-2" exit={{ opacity: 0, x: 18 }} initial={{ opacity: 0, x: -12 }} layout={!shouldReduceMotion} transition={shouldReduceMotion ? { duration: 0 } : SPRING}>
                <FileIcon />
                <div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground text-sm">{file.name}</p><p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p></div>
                <SmoothButton aria-label={`Remover ${file.name}`} className="size-11 shrink-0 text-muted-foreground" onClick={(event) => { event.stopPropagation(); removeFile(index) }} size="icon-sm" type="button" variant="ghost">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </SmoothButton>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
