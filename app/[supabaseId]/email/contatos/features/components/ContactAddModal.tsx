"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation";
import { useContactsContext } from "../context/ContactsContext";

type ContactAddModalProps = {
  trigger: React.ReactNode
  skipAudienceValidation?: boolean
}

export function ContactAddModal({ trigger, skipAudienceValidation = false }: ContactAddModalProps) {
  const { handleAddContact } = useContactsContext();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setEmail("");
    setName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    const validation = skipAudienceValidation ? { ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail), email: trimmedEmail } : evaluateEmailForAudience(trimmedEmail);
    if (!validation.ok) {
      const reason = "reason" in validation ? validation.reason : "formato inválido"
      toast.error(`E-mail inválido. Este contato não será adicionado à base. (${reason})`);
      return;
    }

    setLoading(true);
    try {
      await handleAddContact(validation.email, name.trim() || undefined);
      setOpen(false);
      resetForm();
    } catch {
      // error toast handled in hook
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!loading) {
      setOpen(next);
      if (!next) resetForm();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-100">
        <DialogHeader>
          <DialogTitle>Adicionar contato</DialogTitle>
          <DialogDescription>
            Adicione um contato manualmente à lista selecionada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-email">
              E-mail <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="contato@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-name">Nome</Label>
            <Input
              id="contact-name"
              placeholder="Nome do contato"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <UserPlus data-icon="inline-start" />
              )}
              {loading ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
