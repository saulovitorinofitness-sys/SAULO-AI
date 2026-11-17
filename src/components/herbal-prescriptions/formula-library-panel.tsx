"use client";

import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { ScientificLibraryItem } from "@/features/scientific-library/contracts";
import type { HerbalPrescriptionItem, PrescriptionItemCategory } from "@/features/herbal-prescriptions/contracts";
import {
  FORMULA_MODEL_ATTRIBUTE,
  formulaModelCategory,
  formulaModelDraft,
  formulaModelSearchText,
  formulaModelToPrescriptionItem,
  isFormulaModel,
  type FormulaModelDraft,
} from "@/features/herbal-prescriptions/formula-library";

const groups = [
  { category: "HERBAL" as const, title: "Fitoterápicos" },
  { category: "SUPPLEMENT" as const, title: "Suplementação" },
  { category: "OTHER_FORMULATION" as const, title: "Outras formulações" },
] as const;

const emptyDraft: FormulaModelDraft = {
  name: "",
  category: "HERBAL",
  purpose: "",
  components: "",
  presentation: "",
  use: "",
  care: "",
};

function attribute(item: ScientificLibraryItem, key: string) {
  const value = item.attributes[key];
  return typeof value === "string" ? value : value?.join("\n") ?? "";
}

function CompactField({ label, value, onChange, multiline = false, required = false }: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly multiline?: boolean;
  readonly required?: boolean;
}) {
  const className = "min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
  return <label className="grid gap-1 text-xs font-bold text-slate-700"><span>{label}{required ? " *" : ""}</span>{multiline
    ? <textarea className={`${className} min-h-20 resize-y`} onChange={(event) => onChange(event.target.value)} required={required} value={value} />
    : <input className={className} onChange={(event) => onChange(event.target.value)} required={required} value={value} />}</label>;
}

function displayModelName(value: string) {
  return value
    .replace(/\s+·\s+PDF p\.\s*\d+\s*$/iu, "")
    .replace(/^\s*\d+\s*[-–—]\s+/u, "")
    .replace(/\*+\s*$/u, "")
    .trim();
}

function comparable(value: string) {
  return displayModelName(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function componentSummary(item: ScientificLibraryItem) {
  const components = attribute(item, FORMULA_MODEL_ATTRIBUTE.components)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!components.length) return "Composição não informada";
  const visible = components.slice(0, 2).join(" · ");
  return components.length > 2 ? `${visible} · +${components.length - 2}` : visible;
}

function ModelRow({ item, onSelect }: {
  readonly item: ScientificLibraryItem;
  readonly onSelect: () => void;
}) {
  const review = attribute(item, FORMULA_MODEL_ATTRIBUTE.importReview);
  return (
    <button className="grid w-full min-w-0 gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={onSelect} type="button">
      <span className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-black leading-5 text-slate-950 [overflow-wrap:anywhere]">{displayModelName(item.name)}</span>
        {review ? <span className="mt-0.5 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-900" title={review}>Pendente</span> : null}
      </span>
      <span className="line-clamp-2 break-words text-[11px] leading-4 text-slate-600 [overflow-wrap:anywhere]">{componentSummary(item)}</span>
    </button>
  );
}

function ModelDetails({ item, disabled, onAdd, onBack }: {
  readonly item: ScientificLibraryItem;
  readonly disabled: boolean;
  readonly onAdd: (item: HerbalPrescriptionItem) => void;
  readonly onBack: () => void;
}) {
  const components = attribute(item, FORMULA_MODEL_ATTRIBUTE.components);
  const presentation = attribute(item, FORMULA_MODEL_ATTRIBUTE.presentation);
  const use = attribute(item, FORMULA_MODEL_ATTRIBUTE.use);
  const care = attribute(item, FORMULA_MODEL_ATTRIBUTE.care);
  const page = attribute(item, FORMULA_MODEL_ATTRIBUTE.sourcePage);
  const review = attribute(item, FORMULA_MODEL_ATTRIBUTE.importReview);
  const ambiguities = attribute(item, FORMULA_MODEL_ATTRIBUTE.ambiguities) || item.limitations;
  const purpose = item.description && comparable(item.description) !== comparable(item.name)
    ? item.description
    : "";
  return (
    <article className="grid gap-4" aria-labelledby={`formula-details-${item.id}`}>
      <button className="inline-flex min-h-9 w-fit items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={onBack} type="button">← Voltar à lista</button>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="min-w-0 flex-1 break-words text-base font-black leading-6 text-slate-950 [overflow-wrap:anywhere]" id={`formula-details-${item.id}`}>{displayModelName(item.name)}</h4>
          {review ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900">Pendente de revisão</span> : null}
        </div>
        {purpose ? <p className="mt-2 text-xs leading-5 text-slate-700"><strong>Finalidade:</strong> {purpose}</p> : null}
      </div>
      <dl className="grid gap-3 text-xs leading-5 text-slate-700">
        <div><dt className="font-black text-slate-900">Composição e quantidades</dt><dd className="mt-1 whitespace-pre-wrap">{components || "Não informadas."}</dd></div>
        {presentation ? <div><dt className="font-black text-slate-900">Apresentação</dt><dd className="mt-1 whitespace-pre-wrap">{presentation}</dd></div> : null}
        <div><dt className="font-black text-slate-900">Modo de uso</dt><dd className="mt-1 whitespace-pre-wrap">{use || "Não informado."}</dd></div>
        <div><dt className="font-black text-slate-900">Cuidados existentes</dt><dd className="mt-1 whitespace-pre-wrap">{care || "Não informados no modelo."}</dd></div>
      </dl>
      <button className="min-h-11 w-full rounded-xl bg-[#12664f] px-4 text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} onClick={() => onAdd(formulaModelToPrescriptionItem(item))} type="button">Adicionar à prescrição</button>
      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-black text-slate-800">Referência e observações técnicas</summary>
        <div className="mt-3 grid gap-2 leading-5">
          <p><strong>Título original:</strong> {item.name}</p>
          <p><strong>Fonte:</strong> {item.source || "Não informada"}{page ? ` · página ${page}` : ""}</p>
          {item.importFileName ? <p><strong>Arquivo:</strong> {item.importFileName}</p> : null}
          {ambiguities ? <p className="whitespace-pre-wrap text-amber-900"><strong>Pendências:</strong> {ambiguities}</p> : null}
          {item.references?.map((reference) => <p key={reference.id}>{reference.fullCitation || reference.sourceTitle}</p>)}
          <p>O cadastro bibliográfico não representa validação clínica automática da formulação.</p>
        </div>
      </details>
    </article>
  );
}

export function FormulaLibraryPanel({ initialItems, canCreate, onAdd }: {
  readonly initialItems: readonly ScientificLibraryItem[];
  readonly canCreate: boolean;
  readonly onAdd: (item: HerbalPrescriptionItem) => void;
}) {
  const [models, setModels] = useState(() => initialItems.filter(isFormulaModel));
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<PrescriptionItemCategory>("HERBAL");
  const [selectedId, setSelectedId] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<FormulaModelDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollPosition = useRef(0);
  const restoreListPosition = useRef(false);
  const normalizedQuery = query.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("pt-BR");
  const visible = useMemo(() => models.filter((item) => !normalizedQuery || formulaModelSearchText(item).includes(normalizedQuery)), [models, normalizedQuery]);
  const activeItems = useMemo(() => visible.filter((item) => formulaModelCategory(item) === activeCategory), [activeCategory, visible]);
  const selected = models.find((item) => item.id === selectedId);
  const categoryCounts = useMemo(() => groups.reduce<Record<PrescriptionItemCategory, number>>((counts, group) => {
    counts[group.category] = models.filter((item) => formulaModelCategory(item) === group.category).length;
    return counts;
  }, { HERBAL: 0, SUPPLEMENT: 0, OTHER_FORMULATION: 0 }), [models]);

  useLayoutEffect(() => {
    if (selectedId || !restoreListPosition.current || !listRef.current) return;
    listRef.current.scrollTop = listScrollPosition.current;
    restoreListPosition.current = false;
  }, [selectedId]);

  function selectModel(id: string) {
    listScrollPosition.current = listRef.current?.scrollTop ?? 0;
    setSelectedId(id);
  }

  function returnToList() {
    restoreListPosition.current = true;
    setSelectedId(undefined);
  }

  function changeCategory(category: PrescriptionItemCategory) {
    setActiveCategory(category);
    setSelectedId(undefined);
    listScrollPosition.current = 0;
  }

  function change<Key extends keyof FormulaModelDraft>(key: Key, value: FormulaModelDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveModel(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch("/api/scientific-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "MANUAL", draft: formulaModelDraft(draft) }),
      });
      const payload = await response.json() as { item?: ScientificLibraryItem; message?: string };
      if (!payload.item) throw new Error(payload.message ?? "Não foi possível cadastrar o modelo.");
      setModels((current) => [payload.item!, ...current.filter((item) => item.id !== payload.item!.id)]);
      setMessage(response.status === 409 ? "Modelo já existente localizado na Biblioteca Científica." : "Modelo cadastrado na Biblioteca Científica.");
      if (response.status !== 409) { setDraft(emptyDraft); setShowForm(false); }
      setActiveCategory(formulaModelCategory(payload.item));
      setSelectedId(payload.item.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível cadastrar o modelo.");
    } finally { setBusy(false); }
  }

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="formula-library-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-black text-slate-950" id="formula-library-title">Biblioteca</h3><p className="mt-1 text-xs leading-5 text-slate-600">Ao adicionar, uma cópia editável vai para a prescrição. O modelo original permanece inalterado.</p></div>
        {canCreate ? <button className="min-h-10 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-black text-emerald-900" onClick={() => setShowForm((current) => !current)} type="button">{showForm ? "Cancelar cadastro" : "Cadastrar modelo"}</button> : null}
      </div>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Buscar por nome, componente ou finalidade<input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" onChange={(event) => { setQuery(event.target.value); setSelectedId(undefined); listScrollPosition.current = 0; }} placeholder="Digite para localizar entre todos os modelos" type="search" value={query} /></label>

      <div aria-label="Tipos de formulação" className="flex min-w-0 flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        {groups.map((group) => <button aria-selected={activeCategory === group.category} className={`min-h-11 min-w-[8.5rem] flex-1 rounded-lg px-3 py-2 text-xs font-black leading-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${activeCategory === group.category ? "bg-white text-emerald-900 shadow-sm" : "text-slate-600 hover:bg-white/70"}`} key={group.category} onClick={() => changeCategory(group.category)} role="tab" type="button"><span className="block whitespace-normal">{group.title}</span><span className="block font-semibold text-slate-500">({categoryCounts[group.category]})</span></button>)}
      </div>

      {showForm ? <form className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-white p-3 md:grid-cols-2" onSubmit={(event) => void saveModel(event)}>
        <CompactField label="Nome" onChange={(value) => change("name", value)} required value={draft.name} />
        <label className="grid gap-1 text-xs font-bold text-slate-700">Tipo *<select className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" onChange={(event) => change("category", event.target.value as PrescriptionItemCategory)} value={draft.category}><option value="HERBAL">Fitoterápico</option><option value="SUPPLEMENT">Suplemento</option><option value="OTHER_FORMULATION">Outra formulação</option></select></label>
        <CompactField label="Finalidade" onChange={(value) => change("purpose", value)} value={draft.purpose} />
        <CompactField label="Apresentação" onChange={(value) => change("presentation", value)} value={draft.presentation} />
        <CompactField label="Componentes e quantidades (um por linha)" multiline onChange={(value) => change("components", value)} value={draft.components} />
        <CompactField label="Forma de uso" multiline onChange={(value) => change("use", value)} value={draft.use} />
        <CompactField label="Cuidados essenciais" multiline onChange={(value) => change("care", value)} value={draft.care} />
        <CompactField label="Fonte / referência" onChange={(value) => change("source", value)} value={draft.source ?? ""} />
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">O cadastro não adiciona o modelo ao rascunho.</p><button className="min-h-10 rounded-lg bg-[#12664f] px-4 text-xs font-black text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar modelo"}</button></div>
      </form> : null}
      {error ? <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-900" role="alert">{error}</p> : null}
      {message ? <p className="mt-3 rounded-lg bg-emerald-100 p-2 text-xs font-bold text-emerald-950" role="status">{message}</p> : null}

      <p className="text-[11px] font-semibold text-slate-500" role="status">{normalizedQuery ? `${visible.length} de ${models.length} modelos correspondem à busca; ${activeItems.length} nesta aba.` : `${models.length} modelos disponíveis; ${activeItems.length} nesta aba.`}</p>
      <div className="max-h-[28rem] min-h-64 overflow-y-auto overscroll-contain pr-1 xl:max-h-[calc(100vh-22rem)]" ref={listRef}>
        {selected ? <ModelDetails disabled={!canCreate} item={selected} onAdd={onAdd} onBack={returnToList} /> : activeItems.length ? <ul className="grid gap-2">{activeItems.map((item) => <li key={item.id}><ModelRow item={item} onSelect={() => selectModel(item.id)} /></li>)}</ul> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">Nenhum modelo encontrado nesta aba. As outras abas continuam disponíveis.</p>}
      </div>
    </section>
  );
}
