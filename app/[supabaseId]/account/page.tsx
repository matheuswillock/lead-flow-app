"use client";

import * as React from "react";
import { Upload, Eye, EyeOff, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function AccountProfilePage() {
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

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

            {/* Form */}
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    className="h-11"
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
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="h-11 pr-12"
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
                  A senha deve ter pelo menos 8 caracteres.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="ghost" className="h-11">
                  Cancelar
                </Button>
                <Button type="submit" className="h-11 px-6">
                  Salvar alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
