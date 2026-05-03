"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { SignInWithOAuthCredentials } from "@supabase/supabase-js"
import {
  AlertTriangle,
  Calendar,
  CircleCheckBig,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/googleOAuth"
import { getProfileTimezoneOptions } from "@/lib/dates"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import type { BackofficeAccountUpdateInput } from "../context/BackofficeAccountTypes"

const EMPTY_FORM: BackofficeAccountUpdateInput = {
  fullName: "",
  email: "",
  phone: "",
  cpfCnpj: "",
  postalCode: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  complement: "",
  city: "",
  state: "",
}

function initials(name?: string | null) {
  if (!name) return "BO"
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function hasStrongPassword(value: string) {
  return (
    value.length >= 6 &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)
  )
}

export function BackofficeAccountContainer() {
  const {
    account,
    isLoading,
    error,
    updateAccount,
    updatePassword,
    uploadIcon,
    removeIcon,
    updateTimezone,
    disconnectGoogle,
  } = useBackofficeAccount()
  const [form, setForm] = useState<BackofficeAccountUpdateInput>(EMPTY_FORM)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false)
  const [isUpdatingTimezone, setIsUpdatingTimezone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!account) return
    setForm({
      fullName: account.fullName ?? "",
      email: account.email ?? "",
      phone: account.phone ?? "",
      cpfCnpj: account.cpfCnpj ?? "",
      postalCode: account.postalCode ?? "",
      address: account.address ?? "",
      addressNumber: account.addressNumber ?? "",
      neighborhood: account.neighborhood ?? "",
      complement: account.complement ?? "",
      city: account.city ?? "",
      state: account.state ?? "",
    })
  }, [account])

  const timezoneOptions = useMemo(
    () => getProfileTimezoneOptions(account?.timezone ?? "America/Sao_Paulo"),
    [account?.timezone]
  )
  const selectedTimezoneLabel =
    timezoneOptions.find((option) => option.value === account?.timezone)?.label ?? "São Paulo"

  const setField = (key: keyof BackofficeAccountUpdateInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSaveProfile() {
    if (isSavingProfile) return
    setIsSavingProfile(true)
    try {
      await updateAccount(form)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar conta")
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleSavePassword() {
    if (isSavingPassword || !hasStrongPassword(password) || password !== confirmPassword) return
    setIsSavingPassword(true)
    try {
      await updatePassword(password)
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar senha")
    } finally {
      setIsSavingPassword(false)
    }
  }

  async function handleIconChange(file: File | null) {
    if (!file) return
    try {
      await uploadIcon(file)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar ícone")
    }
  }

  async function handleConnectGoogle() {
    if (isConnectingGoogle) return
    setIsConnectingGoogle(true)
    try {
      const supabase = createSupabaseBrowser()
      if (!supabase) {
        toast.error("Supabase indisponível no momento")
        return
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=/backoffice/account`
      sessionStorage.setItem(
        "googleConnectContext",
        JSON.stringify({
          source: "backoffice-account",
          expectedSupabaseId: account?.supabaseId ?? null,
        })
      )

      const params: SignInWithOAuthCredentials = {
        provider: "google",
        options: {
          scopes: GOOGLE_CALENDAR_SCOPES,
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      }

      const { data } = await supabase.auth.getUser()
      const hasGoogleIdentity =
        data.user?.identities?.some((identity) => identity.provider === "google") ?? false
      const auth = supabase.auth as typeof supabase.auth & {
        linkIdentity?: (params: SignInWithOAuthCredentials) => Promise<{ error: { message: string } | null }>
      }

      const result = hasGoogleIdentity
        ? await supabase.auth.signInWithOAuth(params)
        : await auth.linkIdentity?.(params)

      if (!result) {
        sessionStorage.removeItem("googleConnectContext")
        toast.error("Não foi possível iniciar a conexão Google")
        return
      }

      if (result.error) {
        sessionStorage.removeItem("googleConnectContext")
        toast.error(result.error.message || "Erro ao iniciar conexão Google")
      }
    } catch (err) {
      sessionStorage.removeItem("googleConnectContext")
      console.error("[BackofficeAccountContainer][connectGoogle]", err)
      toast.error("Erro inesperado ao conectar Google")
    } finally {
      setIsConnectingGoogle(false)
    }
  }

  async function handleDisconnectGoogle() {
    if (isDisconnectingGoogle) return
    setIsDisconnectingGoogle(true)
    try {
      await disconnectGoogle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar Google")
    } finally {
      setIsDisconnectingGoogle(false)
    }
  }

  async function handleTimezoneChange(timezone: string) {
    if (isUpdatingTimezone || timezone === account?.timezone) return
    setIsUpdatingTimezone(true)
    try {
      await updateTimezone(timezone)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar fuso horário")
    } finally {
      setIsUpdatingTimezone(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-start justify-center px-4 py-10">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Minha conta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Carregando...</CardContent>
        </Card>
      </main>
    )
  }

  if (error || !account) {
    return (
      <main className="flex min-h-screen items-start justify-center px-4 py-10">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Minha conta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">
            {error ?? "Conta não encontrada"}
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen justify-center px-4 py-10">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Minha conta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie seu perfil e configurações do backoffice.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
              <TabsTrigger value="connections">Conexões</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <section className="space-y-4">
                <h2 className="text-base font-semibold">Ícone de perfil</h2>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="h-24 w-24">
                    <AvatarImage
                      src={account.profileIconUrl ?? undefined}
                      alt={account.fullName ?? "Backoffice"}
                    />
                    <AvatarFallback>{initials(account.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => void handleIconChange(event.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Enviar imagem
                    </Button>
                    {account.profileIconUrl ? (
                      <Button type="button" variant="ghost" onClick={() => void removeIcon()}>
                        Remover ícone
                      </Button>
                    ) : null}
                  </div>
                </div>
              </section>

              <Separator />

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="backoffice-account-name">Nome</Label>
                  <Input
                    id="backoffice-account-name"
                    value={form.fullName}
                    onChange={(event) => setField("fullName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backoffice-account-email">Email</Label>
                  <Input
                    id="backoffice-account-email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backoffice-account-phone">Telefone</Label>
                  <Input
                    id="backoffice-account-phone"
                    value={form.phone ?? ""}
                    onChange={(event) => setField("phone", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backoffice-account-document">Documento</Label>
                  <Input
                    id="backoffice-account-document"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={form.cpfCnpj ?? ""}
                    onChange={(event) => setField("cpfCnpj", event.target.value)}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-base font-semibold text-muted-foreground">
                  Endereço (opcional)
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="backoffice-account-postal-code">CEP</Label>
                    <Input
                      id="backoffice-account-postal-code"
                      value={form.postalCode ?? ""}
                      onChange={(event) => setField("postalCode", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backoffice-account-city">Cidade</Label>
                    <Input
                      id="backoffice-account-city"
                      value={form.city ?? ""}
                      onChange={(event) => setField("city", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="backoffice-account-address">Endereço</Label>
                    <Input
                      id="backoffice-account-address"
                      value={form.address ?? ""}
                      onChange={(event) => setField("address", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backoffice-account-number">Número</Label>
                    <Input
                      id="backoffice-account-number"
                      value={form.addressNumber ?? ""}
                      onChange={(event) => setField("addressNumber", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backoffice-account-neighborhood">Bairro</Label>
                    <Input
                      id="backoffice-account-neighborhood"
                      value={form.neighborhood ?? ""}
                      onChange={(event) => setField("neighborhood", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backoffice-account-complement">Complemento</Label>
                    <Input
                      id="backoffice-account-complement"
                      value={form.complement ?? ""}
                      onChange={(event) => setField("complement", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backoffice-account-state">Estado</Label>
                    <Input
                      id="backoffice-account-state"
                      value={form.state ?? ""}
                      onChange={(event) => setField("state", event.target.value)}
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSaveProfile()}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Alterar senha</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Atualize sua senha para manter sua conta segura.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backoffice-account-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="backoffice-account-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backoffice-account-confirm-password">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="backoffice-account-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-4 text-xs text-muted-foreground">
                  <p className="mb-2 text-sm font-medium text-foreground">Requisitos da senha:</p>
                  <p>
                    Mínimo de 6 caracteres, uma letra maiúscula, um número e um caractere especial.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void handleSavePassword()}
                    disabled={
                      isSavingPassword ||
                      !hasStrongPassword(password) ||
                      password !== confirmPassword
                    }
                  >
                    {isSavingPassword ? "Atualizando..." : "Atualizar senha"}
                  </Button>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="connections" className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">Google Calendar</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Conecte sua conta Google para criar reuniões automaticamente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                    {account.googleCalendarConnected ? (
                      <CircleCheckBig className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                    {account.googleCalendarConnected ? "Conectado" : "Não conectado"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {account.googleCalendarConnected
                        ? "Conta vinculada"
                        : "Conectar conta Google"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.googleCalendarConnected
                        ? `Conectado como ${account.googleEmail || account.email}.`
                        : "Usada somente para a agenda do backoffice."}
                    </p>
                  </div>
                  {account.googleCalendarConnected ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="text-destructive"
                          disabled={isDisconnectingGoogle}
                        >
                          Desconectar Google
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Desconectar Google?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Eventos já criados não serão removidos automaticamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDisconnectingGoogle}>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void handleDisconnectGoogle()}
                            disabled={isDisconnectingGoogle}
                          >
                            {isDisconnectingGoogle ? "Desconectando..." : "Desconectar"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleConnectGoogle()}
                      disabled={isConnectingGoogle}
                    >
                      <Link2 className="h-4 w-4" />
                      {isConnectingGoogle ? "Conectando..." : "Conectar Google"}
                    </Button>
                  )}
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">Fuso horário</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Define o horário local usado em agendamentos.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                    {isUpdatingTimezone ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                    {isUpdatingTimezone ? "Salvando..." : selectedTimezoneLabel}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-4">
                  <Label htmlFor="backoffice-account-timezone">Timezone da conta</Label>
                  <Select
                    value={account.timezone}
                    onValueChange={(value) => void handleTimezoneChange(value)}
                    disabled={isUpdatingTimezone}
                  >
                    <SelectTrigger id="backoffice-account-timezone" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  )
}
function useBackofficeAccount(): { account: any; isLoading: any; error: any; updateAccount: any; updatePassword: any; uploadIcon: any; removeIcon: any; updateTimezone: any; disconnectGoogle: any } {
  throw new Error("Function not implemented.")
}

