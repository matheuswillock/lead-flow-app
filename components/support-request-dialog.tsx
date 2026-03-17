"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LifeBuoy, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useUserContext } from "@/app/context/UserContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SupportRequestDialogProps = {
  trigger?: ReactNode;
};

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const supportFormSchema = z.object({
  subject: z.string().trim().min(1, "Informe o assunto do pedido de suporte."),
  message: z.string().trim().min(1, "Descreva o que voce precisa no campo de mensagem."),
});

export function SupportRequestDialog({ trigger }: SupportRequestDialogProps) {
  const { user } = useUserContext();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requesterName = useMemo(() => user?.fullName || "Usuario", [user?.fullName]);
  const requesterEmail = useMemo(() => user?.email || "", [user?.email]);
  const formValidation = useMemo(
    () => supportFormSchema.safeParse({ subject, message }),
    [subject, message],
  );
  const isFormValid = formValidation.success && !!requesterEmail;

  const resetForm = () => {
    setSubject("");
    setMessage("");
    setImages([]);
  };

  const onImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const nextImages = Array.from(fileList);
    const merged = [...images, ...nextImages];

    if (merged.length > MAX_IMAGES) {
      toast.error(`Voce pode enviar no maximo ${MAX_IMAGES} imagens.`);
      event.target.value = "";
      return;
    }

    for (const image of merged) {
      if (!image.type.startsWith("image/")) {
        toast.error("Apenas arquivos de imagem sao permitidos.");
        event.target.value = "";
        return;
      }

      if (image.size > MAX_IMAGE_SIZE) {
        toast.error("Cada imagem deve ter no maximo 5MB.");
        event.target.value = "";
        return;
      }
    }

    setImages(merged);
    event.target.value = "";
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!formValidation.success) {
      toast.error(formValidation.error.issues[0]?.message || "Formulario invalido.");
      return;
    }

    if (!requesterEmail) {
      toast.error("Nao foi possivel identificar seu email para envio.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("subject", formValidation.data.subject);
      formData.append("message", formValidation.data.message);
      formData.append("requesterName", requesterName);
      formData.append("requesterEmail", requesterEmail);

      for (const image of images) {
        formData.append("images", image);
      }

      const response = await fetch("/api/v1/support", {
        method: "POST",
        body: formData,
      });

      const output = await response.json();

      if (!response.ok || !output.isValid) {
        const errorMessage = output?.errorMessages?.join(", ") || "Erro ao enviar pedido de suporte.";
        toast.error(errorMessage);
        return;
      }

      const supportId = output?.result?.supportId as string | undefined;
      if (supportId) {
        toast.success(`Pedido de suporte enviado com sucesso. ID: ${supportId}`);
      } else {
        toast.success("Pedido de suporte enviado com sucesso.");
      }
      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("[SupportRequestDialog][handleSubmit] Erro ao enviar suporte:", error);
      toast.error("Erro inesperado ao enviar pedido de suporte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start gap-2" size="sm">
            <LifeBuoy className="h-4 w-4" />
            Suporte
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Enviar pedido de suporte</DialogTitle>
          <DialogDescription>
            Preencha o assunto, descreva sua solicitacao e envie imagens se necessario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-subject">Assunto</Label>
            <Input
              id="support-subject"
              placeholder="Ex.: Nao consigo concluir o cadastro"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-message">Mensagem</Label>
            <Textarea
              id="support-message"
              placeholder="Descreva em detalhes o problema ou duvida"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={4000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-images">Imagens (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input id="support-images" type="file" accept="image/*" multiple onChange={onImageSelect} />
            </div>
            <p className="text-xs text-muted-foreground">
              Ate {MAX_IMAGES} imagens de 5MB cada.
            </p>
          </div>

          {images.length > 0 ? (
            <div className="rounded-md border p-3 space-y-2">
              {images.map((image, index) => (
                <div key={`${image.name}-${index}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{image.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeImage(index)}
                    className="h-7 w-7"
                    aria-label={`Remover ${image.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isSubmitting || !isFormValid}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para suporte
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
