"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import type { IEmailSettingsService, UpsertEmailSenderData } from "../services/IEmailSettingsService"
import type { EmailSender } from "./EmailSettingsTypes"

type IdentitySettingsService = Pick<
  IEmailSettingsService,
  "createSender" | "updateSender" | "deleteSender" | "setDefaultSender"
>

type IdentitySettingsOptions = {
  service: IdentitySettingsService
  reload: () => Promise<void>
  getSenderErrorMessage: (error: unknown) => string
}

export function useEmailIdentitySettings(options: IdentitySettingsOptions) {
  const [senders, setSenders] = useState<EmailSender[]>([])
  const [defaultSenderId, setDefaultSenderId] = useState<string | null>(null)
  const [creatingSender, setCreatingSender] = useState(false)
  const [updatingSenderId, setUpdatingSenderId] = useState<string | null>(null)
  const [deletingSenderId, setDeletingSenderId] = useState<string | null>(null)
  const [settingDefaultSenderId, setSettingDefaultSenderId] = useState<string | null>(null)
  const [senderErrorMessage, setSenderErrorMessage] = useState<string | null>(null)

  const apply = useCallback((nextSenders: EmailSender[], nextDefaultSenderId: string | null) => {
    setSenders(nextSenders)
    setDefaultSenderId(nextDefaultSenderId)
  }, [])

  const handleCreateSender = useCallback(async (data: UpsertEmailSenderData) => {
    setCreatingSender(true)
    setSenderErrorMessage(null)
    try {
      await options.service.createSender(data)
      await options.reload()
      toast.success("Remetente criado com sucesso")
    } catch (error) {
      console.error("[useEmailIdentitySettings] createSender", error)
      const message = options.getSenderErrorMessage(error)
      setSenderErrorMessage(message)
      toast.error(message)
    } finally {
      setCreatingSender(false)
    }
  }, [options])

  const handleUpdateSender = useCallback(async (senderId: string, data: UpsertEmailSenderData) => {
    setUpdatingSenderId(senderId)
    setSenderErrorMessage(null)
    try {
      await options.service.updateSender(senderId, data)
      await options.reload()
      toast.success("Remetente atualizado com sucesso")
    } catch (error) {
      console.error("[useEmailIdentitySettings] updateSender", error)
      const message = options.getSenderErrorMessage(error)
      setSenderErrorMessage(message)
      toast.error(message)
    } finally {
      setUpdatingSenderId(null)
    }
  }, [options])

  const handleDeleteSender = useCallback(async (senderId: string) => {
    setDeletingSenderId(senderId)
    setSenderErrorMessage(null)
    try {
      await options.service.deleteSender(senderId)
      await options.reload()
      toast.success("Remetente removido com sucesso")
    } catch (error) {
      console.error("[useEmailIdentitySettings] deleteSender", error)
      toastUserError(error)
    } finally {
      setDeletingSenderId(null)
    }
  }, [options])

  const handleSetDefaultSender = useCallback(async (senderId: string) => {
    setSettingDefaultSenderId(senderId)
    setSenderErrorMessage(null)
    try {
      const updated = await options.service.setDefaultSender(senderId)
      apply(updated.senders ?? [], updated.defaultSenderId ?? null)
      toast.success("Remetente padrão atualizado")
    } catch (error) {
      console.error("[useEmailIdentitySettings] setDefaultSender", error)
      toastUserError(error)
    } finally {
      setSettingDefaultSenderId(null)
    }
  }, [apply, options])

  return {
    senders,
    defaultSenderId,
    creatingSender,
    updatingSenderId,
    deletingSenderId,
    settingDefaultSenderId,
    senderErrorMessage,
    clearSenderErrorMessage: () => setSenderErrorMessage(null),
    apply,
    handleCreateSender,
    handleUpdateSender,
    handleDeleteSender,
    handleSetDefaultSender,
  }
}
