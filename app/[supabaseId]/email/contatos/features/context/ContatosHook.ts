"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ContatosService } from "../services/ContatosService";
import type { ContactList, Contact, ContatosState } from "./ContatosTypes";

const PAGE_SIZE = 50;
const service = new ContatosService();

export type ContatosActions = {
  handleCreateList: (name: string, description?: string) => Promise<void>
  handleDeleteList: (id: string) => Promise<void>
  handleSelectList: (id: string) => void
  handleUploadCsv: (file: File) => Promise<void>
  handleDeleteContact: (contactId: string) => Promise<void>
  handleAddContact: (email: string, name?: string) => Promise<void>
  handleSearch: (query: string) => void
  handlePageChange: (page: number) => void
}

export type ContatosHookReturn = ContatosState & ContatosActions

export function useContatos(supabaseId: string): ContatosHookReturn {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  const fetchingListsRef = useRef(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    async (listId: string, nextPage: number, nextSearch: string) => {
      setLoadingContacts(true);
      console.info("[useContatos] fetchContacts", { listId, nextPage, nextSearch });
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
      } catch (error) {
        console.error("[useContatos] fetchContacts error", error);
        toast.error("Erro ao carregar contatos");
      } finally {
        setLoadingContacts(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchLists();
  }, [supabaseId]);

  useEffect(() => {
    if (!selectedListId) {
      setContacts([]);
      setTotalContacts(0);
      setPage(1);
      setTotalPages(1);
      setSearch("");
      return;
    }
    void fetchContacts(selectedListId, 1, "");
    setSearch("");
    setPage(1);
  }, [selectedListId, fetchContacts]);

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
        toast.error("Erro ao excluir lista");
        throw error;
      }
    },
    [fetchLists, selectedListId]
  );

  const handleUploadCsv = useCallback(
    async (file: File) => {
      if (!selectedListId) return;
      setUploadingCsv(true);
      console.info("[useContatos] handleUploadCsv", file.name);
      try {
        const result = await service.uploadCsv(selectedListId, file);
        toast.success(
          `Importação concluída: ${result.imported} adicionados, ${result.updated} atualizados (total: ${result.total})`
        );
        await fetchLists();
        void fetchContacts(selectedListId, 1, search);
        setPage(1);
      } catch (error) {
        console.error("[useContatos] handleUploadCsv error", error);
        toast.error("Erro ao importar arquivo CSV");
      } finally {
        setUploadingCsv(false);
      }
    },
    [selectedListId, fetchLists, fetchContacts, search]
  );

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
        const message = error instanceof Error ? error.message : "Erro ao adicionar contato";
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

  return {
    lists,
    selectedListId,
    contacts,
    totalContacts,
    page,
    totalPages,
    search,
    loadingLists,
    loadingContacts,
    uploadingCsv,
    deletingContactId,
    handleCreateList,
    handleDeleteList,
    handleSelectList,
    handleUploadCsv,
    handleDeleteContact,
    handleAddContact,
    handleSearch,
    handlePageChange,
  };
}
