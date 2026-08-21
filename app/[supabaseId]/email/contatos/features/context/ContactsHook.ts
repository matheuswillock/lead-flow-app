"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";
import { ContatosService } from "../services/ContatosService";
import type { ContactList, Contact, ContactsState } from "./ContatosTypes";
import { useOptionalStudioEmailHost } from "@/lib/email/studio-email-host";
import {
  decideContactsFetch,
  type ContactsRefreshRequest,
} from "../utils/contact-import-refresh";
import {
  onContactListsPolled,
  shouldPollContactLists,
} from "../utils/contact-import-flow";

const PAGE_SIZE = 50;
const defaultService = new ContatosService();

export type ContactsActions = {
  handleCreateList: (name: string, description?: string) => Promise<void>
  handleDeleteList: (id: string) => Promise<void>
  handleAddContact: (email: string, name?: string) => Promise<void>
  handleSelectList: (id: string) => void
  handleDeleteContact: (contactId: string) => Promise<void>
  handleSearch: (query: string) => void
  handlePageChange: (page: number) => void
  refreshSelectedList: () => Promise<void>
  handleSetListSegment: (listId: string, segmentId: string | null) => Promise<void>
}

export type ContactsHookReturn = ContactsState & ContactsActions & { supabaseId: string }

export function useContacts(supabaseId: string): ContactsHookReturn {
  const host = useOptionalStudioEmailHost();
  const service = host?.services.contatos ?? defaultService;
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  const fetchingListsRef = useRef(false);
  const fetchingContactsRef = useRef(false);
  const lastContactsKeyRef = useRef("");
  const lastImportProgressKeyRef = useRef("");
  const pendingContactsRefreshRef = useRef<ContactsRefreshRequest | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(page);
  const searchRef = useRef(search);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const fetchLists = useCallback(async () => {
    if (fetchingListsRef.current) return;
    fetchingListsRef.current = true;
    setLoadingLists(true);
    console.info("[useContatos] fetchLists");
    try {
      const result = await service.getLists();
      setLists(result);
    } catch (error) {
      console.error("[useContatos] fetchLists error", error);
      toast.error("Erro ao carregar listas de contatos");
    } finally {
      setLoadingLists(false);
      fetchingListsRef.current = false;
    }
  }, []);

  const fetchContacts = useCallback(
    async (
      listId: string,
      nextPage: number,
      nextSearch: string,
      options?: { force?: boolean }
    ) => {
      const force = Boolean(options?.force);
      const decision = decideContactsFetch({
        isFetchingContacts: fetchingContactsRef.current,
        force,
        listId,
        page: nextPage,
        search: nextSearch,
        lastContactsKey: lastContactsKeyRef.current,
        pendingRefresh: pendingContactsRefreshRef.current,
      });

      if (decision.action === "none") return;
      if (decision.action === "queue" && decision.request) {
        pendingContactsRefreshRef.current = decision.request;
        return;
      }

      const key = `${listId}|${nextPage}|${nextSearch}`;
      fetchingContactsRef.current = true;
      setLoadingContacts(true);
      console.info("[useContatos] fetchContacts", {
        listId,
        nextPage,
        nextSearch,
        force,
      });
      try {
        const result = await service.getContacts(
          listId,
          nextPage,
          PAGE_SIZE,
          nextSearch
        );
        setContacts(result.contacts);
        setTotalContacts(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
        lastContactsKeyRef.current = key;
      } catch (error) {
        console.error("[useContatos] fetchContacts error", error);
        toast.error("Erro ao carregar contatos");
      } finally {
        setLoadingContacts(false);
        fetchingContactsRef.current = false;
        const pending = pendingContactsRefreshRef.current;
        if (pending) {
          pendingContactsRefreshRef.current = null;
          void fetchContacts(pending.listId, pending.page, pending.search, {
            force: pending.force,
          });
        }
      }
    },
    []
  );

  useEffect(() => {
    void fetchLists();
  }, [supabaseId, fetchLists]);

  const hasActiveImport = shouldPollContactLists(lists);

  useEffect(() => {
    if (!hasActiveImport) return;

    const intervalId = setInterval(() => {
      void fetchLists();
    }, 10_000);

    return () => clearInterval(intervalId);
  }, [hasActiveImport, fetchLists]);

  useEffect(() => {
    if (!selectedListId) {
      setContacts([]);
      setTotalContacts(0);
      setPage(1);
      setTotalPages(1);
      setSearch("");
      lastContactsKeyRef.current = "";
      lastImportProgressKeyRef.current = "";
      pendingContactsRefreshRef.current = null;
      return;
    }
    lastContactsKeyRef.current = "";
    lastImportProgressKeyRef.current = "";
    pendingContactsRefreshRef.current = null;
    void fetchContacts(selectedListId, 1, "");
    setSearch("");
    setPage(1);
  }, [selectedListId, fetchContacts]);

  useEffect(() => {
    const result = onContactListsPolled(
      {
        selectedListId,
        page: pageRef.current,
        search: searchRef.current,
        lastProgressKey: lastImportProgressKeyRef.current,
        isFetchingContacts: fetchingContactsRef.current,
        pendingRefresh: pendingContactsRefreshRef.current,
      },
      lists
    );

    lastImportProgressKeyRef.current = result.nextState.lastProgressKey;

    // A fila de fetch fica só em fetchContacts/decideContactsFetch, para não
    // sobrescrever page/search enfileirados pela navegação do usuário.
    if (
      (result.action === "fetch" || result.action === "queue") &&
      (result.request || result.nextState.pendingRefresh)
    ) {
      const request = result.request ?? result.nextState.pendingRefresh;
      if (!request) return;
      void fetchContacts(request.listId, request.page, request.search, {
        force: true,
      });
    }
  }, [lists, selectedListId, fetchContacts]);

  const handleSelectList = useCallback((id: string) => {
    setSelectedListId(id);
  }, []);

  const handleCreateList = useCallback(
    async (name: string, description?: string) => {
      console.info("[useContatos] handleCreateList", name);
      try {
        const created = await service.createList({ name, description });
        await fetchLists();
        setSelectedListId(created.id);
        toast.success(`Lista "${created.name}" criada com sucesso`);
      } catch (error) {
        console.error("[useContatos] handleCreateList error", error);
        toast.error("Erro ao criar lista de contatos");
        throw error;
      }
    },
    [fetchLists]
  );

  const handleDeleteList = useCallback(
    async (id: string) => {
      console.info("[useContatos] handleDeleteList", id);
      try {
        await service.deleteList(id);
        await fetchLists();
        if (selectedListId === id) {
          setSelectedListId(null);
        }
        toast.success("Lista excluída com sucesso");
      } catch (error) {
        console.error("[useContatos] handleDeleteList error", error);
        const message = toUserToastMessage(error);
        toast.error(message);
        throw error;
      }
    },
    [fetchLists, selectedListId]
  );

  const refreshSelectedList = useCallback(async () => {
    await fetchLists();
    if (selectedListId) {
      await fetchContacts(selectedListId, page, search, { force: true });
    }
  }, [fetchLists, fetchContacts, selectedListId, page, search]);

  const handleDeleteContact = useCallback(
    async (contactId: string) => {
      if (!selectedListId) return;
      setDeletingContactId(contactId);
      console.info("[useContatos] handleDeleteContact", contactId);
      try {
        await service.deleteContact(selectedListId, contactId);
        setContacts((prev) => prev.filter((c) => c.id !== contactId));
        setTotalContacts((prev) => Math.max(0, prev - 1));
        setLists((prev) =>
          prev.map((l) =>
            l.id === selectedListId
              ? { ...l, totalContacts: Math.max(0, l.totalContacts - 1) }
              : l
          )
        );
        toast.success("Contato removido");
      } catch (error) {
        console.error("[useContatos] handleDeleteContact error", error);
        toast.error("Erro ao remover contato");
      } finally {
        setDeletingContactId(null);
      }
    },
    [selectedListId]
  );

  const handleAddContact = useCallback(
    async (email: string, name?: string) => {
      if (!selectedListId) return;
      console.info("[useContatos] handleAddContact", { email });
      try {
        await service.addContact(selectedListId, email, name);
        await fetchLists();
        void fetchContacts(selectedListId, page, search);
        toast.success("Contato adicionado com sucesso");
      } catch (error) {
        console.error("[useContatos] handleAddContact error", error);
        const message = toUserToastMessage(error);
        toast.error(message);
        throw error;
      }
    },
    [selectedListId, fetchLists, fetchContacts, page, search]
  );

  const handleSearch = useCallback(
    (query: string) => {
      setSearch(query);
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = setTimeout(() => {
        if (selectedListId) {
          lastContactsKeyRef.current = "";
          void fetchContacts(selectedListId, 1, query);
          setPage(1);
        }
      }, 300);
    },
    [selectedListId, fetchContacts]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (!selectedListId) return;
      setPage(nextPage);
      void fetchContacts(selectedListId, nextPage, search);
    },
    [selectedListId, fetchContacts, search]
  );

  const handleSetListSegment = useCallback(
    async (listId: string, segmentId: string | null) => {
      console.info("[useContatos] handleSetListSegment", { listId, segmentId });
      try {
        await service.setListRadarSegment(listId, segmentId);
        await fetchLists();
        toast.success(segmentId ? "Segmento vinculado à lista" : "Segmento desvinculado da lista");
      } catch (error) {
        console.error("[useContatos] handleSetListSegment error", error);
        toast.error("Erro ao vincular segmento à lista");
        throw error;
      }
    },
    [fetchLists]
  );

  return {
    supabaseId,
    lists,
    selectedListId,
    contacts,
    totalContacts,
    page,
    totalPages,
    search,
    loadingLists,
    loadingContacts,
    deletingContactId,
    handleCreateList,
    handleDeleteList,
    handleAddContact,
    handleSelectList,
    handleDeleteContact,
    handleSearch,
    handlePageChange,
    refreshSelectedList,
    handleSetListSegment,
  };
}
