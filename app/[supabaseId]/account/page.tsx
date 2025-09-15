"use client";

import * as React from "react";
import { Upload, Eye, EyeOff, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/app/context/UserContext";
import { toast } from "sonner";

export default function AccountProfilePage() {
  const { user, isLoading, updateUser, updatePassword } = useUser();
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Form states
  const [formData, setFormData] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  // Atualizar form quando dados do usuário carregarem
  React.useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
        password: "",
      });
    }
  }, [user]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const updates: any = {};
      
      // Apenas incluir campos que foram alterados
      if (formData.fullName !== (user?.fullName || "")) {
        updates.fullName = formData.fullName;
      }
      if (formData.email !== (user?.email || "")) {
        updates.email = formData.email;
      }
      if (formData.phone !== (user?.phone || "")) {
        updates.phone = formData.phone;
      }

      // Atualizar dados do perfil se houver mudanças
      if (Object.keys(updates).length > 0) {
        const result = await updateUser(updates);
        if (result.isValid) {
          toast.success("Perfil atualizado com sucesso!");
        } else {
          toast.error(result.errorMessages?.join(", ") || "Erro ao atualizar perfil");
        }
      }

      // Atualizar senha se fornecida
      if (formData.password) {
        const result = await updatePassword(formData.password);
        if (result.isValid) {
          toast.success("Senha atualizada com sucesso!");
          setFormData(prev => ({ ...prev, password: "" }));
        } else {
          toast.error(result.errorMessages?.join(", ") || "Erro ao atualizar senha");
        }
      }

      if (Object.keys(updates).length === 0 && !formData.password) {
        toast.info("Nenhuma alteração detectada");
      }
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro inesperado ao atualizar dados");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleInputChange(field: keyof typeof formData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };
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

                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        placeholder="Seu nome completo"
                        autoComplete="name"
                        className="h-11"
                        value={formData.fullName}
                        onChange={handleInputChange("fullName")}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="johndoe@email.com"
                        autoComplete="email"
                        className="h-11"
                        value={formData.email}
                        onChange={handleInputChange("email")}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      autoComplete="tel"
                      className="h-11"
                      value={formData.phone}
                      onChange={handleInputChange("phone")}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Nova Senha (opcional)</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="h-11 pr-12"
                        value={formData.password}
                        onChange={handleInputChange("password")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A senha deve ter pelo menos 6 caracteres, 1 número, 1 caractere especial e 1 maiúsculo.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="h-11"
                      onClick={() => {
                        if (user) {
                          setFormData({
                            fullName: user.fullName || "",
                            email: user.email || "",
                            phone: user.phone || "",
                            password: "",
                          });
                        }
                      }}
                      disabled={isLoading || isUpdating}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="h-11 px-6"
                      disabled={isLoading || isUpdating}
                    >
                      {isUpdating ? "Salvando..." : "Salvar alterações"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
