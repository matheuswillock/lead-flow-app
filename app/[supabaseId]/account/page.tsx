"use client";

import * as React from "react";
import { Upload, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/app/context/UserContext";
import { toast } from "sonner";
import { useUpdateAccountForm } from "@/hooks/useForms";
import { AccountForm } from "@/components/forms/accountForm";
import { updateAccountFormData } from "@/lib/types/formTypes";

export default function AccountProfilePage() {
  const { user, isLoading, updateUser } = useUser();
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const form = useUpdateAccountForm();

  // Atualizar form quando dados do usuário carregarem
  React.useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
        password: "",
      });
    }
  }, [user, form]);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  function onFilePickerClick() {
    fileInputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  async function onSubmit(data: updateAccountFormData) {
    setIsUpdating(true);

    try {
      const updates: any = {};
      let hasChanges = false;
      
      // Incluir campos que foram alterados
      if (data.fullName !== (user?.fullName || "")) {
        updates.fullName = data.fullName;
        hasChanges = true;
      }
      if (data.email !== (user?.email || "")) {
        updates.email = data.email;
        hasChanges = true;
      }
      if (data.phone !== (user?.phone || "")) {
        updates.phone = data.phone;
        hasChanges = true;
      }
      
      // Incluir senha se fornecida (mesmo que vazia)
      if (data.password && data.password.length > 0) {
        updates.password = data.password;
        hasChanges = true;
      }

      if (!hasChanges) {
        toast.info("Nenhuma alteração detectada");
        return;
      }

      // Usar uma única chamada para atualizar todos os dados incluindo senha
      const result = await updateUser(updates);
      
      if (result.isValid) {
        toast.success("Dados atualizados com sucesso!");
        // Limpar o campo de senha após sucesso
        if (updates.password) {
          form.setValue("password", "");
        }
      } else {
        toast.error(result.errorMessages?.join(", ") || "Erro ao atualizar dados");
      }
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro inesperado ao atualizar dados");
    } finally {
      setIsUpdating(false);
    }
  }

  function onCancel() {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
        password: "",
      });
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Minha conta</CardTitle>
            <p className="text-sm text-muted-foreground">
              Atualize seu ícone de perfil e suas informações básicas.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Carregando dados...</span>
              </div>
            ) : (
              <>
                <section aria-labelledby="avatar-title" className="space-y-4">
                  <h2 id="avatar-title" className="text-base font-medium">
                    Ícone de perfil
                  </h2>

                  <div className="flex items-center gap-6">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Pré-visualização do avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Camera className="h-7 w-7 text-muted-foreground" aria-hidden />
                          <span className="sr-only">Sem imagem de perfil</span>
                        </div>
                      )}
                    </div>

                    <div className="grow">
                      <div
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        role="button"
                        tabIndex={0}
                        onClick={onFilePickerClick}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") onFilePickerClick();
                        }}
                        className={[
                          "group flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-xl border border-dashed p-4 transition",
                          isDragging
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/60 hover:bg-muted/50",
                        ].join(" ")}
                        aria-label="Área para soltar arquivo do ícone de perfil"
                      >
                        <div className="grid place-items-center rounded-lg bg-muted p-3">
                          <Upload className="h-5 w-5 text-muted-foreground transition group-hover:scale-110" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Arraste e solte a imagem aqui</p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG até 2MB. Ou
                            <button
                              type="button"
                              className="ml-1 underline decoration-dotted underline-offset-4 hover:text-primary"
                            >
                              clique para selecionar
                            </button>
                          </p>
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <AccountForm 
                  form={form}
                  onSubmit={onSubmit}
                  isLoading={isLoading}
                  isUpdating={isUpdating}
                  onCancel={onCancel}
                  initialData={{
                    fullName: user?.fullName || "",
                    email: user?.email || "",
                    phone: user?.phone || "",
                    password: "",
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
