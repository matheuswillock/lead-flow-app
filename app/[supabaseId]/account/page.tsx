"use client";

import * as React from "react";
import { Upload, Camera, Eye, EyeOff, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/app/context/UserContext";
import { toast } from "sonner";
import { useUpdateAccountForm } from "@/hooks/useForms";
import { AccountForm } from "@/components/forms/accountForm";
import { useEffect, useRef, useState } from "react";
import { updateAccountFormData } from "@/lib/validations/validationForms";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useParams, useRouter } from "next/navigation";

export default function AccountProfilePage() {
  const { user, isLoading, updateUser, updatePassword, uploadProfileIcon, deleteProfileIcon } = useUser();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados para deletar conta
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deletionComplete, setDeletionComplete] = useState(false);
  
  const router = useRouter();
  const params = useParams();

  const form = useUpdateAccountForm();
  
  // Form separado para senha
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Atualizar form quando dados do usuário carregarem
  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
        cpfCnpj: user.cpfCnpj || "",
        postalCode: user.postalCode || "",
        address: user.address || "",
        addressNumber: user.addressNumber || "",
        neighborhood: user.neighborhood || "",
        complement: user.complement || "",
        city: user.city || "",
        state: user.state || "",
      });
    }
  }, [user, form]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onFilePickerClick() {
    fileInputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error("Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF.");
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Tamanho máximo: 5MB.");
      return;
    }

    // Preview local
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);

    // Upload para servidor
    setIsUploadingIcon(true);
    try {
      const result = await uploadProfileIcon(file);
      if (result.isValid) {
        toast.success("Ícone de perfil atualizado com sucesso!");
      } else {
        toast.error(result.errorMessages?.join(", ") || "Erro ao fazer upload do ícone");
        setAvatarPreview(null);
      }
    } catch (error) {
      console.error("Error uploading icon:", error);
      toast.error("Erro inesperado ao fazer upload do ícone");
      setAvatarPreview(null);
    } finally {
      setIsUploadingIcon(false);
    }
  }

  async function handleDeleteIcon() {
    setIsUploadingIcon(true);
    try {
      const result = await deleteProfileIcon();
      if (result.isValid) {
        toast.success("Ícone de perfil removido com sucesso!");
        setAvatarPreview(null);
      } else {
        toast.error(result.errorMessages?.join(", ") || "Erro ao remover ícone");
      }
    } catch (error) {
      console.error("Error deleting icon:", error);
      toast.error("Erro inesperado ao remover ícone");
    } finally {
      setIsUploadingIcon(false);
    }
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
      if (data.cpfCnpj !== (user?.cpfCnpj || "")) {
        updates.cpfCnpj = data.cpfCnpj;
        hasChanges = true;
      }
      if (data.postalCode !== (user?.postalCode || "")) {
        updates.postalCode = data.postalCode;
        hasChanges = true;
      }
      if (data.address !== (user?.address || "")) {
        updates.address = data.address;
        hasChanges = true;
      }
      if (data.addressNumber !== (user?.addressNumber || "")) {
        updates.addressNumber = data.addressNumber;
        hasChanges = true;
      }
      if (data.neighborhood !== (user?.neighborhood || "")) {
        updates.neighborhood = data.neighborhood;
        hasChanges = true;
      }
      if (data.complement !== (user?.complement || "")) {
        updates.complement = data.complement;
        hasChanges = true;
      }
      if (data.city !== (user?.city || "")) {
        updates.city = data.city;
        hasChanges = true;
      }
      if (data.state !== (user?.state || "")) {
        updates.state = data.state;
        hasChanges = true;
      }

      if (!hasChanges) {
        toast.info("Nenhuma alteração detectada");
        return;
      }

      // Atualizar dados do perfil (sem senha)
      const result = await updateUser(updates);
      
      if (result.isValid) {
        toast.success("Dados atualizados com sucesso!");
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

  async function onPasswordSubmit(data: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    setIsUpdating(true);

    try {
      if (data.newPassword !== data.confirmPassword) {
        toast.error("As senhas não coincidem");
        return;
      }

      // Atualizar apenas a senha usando o método específico
      const result = await updatePassword(data.newPassword);
      
      if (result.isValid) {
        toast.success("Senha atualizada com sucesso!");
        // Limpar os campos de senha
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      } else {
        toast.error(result.errorMessages?.join(", ") || "Erro ao atualizar senha");
      }
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      toast.error("Erro inesperado ao atualizar senha");
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
        cpfCnpj: user.cpfCnpj || "",
        postalCode: user.postalCode || "",
        address: user.address || "",
        addressNumber: user.addressNumber || "",
        complement: user.complement || "",
        city: user.city || "",
        state: user.state || "",
      });
    }
  }

  function onPasswordCancel() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      toast.error("Digite sua senha para confirmar a exclusão");
      return;
    }

    setIsDeletingAccount(true);

    try {
      const supabaseId = params.supabaseId as string;
      
      const response = await fetch(`/api/v1/profiles/${supabaseId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword })
      });

      const result = await response.json();

      if (!result.isValid) {
        toast.error(result.errorMessages?.join(", ") || "Erro ao deletar conta");
        setIsDeletingAccount(false);
        return;
      }

      // Mostrar mensagem de sucesso e preparar redirect
      setDeletionComplete(true);
      toast.success("Conta deletada com sucesso!");

      // Aguardar 5 segundos e redirecionar
      setTimeout(() => {
        router.push("/");
      }, 5000);

    } catch (error) {
      console.error("Erro ao deletar conta:", error);
      toast.error("Erro inesperado ao deletar conta");
      setIsDeletingAccount(false);
    }
  }

  function handleCancelDelete() {
    setDeletePassword("");
    setDeleteDialogOpen(false);
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Minha conta</CardTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie seu perfil e configurações de segurança.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Carregando dados...</span>
              </div>
            ) : (
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="profile">Perfil</TabsTrigger>
                  <TabsTrigger value="security">Segurança</TabsTrigger>
                </TabsList>

                {/* Aba de Perfil */}
                <TabsContent value="profile" className="space-y-6">
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
                      ) : user?.profileIconId ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-icons/${user.profileIconId}`}
                          alt="Ícone de perfil atual"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // Fallback se a imagem não carregar
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Camera className="h-7 w-7 text-muted-foreground" aria-hidden />
                          <span className="sr-only">Sem imagem de perfil</span>
                        </div>
                      )}
                      {/* Fallback div - inicialmente oculto */}
                      <div className="hidden h-full w-full items-center justify-center bg-muted">
                        <Camera className="h-7 w-7 text-muted-foreground" aria-hidden />
                        <span className="sr-only">Erro ao carregar imagem</span>
                      </div>
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
                          isUploadingIcon ? "pointer-events-none opacity-50" : ""
                        ].join(" ")}
                        aria-label="Área para soltar arquivo do ícone de perfil"
                      >
                        <div className="grid place-items-center rounded-lg bg-muted p-3">
                          {isUploadingIcon ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                          ) : (
                            <Upload className="h-5 w-5 text-muted-foreground transition group-hover:scale-110" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {isUploadingIcon ? "Enviando..." : "Arraste e solte a imagem aqui"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, WebP, GIF até 5MB. Ou
                            <button
                              type="button"
                              className="ml-1 underline decoration-dotted underline-offset-4 hover:text-primary"
                              disabled={isUploadingIcon}
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

                      {/* Botão para remover ícone */}
                      {(user?.profileIconId || avatarPreview) && (
                        <button
                          type="button"
                          onClick={handleDeleteIcon}
                          disabled={isUploadingIcon}
                          className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isUploadingIcon ? "Processando..." : "Remover ícone atual"}
                        </button>
                      )}
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
                    showPasswordField={false}
                    initialData={{
                      fullName: user?.fullName || "",
                      email: user?.email || "",
                      phone: user?.phone || "",
                      cpfCnpj: user?.cpfCnpj || "",
                      postalCode: user?.postalCode || "",
                      address: user?.address || "",
                      addressNumber: user?.addressNumber || "",
                      complement: user?.complement || "",
                      city: user?.city || "",
                      state: user?.state || "",
                    }}
                  />
                </TabsContent>

                {/* Aba de Segurança */}
                <TabsContent value="security" className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-medium">Alterar senha</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Atualize sua senha para manter sua conta segura.
                      </p>
                    </div>

                    <Separator />

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        onPasswordSubmit(passwordForm);
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label htmlFor="newPassword" className="text-sm font-medium">
                          Nova senha
                        </label>
                        <div className="relative">
                          <input
                            id="newPassword"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isUpdating}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
                            disabled={isUpdating}
                          >
                            {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-sm font-medium">
                          Confirmar nova senha
                        </label>
                        <div className="relative">
                          <input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isUpdating}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                            disabled={isUpdating}
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Requisitos da senha */}
                      <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                        <p className="text-sm font-medium text-foreground">Requisitos da senha:</p>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-1">
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Mínimo de 6 caracteres</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Pelo menos 1 letra maiúscula (A-Z)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Pelo menos 1 letra minúscula (a-z)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Pelo menos 1 número (0-9)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Pelo menos 1 caractere especial (!@#$%^&*)</span>
                          </li>
                        </ul>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={onPasswordCancel}
                          disabled={isUpdating}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-11 px-6 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isUpdating || !passwordForm.newPassword || !passwordForm.confirmPassword}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6"
                        >
                          {isUpdating ? "Atualizando..." : "Atualizar senha"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <Separator className="my-8" />

                  {/* Danger Zone */}
                  <div className="space-y-4 rounded-lg border-2 border-red-600/40 bg-red-50 dark:bg-red-950/20 p-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-red-700 dark:text-red-500">
                          Zona de Perigo
                        </h3>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                          Ações irreversíveis. Proceda com cautela.
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-red-600/30" />

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-red-700 dark:text-red-400">
                          Deletar conta permanentemente
                        </h4>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                          Esta ação é <strong>irreversível</strong>. Todos os seus dados, incluindo operadores e managers relacionados, serão permanentemente removidos.
                        </p>
                      </div>

                      <div className="flex justify-end pt-2">
                        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              className="cursor-pointer bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                              disabled={isDeletingAccount}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Deletar conta
                            </Button>
                          </AlertDialogTrigger>
                        <AlertDialogContent className="border-red-600/40">
                          {deletionComplete ? (
                            // Tela de despedida
                            <div className="text-center py-6">
                              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
                                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <h3 className="text-xl font-semibold mb-2">Até logo! 👋</h3>
                              <p className="text-muted-foreground mb-1">
                                Sua conta foi deletada com sucesso.
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Redirecionando em 5 segundos...
                              </p>
                            </div>
                          ) : isDeletingAccount ? (
                            // Tela de loading
                            <div className="text-center py-6">
                              <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
                              <h3 className="text-lg font-semibold mb-2">Deletando sua conta</h3>
                              <p className="text-sm text-muted-foreground">
                                Aguarde enquanto removemos todos os seus dados...
                              </p>
                            </div>
                          ) : (
                            // Tela de confirmação
                            <>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
                                  <AlertTriangle className="h-5 w-5" />
                                  Tem certeza absoluta?
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild className="space-y-3 pt-2">
                                  <div>
                                  <p>
                                    Esta ação <strong className="text-foreground">não pode ser desfeita</strong>. Isso irá deletar permanentemente:
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Sua conta e todos os dados pessoais</li>
                                    <li>Todos os leads e informações de clientes</li>
                                    <li>Todos os operadores vinculados à sua conta</li>
                                    <li>Todos os managers relacionados</li>
                                    <li>Histórico de atividades e relatórios</li>
                                  </ul>
                                  <p className="text-red-600 dark:text-red-500 font-medium pt-2">
                                    ⚠️ Esta ação é irreversível!
                                  </p>
                                                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="delete-password" className="text-sm font-medium">
                                    Digite sua senha para confirmar
                                  </Label>
                                  <div className="relative">
                                    <Input
                                      id="delete-password"
                                      type={showDeletePassword ? "text" : "password"}
                                      placeholder="Digite sua senha"
                                      value={deletePassword}
                                      onChange={(e) => setDeletePassword(e.target.value)}
                                      className="pr-11"
                                      autoComplete="current-password"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground transition-colors"
                                      aria-label={showDeletePassword ? "Ocultar senha" : "Mostrar senha"}
                                    >
                                      {showDeletePassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={handleCancelDelete} className="cursor-pointer">
                                  Cancelar
                                </AlertDialogCancel>
                                <Button
                                  variant="destructive"
                                  onClick={handleDeleteAccount}
                                  disabled={!deletePassword}
                                  className="cursor-pointer bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Confirmar exclusão
                                </Button>
                              </AlertDialogFooter>
                            </>
                          )}
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
