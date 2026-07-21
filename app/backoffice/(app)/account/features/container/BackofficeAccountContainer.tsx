"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBackofficeAccount } from "../context/BackofficeAccountHook"
import type { BackofficeAccountUpdateInput } from "../context/BackofficeAccountTypes"
import { BackofficeGoogleConnectionCard } from "../components/BackofficeGoogleConnectionCard"

interface ProfileForm {
  fullName: string
  email: string
}

const EMPTY_PROFILE: ProfileForm = {
  fullName: "",
  email: "",
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
  const { account, isLoading, error, updateAccount, updatePassword } = useBackofficeAccount()
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  useEffect(() => {
    if (!account) return
    setProfileForm({
      fullName: account.fullName ?? "",
      email: account.email ?? "",
    })
  }, [account])

  const nameChanged = profileForm.fullName.trim() !== (account?.fullName ?? "")
  const emailChanged = profileForm.email.trim() !== (account?.email ?? "")
  const canSaveProfile =
    (nameChanged || emailChanged) &&
    profileForm.fullName.trim().length >= 2 &&
    profileForm.email.trim().length > 0

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!canSaveProfile || isSavingProfile) return

    setIsSavingProfile(true)
    try {
      const payload: BackofficeAccountUpdateInput = {
        fullName: profileForm.fullName.trim(),
        email: profileForm.email.trim(),
      }
      await updateAccount(payload)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar conta")
    } finally {
      setIsSavingProfile(false)
    }
  }

  function handleCancelProfile() {
    if (!account) return
    setProfileForm({
      fullName: account.fullName ?? "",
      email: account.email ?? "",
    })
  }

  async function handleSavePassword(event: React.FormEvent) {
    event.preventDefault()
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

  function handleCancelPassword() {
    setPassword("")
    setConfirmPassword("")
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card className="mx-auto w-full max-w-3xl">
          <CardHeader className="gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card className="mx-auto w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Minha conta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">
            {error ?? "Conta não encontrada"}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-2xl">Minha conta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie seu perfil, segurança e conexões.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile" className="flex w-full flex-col gap-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
              <TabsTrigger value="connections">Conexões</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="flex flex-col gap-6">
              <form onSubmit={(event) => void handleSaveProfile(event)} className="flex flex-col gap-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="backoffice-account-name">Nome</FieldLabel>
                    <Input
                      id="backoffice-account-name"
                      value={profileForm.fullName}
                      onChange={(event) =>
                        setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      disabled={isSavingProfile}
                    />
                    {profileForm.fullName.length > 0 && profileForm.fullName.trim().length < 2 && (
                      <FieldDescription className="text-destructive">
                        Mínimo de 2 caracteres
                      </FieldDescription>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="backoffice-account-email">E-mail</FieldLabel>
                    <Input
                      id="backoffice-account-email"
                      type="email"
                      value={profileForm.email}
                      onChange={(event) =>
                        setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="seu@email.com"
                      autoComplete="email"
                      disabled={isSavingProfile}
                    />
                  </Field>
                </FieldGroup>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelProfile}
                    disabled={isSavingProfile || (!nameChanged && !emailChanged)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={!canSaveProfile || isSavingProfile}>
                    {isSavingProfile ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="security" className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-medium">Alterar senha</h2>
                <p className="text-sm text-muted-foreground">
                  Atualize sua senha para manter sua conta segura.
                </p>
              </div>

              <Separator />

              <form onSubmit={(event) => void handleSavePassword(event)} className="flex flex-col gap-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="backoffice-account-password">Nova senha</FieldLabel>
                    <div className="relative">
                      <Input
                        id="backoffice-account-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={isSavingPassword}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0"
                        onClick={() => setShowPassword((prev) => !prev)}
                        disabled={isSavingPassword}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
                      </Button>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="backoffice-account-confirm-password">
                      Confirmar nova senha
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="backoffice-account-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={isSavingPassword}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        disabled={isSavingPassword}
                        aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff data-icon="inline-start" />
                        ) : (
                          <Eye data-icon="inline-start" />
                        )}
                      </Button>
                    </div>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <FieldDescription className="text-destructive">
                        As senhas não coincidem
                      </FieldDescription>
                    )}
                  </Field>
                </FieldGroup>

                <div className="rounded-lg border border-border/60 p-4 text-xs text-muted-foreground">
                  <p className="mb-2 text-sm font-medium text-foreground">Requisitos da senha:</p>
                  <p>
                    Mínimo de 6 caracteres, uma letra maiúscula, um número e um caractere especial.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelPassword}
                    disabled={isSavingPassword || (!password && !confirmPassword)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSavingPassword ||
                      !hasStrongPassword(password) ||
                      password !== confirmPassword
                    }
                  >
                    {isSavingPassword ? "Atualizando..." : "Atualizar senha"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="connections" className="flex flex-col gap-6">
              <BackofficeGoogleConnectionCard account={account} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
