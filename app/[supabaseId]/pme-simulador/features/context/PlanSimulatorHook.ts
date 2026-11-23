"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { isManagerLikeRole } from "@/lib/roles";
import { EMPTY_FILTERS, type SimulationFilters } from "@/lib/planSimulator/planSimulator";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";
import type { IPlanSimulatorService, PlanSimulatorHeaders } from "../services/IPlanSimulatorService";
import type {
  PlanDetail,
  PlanSimulatorView,
  QuoteDetail,
  SimulationRow,
  QuoteListItem,
  QuoteState,
  SimulationResponse,
} from "./PlanSimulatorTypes";

const emptyLives = () => Array.from({ length: 10 }, () => 0);

export function emptyQuoteState(): QuoteState {
  return { lives: emptyLives(), uf: "", filters: EMPTY_FILTERS, sel: [] };
}

function stateFromDetail(detail: QuoteDetail): QuoteState {
  return detail.state ?? emptyQuoteState();
}

export function usePlanSimulatorHook(service: IPlanSimulatorService) {
  const { user } = useUserContext();
  const { activeTeamId, activeFunctions } = useTeamContext();

  const headers: PlanSimulatorHeaders | null = user?.supabaseId && activeTeamId
    ? { supabaseId: user.supabaseId, teamId: activeTeamId }
    : null;
  const isAllowed = isManagerLikeRole(user?.role) || activeFunctions.includes("SDR") || activeFunctions.includes("CLOSER");

  const [view, setView] = useState<PlanSimulatorView>("home");
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [nome, setNomeState] = useState("");
  const [draft, setDraft] = useState<QuoteState>(emptyQuoteState);
  const [sim, setSim] = useState<SimulationResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sendOpen, setSendOpenState] = useState(false);
  /** Fechar o envio descarta o link: a próxima abertura gera um link com o estado atual. */
  const setSendOpen = useCallback((open: boolean) => {
    setSendOpenState(open);
    if (!open) setShareUrl(null);
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  // Linhas já vistas em alguma simulação: mantém o nome dos planos incluídos quando os filtros os escondem.
  const [seenRows, setSeenRows] = useState<Record<string, SimulationRow>>({});
  // Nome dos hospitais já escolhidos como referência (para os chips).
  const [hospNames, setHospNames] = useState<Record<number, string>>({});
  const dirty = useRef(false);
  const nameDirty = useRef(false);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await action();
      } catch (error) {
        setMessage(toUserToastMessage(error));
        return undefined;
      }
    },
    [],
  );

  const loadQuotes = useCallback(async () => {
    if (!headers) return;
    const list = await run(() => service.listQuotes(headers));
    if (list) setQuotes(list);
  }, [headers, run, service]);

  useEffect(() => {
    if (isAllowed && view === "home") void loadQuotes();
  }, [isAllowed, view, loadQuotes]);

  // Simulação com debounce: só roda na tela de resultados, e só quando há UF e vidas.
  useEffect(() => {
    if (view === "home" || !headers || !draft.uf || draft.lives.every((n) => n === 0)) {
      setSim(null);
      setSimLoading(false);
      return;
    }
    // Uma resposta só vale se nenhuma entrada mudou depois que a requisição saiu:
    // o debounce cancela só o timer, não a requisição já em voo.
    let superseded = false;
    const timer = setTimeout(() => {
      setSimLoading(true);
      void run(() => service.simulate(headers, { uf: draft.uf, lives: draft.lives, filters: draft.filters })).then((result) => {
        if (superseded) return;
        if (result) {
          setSim(result);
          setSeenRows((prev) => {
            const next = { ...prev };
            for (const row of result.rows) next[row.chave] = row;
            return next;
          });
        }
        setSimLoading(false);
      });
    }, 250);
    return () => {
      superseded = true;
      clearTimeout(timer);
    };
    // headers é recriado a cada render; usamos seus campos.
  }, [view, draft, headers?.supabaseId, headers?.teamId, run, service]);

  // Salvamento automático de uma cotação já criada.
  useEffect(() => {
    if (view !== "results" || !quoteId || !headers || !dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      setSaving(true);
      void run(() => service.updateQuote(headers, quoteId, { state: draft })).finally(() => setSaving(false));
    }, 600);
    return () => clearTimeout(timer);
  }, [draft, quoteId, view, run, service]);

  // Salvamento do nome com debounce, separado do estado da simulação.
  useEffect(() => {
    if (view !== "results" || !quoteId || !headers || !nameDirty.current || !nome.trim()) return;
    const timer = setTimeout(() => {
      nameDirty.current = false;
      void run(() => service.updateQuote(headers, quoteId, { nome: nome.trim() }));
    }, 600);
    return () => clearTimeout(timer);
  }, [nome, quoteId, view, run, service]);

  const edit = useCallback((next: (current: QuoteState) => QuoteState) => {
    dirty.current = true;
    setDraft((current) => next(current));
  }, []);

  const openNew = useCallback(() => {
    setQuoteId(null);
    setNomeState("");
    setDraft(emptyQuoteState());
    setShareUrl(null);
    setView("wizard");
  }, []);

  const openQuote = useCallback(
    async (id: string) => {
      if (!headers) return;
      const detailResult = await run(() => service.getQuote(headers, id));
      if (!detailResult) return;
      setQuoteId(id);
      setNomeState(detailResult.nome);
      setDraft(stateFromDetail(detailResult));
      setShareUrl(null);
      setView("results");
    },
    [headers, run, service],
  );

  /** Passo 1 → 2 → resultados: cria a cotação no primeiro "Continuar" com UF e vidas. */
  const finishWizard = useCallback(async () => {
    if (!headers) return;
    const now = new Date();
    const defaultName = `Cotação ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    const created = await run(() => service.createQuote(headers, nome.trim() || defaultName, draft));
    if (!created) return;
    setQuoteId(created.id);
    setNomeState(created.nome);
    setView("results");
  }, [draft, headers, nome, run, service]);

  const renameQuote = useCallback((value: string) => {
    nameDirty.current = true;
    setNomeState(value);
  }, []);

  const duplicate = useCallback(async (id: string) => {
    if (!headers) return;
    const copy = await run(() => service.duplicateQuote(headers, id));
    if (copy) await loadQuotes();
  }, [headers, loadQuotes, run, service]);

  const remove = useCallback(async (id: string) => {
    if (!headers) return;
    const ok = await run(() => service.deleteQuote(headers, id));
    if (ok === undefined) return;
    await loadQuotes();
  }, [headers, loadQuotes, run, service]);

  const share = useCallback(async () => {
    if (!headers || !quoteId) return;
    // Garante que o snapshot é gerado com o estado mais recente.
    await run(() => service.updateQuote(headers, quoteId, { state: draft }));
    const result = await run(() => service.shareQuote(headers, quoteId));
    if (result) setShareUrl(`${window.location.origin}/cotacao/${result.token}`);
  }, [draft, headers, quoteId, run, service]);

  const searchHospitals = useCallback(async (q: string) => {
    if (!headers || !draft.uf) return [];
    const hits = (await run(() => service.searchProviders(headers, q, draft.uf))) ?? [];
    setHospNames((prev) => {
      const next = { ...prev };
      for (const h of hits) next[h.id] = h.nome;
      return next;
    });
    return hits;
  }, [draft.uf, headers, run, service]);

  const openDetail = useCallback(async (chave: string) => {
    if (!headers) return;
    const result = await run(() => service.tableDetail(headers, chave));
    if (result) setDetail(result);
  }, [headers, run, service]);

  const toggleSel = useCallback((chave: string) => {
    if (!draft.sel.includes(chave) && draft.sel.length >= 40) {
      setMessage("Você pode incluir até 40 planos na proposta.");
      return;
    }
    edit((current) => ({
      ...current,
      sel: current.sel.includes(chave) ? current.sel.filter((c) => c !== chave) : [...current.sel, chave],
    }));
  }, [draft.sel, edit]);

  const setLives = useCallback((index: number, value: number) => {
    edit((current) => {
      const lives = [...current.lives];
      lives[index] = Math.max(0, Math.min(999, value));
      return { ...current, lives };
    });
  }, [edit]);

  const patchFilters = useCallback((patch: Partial<SimulationFilters>) => {
    edit((current) => ({ ...current, filters: { ...current.filters, ...patch } }));
  }, [edit]);

  const clearFilters = useCallback(() => {
    edit((current) => ({ ...current, filters: { ...EMPTY_FILTERS, respeitarMinimoVidas: current.filters.respeitarMinimoVidas } }));
  }, [edit]);

  const hasActiveFilters = useMemo(
    () =>
      draft.filters.acomodacoes.length > 0 ||
      draft.filters.coparticipacoes.length > 0 ||
      draft.filters.contratacoes.length > 0 ||
      draft.filters.hospitalIds.length > 0 ||
      draft.filters.mei ||
      draft.filters.valorMin != null ||
      draft.filters.valorMax != null,
    [draft.filters],
  );

  const setUf = useCallback((uf: string) => {
    edit((current) => ({ ...current, uf, sel: [] }));
  }, [edit]);

  const goHome = useCallback(() => {
    setView("home");
    setSim(null);
  }, []);

  const totalVidas = useMemo(() => draft.lives.reduce((a, b) => a + b, 0), [draft.lives]);

  return {
    isAllowed,
    headers,
    view,
    setView,
    quotes,
    quoteId,
    nome,
    draft,
    sim,
    simLoading,
    saving,
    busy,
    setBusy,
    detail,
    setDetail,
    shareUrl,
    sendOpen,
    setSendOpen,
    message,
    setMessage,
    totalVidas,
    openNew,
    openQuote,
    finishWizard,
    renameQuote,
    duplicate,
    remove,
    share,
    openDetail,
    searchHospitals,
    seenRows,
    hospNames,
    toggleSel,
    setLives,
    patchFilters,
    setUf,
    clearFilters,
    hasActiveFilters,
    goHome,
  };
}

export type PlanSimulatorHookValue = ReturnType<typeof usePlanSimulatorHook>;
