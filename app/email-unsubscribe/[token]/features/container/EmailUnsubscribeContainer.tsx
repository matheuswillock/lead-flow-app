"use client"

import { EmailUnsubscribePageView } from "@/components/email/EmailUnsubscribePageView"
import { useEmailUnsubscribeContext } from "../context/EmailUnsubscribeContext"

export function EmailUnsubscribeContainer() {
  const {
    loading,
    confirming,
    info,
    completed,
    error,
    removeFromCampaign,
    removeFromAll,
    setRemoveFromCampaign,
    setRemoveFromAll,
    handleConfirm,
  } = useEmailUnsubscribeContext()

  if (loading) {
    return (
      <EmailUnsubscribePageView
        mode="loading"
        removeFromCampaign={removeFromCampaign}
        removeFromAll={removeFromAll}
        interactive={false}
      />
    )
  }

  if (error && !info) {
    return (
      <EmailUnsubscribePageView
        mode="error"
        errorMessage={error}
        removeFromCampaign={removeFromCampaign}
        removeFromAll={removeFromAll}
        interactive={false}
      />
    )
  }

  if (completed) {
    return (
      <EmailUnsubscribePageView
        mode="success"
        removeFromCampaign={removeFromCampaign}
        removeFromAll={removeFromAll}
        interactive={false}
      />
    )
  }

  return (
    <EmailUnsubscribePageView
      mode="confirm"
      maskedEmail={info?.maskedEmail}
      teamName={info?.teamName}
      removeFromCampaign={removeFromCampaign}
      removeFromAll={removeFromAll}
      confirming={confirming}
      interactive
      onRemoveFromCampaignChange={setRemoveFromCampaign}
      onRemoveFromAllChange={setRemoveFromAll}
      onConfirm={() => void handleConfirm()}
    />
  )
}
