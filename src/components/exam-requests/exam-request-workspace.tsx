"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ExamRequestDocument } from "@/components/exam-requests/exam-request-document";
import type { ExamCatalogItem, ExamRequestView } from "@/features/exam-requests/contracts";

const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

function examKey(value: string) {
  return value.trim().replace(/\s+/gu, " ").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("pt-BR");
}

export function addExamWithoutDuplicate(current: readonly string[], value: string) {
  const exam = value.trim();
  if (!exam || current.some((item) => examKey(item) === examKey(exam))) return [...current];
  return [...current, exam];
}

export function moveExam(current: readonly string[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || index >= current.length || target < 0 || target >= current.length) return [...current];
  const next = [...current];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function matchesCatalogSearch(item: ExamCatalogItem, search: string) {
  const key = examKey(search);
  return !key || [item.name, item.category, ...item.synonyms]
    .some((value) => examKey(value).includes(key));
}

function catalogSynonyms(value: string) {
  const unique = new Map<string, string>();
  for (const entry of value.split(/[\n,;]/u)) {
    const synonym = entry.trim().replace(/\s+/gu, " ");
    if (synonym && !unique.has(examKey(synonym))) unique.set(examKey(synonym), synonym);
  }
  return [...unique.values()];
}

function CatalogPanel({ catalog, selected, disabled, canManageCatalog, onAdd, onCatalogCreated }: {
  readonly catalog: readonly ExamCatalogItem[];
  readonly selected: readonly string[];
  readonly disabled: boolean;
  readonly canManageCatalog: boolean;
  readonly onAdd: (name: string) => void;
  readonly onCatalogCreated: (item: ExamCatalogItem) => void;
}) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [synonyms, setSynonyms] = useState("");
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string>();
  const [catalogMessage, setCatalogMessage] = useState<string>();
  const [existingMatch, setExistingMatch] = useState<ExamCatalogItem>();
  const categories = useMemo(() => [...new Set(catalog.map((item) => item.category))].sort((left, right) => left.localeCompare(right, "pt-BR")), [catalog]);
  const filtered = useMemo(() => {
    return catalog.filter((item) => matchesCatalogSearch(item, search));
  }, [catalog, search]);
  const grouped = useMemo(() => {
    const groups = new Map<string, ExamCatalogItem[]>();
    for (const item of filtered) {
      const items = groups.get(item.category) ?? [];
      items.push(item);
      groups.set(item.category, items);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "pt-BR"));
  }, [filtered]);

  function resetForm() {
    setFormOpen(false);
    setName("");
    setCategory("");
    setCustomCategory("");
    setSynonyms("");
    setCatalogError(undefined);
    setExistingMatch(undefined);
  }

  async function createCatalogItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim().replace(/\s+/gu, " ");
    const selectedCategory = (category === "__NEW__" ? customCategory : category).trim().replace(/\s+/gu, " ");
    setCatalogError(undefined);
    setCatalogMessage(undefined);
    const duplicate = catalog.find((item) => examKey(item.name) === examKey(normalizedName));
    if (duplicate) {
      setExistingMatch(duplicate);
      setCatalogError("Este exame já existe no catálogo.");
      return;
    }
    if (normalizedName.length < 2 || !selectedCategory) {
      setCatalogError("Informe o nome e selecione ou cadastre uma categoria.");
      return;
    }

    const parsedSynonyms = catalogSynonyms(synonyms).filter((synonym) => examKey(synonym) !== examKey(normalizedName));
    setSavingCatalog(true);
    try {
      const response = await fetch("/api/scientific-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "MANUAL",
          draft: {
            area: "NUTRITION",
            domain: "LABORATORY_EXAM",
            name: normalizedName,
            description: "Nome padronizado para seleção manual em solicitações de exames.",
            tags: parsedSynonyms,
            source: "Cadastro manual no catálogo de Solicitações de exames",
            status: "ACTIVE",
            attributes: { category: selectedCategory, synonyms: parsedSynonyms },
            dataNature: "OPERATIONAL",
            editorialStatus: "DRAFT",
          },
        }),
      });
      const payload = await response.json() as {
        item?: { id: string; name: string; attributes?: Record<string, string | string[]> };
        message?: string;
      };
      const attributes = payload.item?.attributes;
      const storedCategory = attributes?.category;
      const storedSynonyms = attributes?.synonyms;
      const item = payload.item ? {
        id: payload.item.id,
        name: payload.item.name,
        category: typeof storedCategory === "string" ? storedCategory : selectedCategory,
        synonyms: Array.isArray(storedSynonyms) ? storedSynonyms : parsedSynonyms,
        source: "PERSISTED" as const,
      } : undefined;
      if (!response.ok || !item) {
        if (response.status === 409) {
          const matched = item ?? catalog.find((entry) => examKey(entry.name) === examKey(normalizedName));
          if (matched) setExistingMatch(matched);
        }
        throw new Error(payload.message ?? "Não foi possível cadastrar o exame.");
      }
      onCatalogCreated(item);
      setSearch(item.name);
      resetForm();
      setCatalogMessage(`${item.name} foi cadastrado no catálogo. Use “+ Adicionar” para incluí-lo na solicitação.`);
    } catch (caught) {
      setCatalogError(caught instanceof Error ? caught.message : "Não foi possível cadastrar o exame.");
    } finally {
      setSavingCatalog(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-900">Catálogo de exames</h2><p className="mt-1 text-xs text-slate-500">Use “Adicionar” somente após sua decisão profissional.</p></div>{canManageCatalog ? <button className="min-h-9 shrink-0 rounded-lg border border-emerald-700 px-3 text-xs font-black text-emerald-900" onClick={() => { setFormOpen(true); setCatalogError(undefined); setCatalogMessage(undefined); setExistingMatch(undefined); }} type="button">Cadastrar exame</button> : null}</div>
      {formOpen ? <form className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3" onSubmit={(event) => void createCatalogItem(event)}>
        <div><h3 className="text-sm font-black text-emerald-950">Novo exame no catálogo</h3><p className="mt-1 text-[11px] leading-4 text-emerald-900">O cadastro não inclui o exame automaticamente nesta solicitação.</p></div>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Nome <input autoFocus className={inputClass} maxLength={200} onChange={(event) => { setName(event.target.value); setExistingMatch(undefined); setCatalogError(undefined); }} required value={name} /></label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Categoria <select className={inputClass} onChange={(event) => { setCategory(event.target.value); setCatalogError(undefined); }} required value={category}><option value="">Selecione</option>{categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}<option value="__NEW__">Cadastrar outra categoria</option></select></label>
        {category === "__NEW__" ? <label className="grid gap-1 text-xs font-bold text-slate-700">Nova categoria <input className={inputClass} maxLength={120} onChange={(event) => setCustomCategory(event.target.value)} required value={customCategory} /></label> : null}
        <label className="grid gap-1 text-xs font-bold text-slate-700">Sinônimos <span className="font-normal text-slate-500">(opcionais; separe por vírgula ou linha)</span><textarea className={`${inputClass} min-h-20 resize-y`} maxLength={1000} onChange={(event) => setSynonyms(event.target.value)} value={synonyms} /></label>
        {existingMatch ? <div className="rounded-lg border border-amber-200 bg-white p-3"><p className="text-[11px] font-black uppercase tracking-wide text-amber-800">Exame existente</p><p className="mt-1 text-sm font-black text-slate-900">{existingMatch.name}</p><p className="text-xs text-slate-600">{existingMatch.category}{existingMatch.synonyms.length ? ` · ${existingMatch.synonyms.join(" · ")}` : ""}</p><button className="mt-2 min-h-9 rounded-lg border border-emerald-700 px-3 text-xs font-black text-emerald-900 disabled:opacity-50" disabled={disabled || selected.some((exam) => examKey(exam) === examKey(existingMatch.name))} onClick={() => onAdd(existingMatch.name)} type="button">{selected.some((exam) => examKey(exam) === examKey(existingMatch.name)) ? "Adicionado" : "+ Adicionar"}</button></div> : null}
        {catalogError ? <p className="text-xs font-bold text-rose-800" role="alert">{catalogError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2"><button className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700" disabled={savingCatalog} onClick={resetForm} type="button">Cancelar</button><button className="min-h-9 rounded-lg bg-[#12664f] px-3 text-xs font-black text-white disabled:opacity-50" disabled={savingCatalog} type="submit">{savingCatalog ? "Salvando…" : "Salvar no catálogo"}</button></div>
      </form> : null}
      {catalogMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-semibold leading-5 text-emerald-950" role="status">{catalogMessage}</p> : null}
      <label className="grid gap-1 text-xs font-bold text-slate-700">Pesquisar <input className={inputClass} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, sinônimo ou categoria" type="search" value={search} /></label>
      <div className="grid min-w-0 max-h-[28rem] gap-4 overflow-x-hidden overflow-y-auto pr-1">
        {grouped.map(([category, items]) => <section aria-labelledby={`exam-category-${examKey(category)}`} className="grid gap-2" key={category}>
          <h3 className="sticky top-0 z-10 bg-white py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500" id={`exam-category-${examKey(category)}`}>{category}</h3>
          <ul className="grid gap-2">
            {items.map((item) => {
              const alreadyAdded = selected.some((exam) => examKey(exam) === examKey(item.name));
              return <li className="grid min-w-0 gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3" key={item.id}><div className="min-w-0"><p className="break-words text-sm font-bold leading-5 text-slate-900 [overflow-wrap:anywhere]">{item.name}</p>{item.synonyms.length ? <p className="mt-1 break-words text-[11px] leading-4 text-slate-500 [overflow-wrap:anywhere]">{item.synonyms.join(" · ")}</p> : null}</div><button className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-emerald-700 px-3 text-xs font-black text-emerald-900 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500" disabled={disabled || alreadyAdded} onClick={() => onAdd(item.name)} type="button">{alreadyAdded ? "Adicionado" : "+ Adicionar"}</button></li>;
            })}
          </ul>
        </section>)}
      </div>
      {!filtered.length ? <p className="text-sm text-slate-500">Nenhum item encontrado.</p> : null}
    </div>
  );
}

function MobileCatalog({ children }: { readonly children: ReactNode }) {
  return <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:hidden"><summary className="cursor-pointer font-black text-slate-900">Abrir catálogo de exames</summary><div className="mt-4">{children}</div></details>;
}

export function ExamRequestWorkspace({ patientId, patientName, patientCode, patientBirthDate, professionalName, professionalNutritionTitle, professionalCrn, catalog, initialRequests, canCreate, canManageCatalog }: {
  readonly patientId: string; readonly patientName: string; readonly patientCode: string; readonly patientBirthDate: string;
  readonly professionalName: string; readonly professionalNutritionTitle?: string; readonly professionalCrn?: string;
  readonly catalog: readonly ExamCatalogItem[]; readonly initialRequests: readonly ExamRequestView[]; readonly canCreate: boolean; readonly canManageCatalog: boolean;
}) {
  const [requests, setRequests] = useState([...initialRequests]);
  const [catalogItems, setCatalogItems] = useState([...catalog]);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = requests.find((item) => item.id === selectedId);
  const [requestedExams, setRequestedExams] = useState<string[]>([]);
  const [manualExam, setManualExam] = useState("");
  const [justification, setJustification] = useState("");
  const [orientations, setOrientations] = useState("");
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [previewMode, setPreviewMode] = useState<"VIEW" | "PRINT">();
  const editable = canCreate && (!selected || selected.status === "DRAFT");
  const hasCrnRegion = Boolean(professionalCrn && (/CRN(?:\s*-)?\s*\d{1,2}\b/iu.test(professionalCrn) || /\b\d{1,2}(?:ª|a)?\s+regi[aã]o\b/iu.test(professionalCrn)));
  const transientPreview = useMemo<ExamRequestView>(() => {
    const now = new Date().toISOString();
    return {
      id: "unsaved-preview",
      masterRecordId: "unsaved-preview",
      status: "DRAFT",
      version: 0,
      title: "Solicitação de exames",
      content: {
        requestedExams: [...requestedExams],
        ...(justification.trim() ? { justification } : {}),
        ...(orientations.trim() ? { orientations } : {}),
      },
      history: [],
      patient: {
        id: patientId,
        clinicalCode: patientCode,
        fullName: patientName,
        birthDate: patientBirthDate,
      },
      responsibleProfessional: {
        userId: "current-professional",
        fullName: professionalName,
        registrations: professionalCrn ? [professionalCrn] : [],
        ...(professionalNutritionTitle ? { title: professionalNutritionTitle, nutritionTitle: professionalNutritionTitle } : {}),
        ...(professionalCrn ? { crnRegistration: professionalCrn } : {}),
      },
      createdAt: now,
      updatedAt: now,
    };
  }, [justification, orientations, patientBirthDate, patientCode, patientId, patientName, professionalCrn, professionalName, professionalNutritionTitle, requestedExams]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  useEffect(() => {
    if (!previewMode) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewMode(undefined); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewMode]);

  function markChanged() { setDirty(true); setReviewing(false); setMessage(undefined); }
  function load(request?: ExamRequestView) {
    if (dirty && !window.confirm("Há alterações não salvas. Deseja descartá-las?")) return;
    setSelectedId(request?.id); setRequestedExams([...(request?.content.requestedExams ?? [])]); setJustification(request?.content.justification ?? ""); setOrientations(request?.content.orientations ?? ""); setOptionalOpen(Boolean(request?.content.justification || request?.content.orientations)); setManualExam(""); setDirty(false); setReviewing(false); setMessage(undefined); setError(undefined);
  }
  function addExam(name: string) { const next = addExamWithoutDuplicate(requestedExams, name); if (next.length === requestedExams.length) return; setRequestedExams(next); markChanged(); }
  function addCatalogItem(item: ExamCatalogItem) { setCatalogItems((current) => [...current.filter((entry) => entry.id !== item.id && examKey(entry.name) !== examKey(item.name)), item].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))); }
  function addManualExam() { const next = addExamWithoutDuplicate(requestedExams, manualExam); if (next.length === requestedExams.length) return; setRequestedExams(next); setManualExam(""); markChanged(); }
  async function persist(action: "SAVE_DRAFT" | "ISSUE") {
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch("/api/exam-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, patientId, requestId: selected?.id, content: { requestedExams, justification, orientations } }) });
      const payload = await response.json() as { request?: ExamRequestView; message?: string };
      if (!response.ok || !payload.request) throw new Error(payload.message ?? "Não foi possível salvar.");
      const saved = payload.request; setRequests((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setSelectedId(saved.id); setDirty(false); setReviewing(false); setMessage(action === "ISSUE" ? "Solicitação emitida. O documento está disponível para impressão." : "Rascunho salvo.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); } finally { setBusy(false); }
  }

  const catalogPanel = <CatalogPanel canManageCatalog={canManageCatalog} catalog={catalogItems} disabled={!editable || busy} onAdd={addExam} onCatalogCreated={addCatalogItem} selected={requestedExams} />;
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <aside className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
        <details className="min-w-0 flex-1">
          <summary className="min-h-10 cursor-pointer py-2 font-black text-slate-900">Histórico <span className="ml-1 text-xs font-semibold text-slate-500">({requests.length})</span></summary>
          {requests.length ? <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{requests.map((request) => {
            const simulated = [request.content.justification, request.content.orientations].some((value) => value?.includes("TESTE — SEM VALIDADE CLÍNICA"));
            return <li key={request.id}><button className={`h-full w-full rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selectedId === request.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`} onClick={() => load(request)} type="button"><span className="block text-sm font-black text-slate-900">Solicitação de exames</span>{simulated ? <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-amber-800">TESTE — SEM VALIDADE CLÍNICA</span> : null}<span className="mt-1 block text-xs font-semibold text-slate-600">{request.status === "PUBLISHED" ? "Emitida" : "Rascunho"} · {formatter.format(new Date(request.updatedAt))}</span><span className="mt-1 block text-xs text-slate-500">Responsável: {request.responsibleProfessional.fullName}</span></button></li>;
          })}</ul> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Nenhuma solicitação registrada.</p>}
        </details>
        {canCreate ? <button className="min-h-10 shrink-0 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white" onClick={() => load()} type="button">Nova solicitação</button> : null}
      </aside>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Solicitação de exames</p><h2 className="mt-1 text-xl font-black text-slate-950">{patientName}</h2><dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2"><div><dt className="inline font-bold">Nascimento: </dt><dd className="inline">{dateFormatter.format(new Date(`${patientBirthDate}T12:00:00.000Z`))}</dd></div><div><dt className="inline font-bold">Código: </dt><dd className="inline">{patientCode}</dd></div></dl></div>{selected?.status === "PUBLISHED" ? <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-4 text-sm font-black text-white" href={`/entregaveis/solicitacoes-exames/${encodeURIComponent(selected.id)}/imprimir?patientId=${encodeURIComponent(patientId)}`}>Imprimir novamente</Link> : null}</header>
        {!professionalCrn ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950" role="status">O cadastro de {professionalName} não possui CRN identificável. Complete o registro profissional antes de emitir.</p> : !hasCrnRegion ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950" role="status">O cadastro informa “{professionalCrn}”, mas não identifica a região do CRN. O documento usará somente o registro existente; complete a região no cadastro profissional.</p> : null}
        <MobileCatalog>{catalogPanel}</MobileCatalog>
        {!selected && !canCreate ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Seu perfil pode consultar, mas não criar solicitações.</p> : (
          <div className="mt-4 grid gap-4">
            <section aria-labelledby="requested-exams-title" className="grid gap-3"><div><h3 className="text-sm font-black text-slate-900" id="requested-exams-title">Exames solicitados</h3><p className="text-xs text-slate-500">Adicione pelo catálogo ou escreva manualmente. Nada é selecionado automaticamente.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input className={inputClass} disabled={!editable || busy} onChange={(event) => setManualExam(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addManualExam(); } }} placeholder="Nome do exame" value={manualExam} /><button className="min-h-11 shrink-0 rounded-xl border border-emerald-700 px-4 text-sm font-black text-emerald-900 disabled:opacity-50" disabled={!editable || busy || !manualExam.trim()} onClick={addManualExam} type="button">Adicionar manualmente</button></div>
              {requestedExams.length ? <ol className="grid gap-2">{requestedExams.map((exam, index) => <li className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={`${examKey(exam)}:${index}`}><span className="min-w-0 break-words text-sm font-bold text-slate-900 [overflow-wrap:anywhere]"><span className="mr-2 text-slate-400">{index + 1}.</span>{exam}</span><span className="flex flex-wrap gap-2"><button aria-label={`Mover ${exam} para cima`} className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white font-black disabled:opacity-30" disabled={!editable || index === 0} onClick={() => { setRequestedExams(moveExam(requestedExams, index, -1)); markChanged(); }} type="button">↑</button><button aria-label={`Mover ${exam} para baixo`} className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white font-black disabled:opacity-30" disabled={!editable || index === requestedExams.length - 1} onClick={() => { setRequestedExams(moveExam(requestedExams, index, 1)); markChanged(); }} type="button">↓</button><button aria-label={`Remover ${exam}`} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-30" disabled={!editable} onClick={() => { setRequestedExams(requestedExams.filter((_, itemIndex) => itemIndex !== index)); markChanged(); }} type="button">Remover</button></span></li>)}</ol> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhum exame adicionado.</p>}
            </section>
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3" onToggle={(event) => setOptionalOpen(event.currentTarget.open)} open={optionalOpen}>
              <summary className="cursor-pointer text-sm font-black text-slate-900">Adicionar justificativa ou orientações</summary>
              <p className="mt-2 text-xs leading-5 text-slate-600">A justificativa registra o contexto do pedido. As orientações registram somente instruções decididas pelo profissional; o sistema não gera preparo nem conteúdo clínico automaticamente.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-slate-800">Justificativa <span className="font-normal text-slate-500">(opcional)</span><textarea className={`${inputClass} min-h-28 resize-y`} disabled={!editable || busy} onChange={(event) => { setJustification(event.target.value); markChanged(); }} value={justification} /></label><label className="grid gap-2 text-sm font-bold text-slate-800">Orientações <span className="font-normal text-slate-500">(opcional)</span><textarea className={`${inputClass} min-h-28 resize-y`} disabled={!editable || busy} onChange={(event) => { setOrientations(event.target.value); markChanged(); }} value={orientations} /></label></div>
            </details>
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-black text-slate-900">Identificação profissional prevista</p><p className="mt-1 text-slate-700">{professionalName}{professionalNutritionTitle ? ` · ${professionalNutritionTitle}` : ""}{professionalCrn ? ` · ${professionalCrn}` : " · CRN ausente"}</p><p className="mt-1 text-xs text-slate-500">A impressão reservará espaço para assinatura manuscrita; nenhuma assinatura é inserida automaticamente.</p><p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600"><span className="font-black text-slate-700">Fundamentação exibida no documento:</span> Lei nº 8.234/1991, art. 4º, VIII, e Resolução CFN nº 306/2003, art. 1º.</p></section>
            {selected ? <details className="rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-black text-slate-800">Histórico de revisões ({selected.history.length})</summary><ol className="mt-3 grid gap-2 text-xs text-slate-600">{[...selected.history].reverse().map((entry) => <li key={`${entry.revision}:${entry.occurredAt}`}><span className="font-bold text-slate-800">Revisão {entry.revision}</span> · {entry.action === "CREATED" ? "Rascunho criado" : entry.action === "UPDATED" ? "Rascunho atualizado" : "Solicitação emitida"} · {formatter.format(new Date(entry.occurredAt))} · {entry.actorName}</li>)}</ol></details> : null}
            {reviewing ? <section aria-label="Revisão antes da emissão" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><h3 className="font-black text-emerald-950">Revisar e emitir</h3><p className="mt-1 text-sm text-emerald-900">Confira conteúdo, identificação e registro profissional. Após a emissão, o snapshot fica preservado.</p><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-800">{requestedExams.map((exam) => <li key={examKey(exam)}>{exam}</li>)}</ol><div className="mt-4 flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800" disabled={busy} onClick={() => setReviewing(false)} type="button">Voltar à edição</button><button className="min-h-11 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white disabled:opacity-50" disabled={busy || requestedExams.length === 0 || !professionalCrn} onClick={() => void persist("ISSUE")} type="button">{busy ? "Emitindo…" : "Confirmar emissão"}</button></div></section> : null}
            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900" role="alert">{error}</p> : null}{message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950" role="status">{message}</p> : null}
            {editable && !reviewing ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 disabled:opacity-50" disabled={requestedExams.length === 0} onClick={() => setPreviewMode("VIEW")} type="button">Visualizar prévia</button><button className="min-h-11 rounded-xl border border-emerald-700 bg-emerald-50 px-4 text-sm font-black text-emerald-950 disabled:opacity-50" disabled={requestedExams.length === 0} onClick={() => setPreviewMode("PRINT")} type="button">Imprimir / Salvar PDF</button></div><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-emerald-700 bg-white px-4 text-sm font-black text-emerald-900 disabled:opacity-50" disabled={busy} onClick={() => void persist("SAVE_DRAFT")} type="button">{busy ? "Salvando…" : "Salvar rascunho"}</button><button className="min-h-11 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white disabled:opacity-50" disabled={busy || requestedExams.length === 0 || !selected || !professionalCrn} onClick={() => setReviewing(true)} type="button">Revisar para emitir</button></div></div> : null}
            {editable && !selected ? <p className="text-right text-xs text-slate-500">Salve o rascunho antes de iniciar a revisão para emissão.</p> : null}
          </div>
        )}
      </section>
      <aside className="hidden self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:block">{catalogPanel}</aside>
      {previewMode ? createPortal(<div aria-label="Prévia da solicitação de exames em rascunho" aria-modal="true" className="exam-request-preview-portal fixed inset-0 z-[100] overflow-y-auto bg-slate-950/55 backdrop-blur-sm" role="dialog"><ExamRequestDocument autoPrint={previewMode === "PRINT"} embedded onClose={() => setPreviewMode(undefined)} preview request={transientPreview} /></div>, document.body) : null}
    </div>
  );
}
