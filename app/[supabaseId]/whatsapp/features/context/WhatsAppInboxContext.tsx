"use client"

import { createContext, useContext, useMemo } from 'react'
import { useWhatsAppInbox } from './WhatsAppInboxHook'
import type { InboxState, InboxActions } from './WhatsAppInboxTypes'

type WhatsAppInboxContextValue = InboxState & InboxActions

const WhatsAppInboxContext = createContext<WhatsAppInboxContextValue | null>(null)

interface WhatsAppInboxProviderProps {
  supabaseId: string
  children: React.ReactNode
}

export function WhatsAppInboxProvider({ supabaseId, children }: WhatsAppInboxProviderProps) {
  const hook = useWhatsAppInbox(supabaseId)

  // Stabilize the context value so external re-renders of this Provider's
  // parent don't propagate to all consumers when hook state is unchanged.
  // Actions from useCallback are stable; state fields change only on mutation.
  const value = useMemo<WhatsAppInboxContextValue>(
    () => ({
      // state
      config: hook.config,
      conversations: hook.conversations,
      selectedConversationId: hook.selectedConversationId,
      selectedConversation: hook.selectedConversation,
      messages: hook.messages,
      totalConversations: hook.totalConversations,
      isLoadingConfig: hook.isLoadingConfig,
      isLoadingConversations: hook.isLoadingConversations,
      isLoadingMessages: hook.isLoadingMessages,
      isLoadingOlderMessages: hook.isLoadingOlderMessages,
      hasMoreMessages: hook.hasMoreMessages,
      isSending: hook.isSending,
      searchQuery: hook.searchQuery,
      filterMode: hook.filterMode,
      filterTagIds: hook.filterTagIds,
      teamTags: hook.teamTags,
      isLoadingTags: hook.isLoadingTags,
      isUpdatingTags: hook.isUpdatingTags,
      page: hook.page,
      hasMoreConversations: hook.hasMoreConversations,
      isAssigning: hook.isAssigning,
      isChangingHandoff: hook.isChangingHandoff,
      isLinkingLead: hook.isLinkingLead,
      isCreatingLead: hook.isCreatingLead,
      isUpdatingContactName: hook.isUpdatingContactName,
      isArchiving: hook.isArchiving,
      isDeleting: hook.isDeleting,
      teamMembers: hook.teamMembers,
      isLoadingTeamMembers: hook.isLoadingTeamMembers,
      currentProfileId: hook.currentProfileId,
      activeTeamId: hook.activeTeamId,
      supabaseId: hook.supabaseId,
      canManageAssignment: hook.canManageAssignment,
      isCreatingConversation: hook.isCreatingConversation,
      isSyncingContacts: hook.isSyncingContacts,
      isSyncingGroupParticipants: hook.isSyncingGroupParticipants,
      isLoadingContacts: hook.isLoadingContacts,
      contacts: hook.contacts,
      contactLookup: hook.contactLookup,
      isTeamMaster: hook.isTeamMaster,
      unreadTotal: hook.unreadTotal,
      allUnreadTotal: hook.allUnreadTotal,
      mineUnreadTotal: hook.mineUnreadTotal,
      replyTarget: hook.replyTarget,
      contactIsTyping: hook.contactIsTyping,
      // actions
      selectConversation: hook.selectConversation,
      loadMoreConversations: hook.loadMoreConversations,
      loadOlderMessages: hook.loadOlderMessages,
      sendMessage: hook.sendMessage,
      resendMessage: hook.resendMessage,
      setReplyTarget: hook.setReplyTarget,
      setSearchQuery: hook.setSearchQuery,
      setFilterMode: hook.setFilterMode,
      setFilterTagIds: hook.setFilterTagIds,
      loadTeamTags: hook.loadTeamTags,
      setConversationTags: hook.setConversationTags,
      assignConversation: hook.assignConversation,
      takeoverConversation: hook.takeoverConversation,
      setHandoffMode: hook.setHandoffMode,
      loadTeamMembers: hook.loadTeamMembers,
      linkLead: hook.linkLead,
      createLeadFromConversation: hook.createLeadFromConversation,
      updateContactName: hook.updateContactName,
      searchLeads: hook.searchLeads,
      archiveConversation: hook.archiveConversation,
      unarchiveConversation: hook.unarchiveConversation,
      deleteConversation: hook.deleteConversation,
      createConversation: hook.createConversation,
      syncPhoneContacts: hook.syncPhoneContacts,
      syncGroupParticipants: hook.syncGroupParticipants,
      loadContacts: hook.loadContacts,
      searchInbox: hook.searchInbox,
    }),
    [
      hook.config, hook.conversations, hook.selectedConversationId, hook.selectedConversation,
      hook.messages, hook.totalConversations, hook.isLoadingConfig, hook.isLoadingConversations,
      hook.isLoadingMessages, hook.isLoadingOlderMessages, hook.hasMoreMessages, hook.isSending,
      hook.searchQuery, hook.filterMode, hook.filterTagIds, hook.teamTags, hook.isLoadingTags,
      hook.isUpdatingTags, hook.page, hook.hasMoreConversations, hook.isAssigning,
      hook.isChangingHandoff, hook.isLinkingLead, hook.isCreatingLead, hook.isUpdatingContactName,
      hook.isArchiving, hook.isDeleting, hook.teamMembers, hook.isLoadingTeamMembers,
      hook.currentProfileId, hook.activeTeamId, hook.supabaseId, hook.canManageAssignment,
      hook.isCreatingConversation, hook.isSyncingContacts, hook.isSyncingGroupParticipants,
      hook.isLoadingContacts, hook.contacts, hook.contactLookup, hook.isTeamMaster,
      hook.unreadTotal, hook.allUnreadTotal, hook.mineUnreadTotal, hook.replyTarget, hook.contactIsTyping,
      hook.selectConversation, hook.loadMoreConversations, hook.loadOlderMessages,
      hook.sendMessage, hook.resendMessage, hook.setReplyTarget, hook.setSearchQuery,
      hook.setFilterMode, hook.setFilterTagIds, hook.loadTeamTags, hook.setConversationTags,
      hook.assignConversation, hook.takeoverConversation, hook.setHandoffMode,
      hook.loadTeamMembers, hook.linkLead, hook.createLeadFromConversation,
      hook.updateContactName, hook.searchLeads, hook.archiveConversation,
      hook.unarchiveConversation, hook.deleteConversation, hook.createConversation,
      hook.syncPhoneContacts, hook.syncGroupParticipants, hook.loadContacts, hook.searchInbox,
    ]
  )

  return (
    <WhatsAppInboxContext.Provider value={value}>
      {children}
    </WhatsAppInboxContext.Provider>
  )
}

export function useWhatsAppInboxContext(): WhatsAppInboxContextValue {
  const context = useContext(WhatsAppInboxContext)
  if (!context) {
    throw new Error('useWhatsAppInboxContext must be used within a WhatsAppInboxProvider')
  }
  return context
}
