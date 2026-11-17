"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { HerbalPrescriptionDocument } from "@/components/herbal-prescriptions/herbal-prescription-document";
import { FormulaLibraryPanel } from "@/components/herbal-prescriptions/formula-library-panel";
import type { ScientificLibraryItem } from "@/features/scientific-library/contracts";
import type {
  HerbalPrescriptionComponent,
  HerbalPrescriptionContent,
  HerbalPrescriptionItem,
  HerbalPrescriptionView,
  PrescriptionItemCategory,
} from "@/features/herbal-prescriptions/contracts";
import { herbalPrescriptionDocumentTitle } from "@/features/herbal-prescriptions/presentation";

const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

let keySequence = 0;
function nextKey(prefix: string) {
  keySequence += 1;
  return `${prefix}-${keySequence}`;
}

type EditableComponent = {
  readonly key: string;
  identification: string;
  scientificName: string;
  plantPart: string;
  concentrationStandardization: string;
};

type EditableItem = {
  readonly key: string;
  category: PrescriptionItemCategory;
  identification: string;
  scientificName: string;
  plantPart: string;
  presentation: string;
  concentrationStandardization: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  orientations: string;
  components: EditableComponent[];
};

function emptyComponent(): EditableComponent {
  return {
    key: nextKey("component"),
    identification: "",
    scientificName: "",
    plantPart: "",
    concentrationStandardization: "",
  };
}

function emptyItem(category: PrescriptionItemCategory = "HERBAL"): EditableItem {
  return {
    key: nextKey("item"),
    category,
    identification: "",
    scientificName: "",
    plantPart: "",
    presentation: "",
    concentrationStandardization: "",
    dose: "",
    route: "",
    frequency: "",
    duration: "",
    quantity: "",
    orientations: "",
    components: [],
  };
}

function editableComponent(component: HerbalPrescriptionComponent): EditableComponent {
  return {
    key: nextKey("component"),
    identification: component.identification,
    scientificName: component.scientificName ?? "",
    plantPart: component.plantPart ?? "",
    concentrationStandardization: component.concentrationStandardization ?? "",
  };
}

function editableItem(item: HerbalPrescriptionItem): EditableItem {
  return {
    key: nextKey("item"),
    category: item.category,
    identification: item.identification,
    scientificName: item.scientificName ?? "",
    plantPart: item.plantPart ?? "",
    presentation: item.presentation ?? "",
    concentrationStandardization: item.concentrationStandardization ?? "",
    dose: item.dose ?? "",
    route: item.route ?? "",
    frequency: item.frequency ?? "",
    duration: item.duration ?? "",
    quantity: item.quantity ?? "",
    orientations: item.orientations ?? "",
    components: item.components.map(editableComponent),
  };
}

function contentFromItems(items: readonly EditableItem[]): HerbalPrescriptionContent {
  return {
    items: items.map((item) => ({
      category: item.category,
      identification: item.identification,
      scientificName: item.scientificName,
      plantPart: item.plantPart,
      presentation: item.presentation,
      concentrationStandardization: item.concentrationStandardization,
      dose: item.dose,
      route: item.route,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity,
      orientations: item.orientations,
      components: item.components.map((component) => ({
        identification: component.identification,
        scientificName: component.scientificName,
        plantPart: component.plantPart,
        concentrationStandardization: component.concentrationStandardization,
      })),
    })),
  };
}

export function moveHerbalPrescriptionItem<T>(items: readonly T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

function itemSummary(item: EditableItem, index: number) {
  return item.identification.trim() || `Item ${index + 1} ainda sem identificação`;
}

function Field({ label, value, onChange, disabled, multiline = false }: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
  readonly multiline?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-700">
      {label}
      {multiline ? (
        <textarea className={`${inputClass} min-h-24 resize-y`} disabled={disabled} maxLength={4000} onChange={(event) => onChange(event.target.value)} value={value} />
      ) : (
        <input className={inputClass} disabled={disabled} maxLength={1000} onChange={(event) => onChange(event.target.value)} value={value} />
      )}
    </label>
  );
}

export function HerbalPrescriptionWorkspace({
  patientId,
  patientName,
  patientCode,
  patientBirthDate,
  professionalName,
  professionalNutritionTitle,
  professionalCrn,
  initialPrescriptions,
  scientificLibraryItems,
  canCreate,
}: {
  readonly patientId: string;
  readonly patientName: string;
  readonly patientCode: string;
  readonly patientBirthDate: string;
  readonly professionalName: string;
  readonly professionalNutritionTitle?: string;
  readonly professionalCrn?: string;
  readonly initialPrescriptions: readonly HerbalPrescriptionView[];
  readonly scientificLibraryItems: readonly ScientificLibraryItem[];
  readonly canCreate: boolean;
}) {
  const [prescriptions, setPrescriptions] = useState([...initialPrescriptions]);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = prescriptions.find((item) => item.id === selectedId);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [previewMode, setPreviewMode] = useState<"VIEW" | "PRINT">();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [wideLayout, setWideLayout] = useState(false);
  const editorItemsRef = useRef<HTMLOListElement>(null);
  const editable = canCreate && (!selected || selected.status === "DRAFT");
  const issuePendencies = useMemo(() => {
    const pendencies: string[] = [];
    if (!items.length) pendencies.push("Inclua ao menos uma f\u00f3rmula.");
    items.forEach((item, itemIndex) => {
      if (!item.identification.trim()) pendencies.push(`Informe o nome da f\u00f3rmula ${itemIndex + 1}.`);
      item.components.forEach((component, componentIndex) => {
        if (!component.identification.trim()) pendencies.push(`Preencha a linha ${componentIndex + 1} da composi\u00e7\u00e3o de ${item.identification.trim() || `f\u00f3rmula ${itemIndex + 1}`}.`);
      });
    });
    if (!professionalCrn) pendencies.push(`Complete o registro profissional de ${professionalName}.`);
    return pendencies;
  }, [items, professionalCrn, professionalName]);
  const previewReady = items.some((item) => item.identification.trim() || item.components.some((component) => component.identification.trim()));
  const issueReady = issuePendencies.length === 0;

  useEffect(() => {
    if (!dirty) return;
    const preventClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventClose);
    return () => window.removeEventListener("beforeunload", preventClose);
  }, [dirty]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const updateLayout = () => setWideLayout(media.matches);
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

  const transientPreview = useMemo<HerbalPrescriptionView>(() => {
    const content = contentFromItems(items);
    return ({
    id: selected?.id ?? "transient-preview",
    masterRecordId: selected?.masterRecordId ?? "transient-preview",
    status: "DRAFT",
    version: selected?.version ?? 0,
    title: herbalPrescriptionDocumentTitle(content),
    content,
    history: selected?.history ?? [],
    patient: {
      id: patientId,
      fullName: patientName,
      clinicalCode: patientCode,
      birthDate: patientBirthDate,
    },
    responsibleProfessional: {
      userId: "current-professional",
      fullName: professionalName,
      ...(professionalNutritionTitle ? { nutritionTitle: professionalNutritionTitle } : {}),
      ...(professionalCrn ? { crnRegistration: professionalCrn } : {}),
    },
    createdAt: selected?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  }, [items, patientBirthDate, patientCode, patientId, patientName, professionalCrn, professionalName, professionalNutritionTitle, selected]);

  function confirmDiscard() {
    return !dirty || window.confirm("Descartar as alterações não salvas desta prescrição?");
  }

  function load(prescription?: HerbalPrescriptionView) {
    if (!confirmDiscard()) return;
    setSelectedId(prescription?.id);
    setItems(prescription?.content.items.map(editableItem) ?? []);
    setDirty(false);
    setReviewing(false);
    setMessage(undefined);
    setError(undefined);
  }

  function updateItem<Field extends keyof Omit<EditableItem, "key" | "components">>(index: number, field: Field, value: EditableItem[Field]) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    setDirty(true);
  }

  function addModelToDraft(item: HerbalPrescriptionItem) {
    setItems((current) => [...current, editableItem(item)]);
    setDirty(true);
    setMessage(undefined);
    if (!wideLayout) setLibraryOpen(false);
    window.requestAnimationFrame(() => {
      editorItemsRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateComponent(itemIndex: number, componentIndex: number, field: keyof Omit<EditableComponent, "key">, value: string) {
    setItems((current) => current.map((item, currentItemIndex) => currentItemIndex === itemIndex ? {
      ...item,
      components: item.components.map((component, currentComponentIndex) =>
        currentComponentIndex === componentIndex ? { ...component, [field]: value } : component),
    } : item));
    setDirty(true);
  }

  async function persist(action: "SAVE_DRAFT" | "ISSUE") {
    if (action === "ISSUE" && !issueReady) {
      setError(issuePendencies.join(" "));
      return;
    }
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await fetch("/api/herbal-prescriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          patientId,
          prescriptionId: selected?.id,
          content: contentFromItems(items),
        }),
      });
      const payload = await response.json() as { prescription?: HerbalPrescriptionView; message?: string };
      if (!response.ok || !payload.prescription) {
        throw new Error(payload.message ?? "Não foi possível salvar a prescrição.");
      }
      const saved = payload.prescription;
      setPrescriptions((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedId(saved.id);
      setItems(saved.content.items.map(editableItem));
      setDirty(false);
      setReviewing(false);
      setMessage(action === "ISSUE" ? "Prescrição emitida e snapshot preservado." : "Rascunho salvo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a prescrição.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <aside className="order-1 flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
        <details className="min-w-0 flex-1">
          <summary className="min-h-10 cursor-pointer py-2 font-black text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Histórico <span className="ml-1 text-xs font-semibold text-slate-500">({prescriptions.length})</span></summary>
          {prescriptions.length ? <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{prescriptions.map((prescription) => (
            <li key={prescription.id}>
              <button className={`h-full w-full rounded-xl border p-3 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selectedId === prescription.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`} onClick={() => load(prescription)} type="button">
                <span className="block font-black text-slate-900">{prescription.status === "DRAFT" ? "Rascunho" : "Emitida"} · versão {prescription.version}</span>
                <span className="mt-1 block text-slate-600">{formatter.format(new Date(prescription.updatedAt))}</span>
                <span className="mt-1 block text-slate-500">{prescription.content.items.length} {prescription.content.items.length === 1 ? "item" : "itens"}</span>
              </button>
            </li>
          ))}</ul> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhuma prescrição registrada.</p>}
        </details>
        {canCreate ? <button className="min-h-10 shrink-0 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white" onClick={() => load()} type="button">Nova prescrição</button> : null}
      </aside>

      <aside className="order-2 min-w-0 self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:col-start-2 xl:row-start-2">
        <button aria-controls="formula-library-content" aria-expanded={libraryOpen} className="flex min-h-10 w-full items-center justify-between rounded-lg py-2 text-left font-black text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 xl:hidden" onClick={() => setLibraryOpen((current) => !current)} type="button"><span>{libraryOpen ? "Recolher biblioteca" : "Abrir biblioteca"}</span><span aria-hidden="true">{libraryOpen ? "−" : "+"}</span></button>
        <div className={`${libraryOpen ? "block" : "hidden"} mt-4 xl:mt-0 xl:block`} id="formula-library-content">
          <FormulaLibraryPanel canCreate={editable} initialItems={scientificLibraryItems} onAdd={addModelToDraft} />
        </div>
      </aside>

      <section className="order-3 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 xl:col-start-1 xl:row-start-2">
        <header className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Editor da prescrição</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{patientName}</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
              <div><dt className="inline font-bold">Nascimento: </dt><dd className="inline">{dateFormatter.format(new Date(`${patientBirthDate}T12:00:00.000Z`))}</dd></div>
              <div><dt className="inline font-bold">Código: </dt><dd className="inline">{patientCode}</dd></div>
            </dl>
          </div>
          {selected?.status === "PUBLISHED" ? <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-4 text-sm font-black text-white" href={`/entregaveis/fitoterapicos/${encodeURIComponent(selected.id)}/imprimir?patientId=${encodeURIComponent(patientId)}`}>Imprimir novamente</Link> : null}
        </header>

        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900" role="alert">{error}</p> : null}
        {message ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950" role="status">{message}</p> : null}
        {!selected && !canCreate ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Seu perfil pode consultar, mas não criar prescrições.</p> : (
          <div className="grid gap-4">
            <div><h3 className="text-sm font-black text-slate-900">Itens da prescrição <span className="font-semibold text-slate-500">({items.length})</span></h3><p className="mt-1 text-xs text-slate-500">Modelos adicionados são cópias independentes e podem ser editados, ordenados ou removidos.</p></div>
            <ol className="grid gap-4" ref={editorItemsRef}>
              {items.map((item, index) => (
                <li className="rounded-2xl border border-slate-200 p-4" key={item.key}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <h3 className="font-black text-slate-900">{itemSummary(item, index)}</h3>
                    <div className="flex flex-wrap gap-2">
                      <button aria-label={`Mover item ${index + 1} para cima`} className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white font-black disabled:opacity-30" disabled={!editable || index === 0} onClick={() => { setItems(moveHerbalPrescriptionItem(items, index, -1)); setDirty(true); }} type="button">↑</button>
                      <button aria-label={`Mover item ${index + 1} para baixo`} className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white font-black disabled:opacity-30" disabled={!editable || index === items.length - 1} onClick={() => { setItems(moveHerbalPrescriptionItem(items, index, 1)); setDirty(true); }} type="button">↓</button>
                      <button className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-black text-rose-800 disabled:opacity-30" disabled={!editable} onClick={() => { setItems(items.filter((_, itemIndex) => itemIndex !== index)); setDirty(true); }} type="button">Remover</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <Field disabled={!editable || busy} label={"Nome da f\u00f3rmula"} onChange={(value) => updateItem(index, "identification", value)} value={item.identification} />

                    <section aria-labelledby={`composition-title-${item.key}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-black text-slate-700" id={`composition-title-${item.key}`}>{"Composi\u00e7\u00e3o"}</h4>
                        <button className="min-h-9 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-black text-emerald-900 disabled:opacity-40" disabled={!editable || busy} onClick={() => { setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, components: [...entry.components, emptyComponent()] } : entry)); setDirty(true); }} type="button">Adicionar linha</button>
                      </div>
                      {item.components.length ? <ol className="mt-2 grid gap-2">{item.components.map((component, componentIndex) => (
                        <li className="rounded-xl border border-slate-200 bg-slate-50 p-2" key={component.key}>
                          <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="w-5 shrink-0 text-center text-xs font-black text-slate-400">{componentIndex + 1}</span>
                            <input aria-label={`Componente ${componentIndex + 1}`} className={`${inputClass} min-w-0 flex-1`} disabled={!editable || busy} maxLength={1000} onChange={(event) => updateComponent(index, componentIndex, "identification", event.target.value)} value={component.identification} />
                            <button aria-label={`Remover componente ${componentIndex + 1}`} className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-600 disabled:opacity-40" disabled={!editable || busy} onClick={() => { setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, components: entry.components.filter((_, currentIndex) => currentIndex !== componentIndex) } : entry)); setDirty(true); }} type="button">x</button>
                          </div>
                          <details className="ml-7 mt-1 rounded-lg px-2 py-1">
                            <summary className="cursor-pointer text-[11px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Detalhes do componente</summary>
                            <div className="mt-2 grid gap-3 md:grid-cols-2">
                              <Field disabled={!editable || busy} label={"Nome cient\u00edfico"} onChange={(value) => updateComponent(index, componentIndex, "scientificName", value)} value={component.scientificName} />
                              <Field disabled={!editable || busy} label="Parte utilizada" onChange={(value) => updateComponent(index, componentIndex, "plantPart", value)} value={component.plantPart} />
                              <div className="md:col-span-2"><Field disabled={!editable || busy} label={"Concentra\u00e7\u00e3o / padroniza\u00e7\u00e3o"} onChange={(value) => updateComponent(index, componentIndex, "concentrationStandardization", value)} value={component.concentrationStandardization} /></div>
                            </div>
                          </details>
                        </li>
                      ))}</ol> : <p className="mt-2 text-xs text-slate-500">Nenhuma linha adicionada.</p>}
                    </section>

                    <Field disabled={!editable || busy} label="Modo de usar" multiline onChange={(value) => updateItem(index, "orientations", value)} value={item.orientations} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field disabled={!editable || busy} label="Quantidade a dispensar" onChange={(value) => updateItem(index, "quantity", value)} value={item.quantity} />
                      <Field disabled={!editable || busy} label={"Dura\u00e7\u00e3o"} onChange={(value) => updateItem(index, "duration", value)} value={item.duration} />
                    </div>

                    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-black text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Detalhes adicionais</summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1 text-xs font-bold text-slate-700">{"Classifica\u00e7\u00e3o"}<select className={inputClass} disabled={!editable || busy} onChange={(event) => updateItem(index, "category", event.target.value as PrescriptionItemCategory)} value={item.category}><option value="HERBAL">{"Fitoter\u00e1pico"}</option><option value="SUPPLEMENT">Suplemento</option><option value="OTHER_FORMULATION">{"Outra formula\u00e7\u00e3o"}</option></select></label>
                        <Field disabled={!editable || busy} label={"Nome cient\u00edfico"} onChange={(value) => updateItem(index, "scientificName", value)} value={item.scientificName} />
                        <Field disabled={!editable || busy} label="Parte utilizada" onChange={(value) => updateItem(index, "plantPart", value)} value={item.plantPart} />
                        <Field disabled={!editable || busy} label={"Apresenta\u00e7\u00e3o"} onChange={(value) => updateItem(index, "presentation", value)} value={item.presentation} />
                        <Field disabled={!editable || busy} label={"Concentra\u00e7\u00e3o / padroniza\u00e7\u00e3o"} onChange={(value) => updateItem(index, "concentrationStandardization", value)} value={item.concentrationStandardization} />
                        <Field disabled={!editable || busy} label="Via" onChange={(value) => updateItem(index, "route", value)} value={item.route} />
                        <Field disabled={!editable || busy} label="Dose" onChange={(value) => updateItem(index, "dose", value)} value={item.dose} />
                        <Field disabled={!editable || busy} label={"Frequ\u00eancia"} onChange={(value) => updateItem(index, "frequency", value)} value={item.frequency} />
                      </div>
                    </details>
                  </div>

                  <div className="hidden">
                    <label className="grid gap-1 text-xs font-bold text-slate-700">Tipo<select className={inputClass} disabled={!editable || busy} onChange={(event) => updateItem(index, "category", event.target.value as PrescriptionItemCategory)} value={item.category}><option value="HERBAL">Fitoterápico</option><option value="SUPPLEMENT">Suplemento</option><option value="OTHER_FORMULATION">Outra formulação</option></select></label>
                    <Field disabled={!editable || busy} label="Identificação" onChange={(value) => updateItem(index, "identification", value)} value={item.identification} />
                    <Field disabled={!editable || busy} label="Nome científico" onChange={(value) => updateItem(index, "scientificName", value)} value={item.scientificName} />
                    <Field disabled={!editable || busy} label="Parte utilizada" onChange={(value) => updateItem(index, "plantPart", value)} value={item.plantPart} />
                    <Field disabled={!editable || busy} label="Apresentação" onChange={(value) => updateItem(index, "presentation", value)} value={item.presentation} />
                    <Field disabled={!editable || busy} label="Concentração / padronização" onChange={(value) => updateItem(index, "concentrationStandardization", value)} value={item.concentrationStandardization} />
                    <Field disabled={!editable || busy} label="Dose" onChange={(value) => updateItem(index, "dose", value)} value={item.dose} />
                    <Field disabled={!editable || busy} label="Via" onChange={(value) => updateItem(index, "route", value)} value={item.route} />
                    <Field disabled={!editable || busy} label="Frequência" onChange={(value) => updateItem(index, "frequency", value)} value={item.frequency} />
                    <Field disabled={!editable || busy} label="Duração" onChange={(value) => updateItem(index, "duration", value)} value={item.duration} />
                    <Field disabled={!editable || busy} label="Quantidade" onChange={(value) => updateItem(index, "quantity", value)} value={item.quantity} />
                    <div className="md:col-span-2"><Field disabled={!editable || busy} label="Orientações" multiline onChange={(value) => updateItem(index, "orientations", value)} value={item.orientations} /></div>
                  </div>

                  <section className="hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-black text-emerald-950">Composição</h4><p className="mt-1 text-xs text-emerald-900">Use somente quando este item tiver múltiplos componentes.</p></div><button className="min-h-9 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-black text-emerald-900 disabled:opacity-40" disabled={!editable || busy} onClick={() => { setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, components: [...entry.components, emptyComponent()] } : entry)); setDirty(true); }} type="button">Adicionar componente</button></div>
                    {item.components.length ? <ol className="mt-3 grid gap-3">{item.components.map((component, componentIndex) => (
                      <li className="rounded-xl border border-emerald-100 bg-white p-3" key={component.key}>
                        <div className="flex items-center justify-between gap-2"><p className="text-xs font-black text-slate-800">Componente {componentIndex + 1}</p><button className="min-h-8 rounded-lg border border-slate-200 px-2 text-[11px] font-black text-slate-700 disabled:opacity-40" disabled={!editable || busy} onClick={() => { setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, components: entry.components.filter((_, currentIndex) => currentIndex !== componentIndex) } : entry)); setDirty(true); }} type="button">Remover componente</button></div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Field disabled={!editable || busy} label="Identificação do componente" onChange={(value) => updateComponent(index, componentIndex, "identification", value)} value={component.identification} />
                          <Field disabled={!editable || busy} label="Nome científico" onChange={(value) => updateComponent(index, componentIndex, "scientificName", value)} value={component.scientificName} />
                          <Field disabled={!editable || busy} label="Parte utilizada" onChange={(value) => updateComponent(index, componentIndex, "plantPart", value)} value={component.plantPart} />
                          <Field disabled={!editable || busy} label="Concentração / padronização" onChange={(value) => updateComponent(index, componentIndex, "concentrationStandardization", value)} value={component.concentrationStandardization} />
                        </div>
                      </li>
                    ))}</ol> : null}
                  </section>
                </li>
              ))}
            </ol>

            {editable ? <button className="min-h-11 rounded-xl border border-dashed border-emerald-700 bg-emerald-50 px-4 text-sm font-black text-emerald-900" disabled={busy} onClick={() => { setItems([...items, emptyItem()]); setDirty(true); }} type="button">Adicionar item</button> : null}
            {!items.length ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhum item adicionado.</p> : null}

            {selected ? <details className="rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-black text-slate-800">Histórico de revisões ({selected.history.length})</summary><ol className="mt-3 grid gap-2 text-xs text-slate-600">{[...selected.history].reverse().map((entry) => <li key={`${entry.revision}:${entry.occurredAt}`}><span className="font-bold text-slate-800">Revisão {entry.revision}</span> · {entry.action === "CREATED" ? "Rascunho criado" : entry.action === "UPDATED" ? "Rascunho atualizado" : "Prescrição emitida"} · {formatter.format(new Date(entry.occurredAt))} · {entry.actorName}</li>)}</ol></details> : null}

            {reviewing ? <section aria-label="Revisão antes da emissão" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><h3 className="font-black text-emerald-950">Revisar e emitir</h3><p className="mt-1 text-sm text-emerald-900">Confira todo o conteúdo, a pessoa e o CRN. A confirmação preservará o snapshot deste documento.</p><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-800">{items.map((item) => <li key={item.key}>{item.identification}</li>)}</ol><div className="mt-4 flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800" disabled={busy} onClick={() => setReviewing(false)} type="button">Voltar à edição</button><button className="min-h-11 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white disabled:opacity-50" disabled={busy || !previewReady || !professionalCrn} onClick={() => void persist("ISSUE")} type="button">{busy ? "Emitindo…" : "Confirmar emissão"}</button></div></section> : null}

            {editable && !reviewing ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 disabled:opacity-50" disabled={!previewReady} onClick={() => setPreviewMode("VIEW")} type="button">Visualizar prévia</button><button className="min-h-11 rounded-xl border border-emerald-700 bg-emerald-50 px-4 text-sm font-black text-emerald-950 disabled:opacity-50" disabled={!previewReady} onClick={() => setPreviewMode("PRINT")} type="button">Imprimir / Salvar PDF</button></div><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-emerald-700 bg-white px-4 text-sm font-black text-emerald-900 disabled:opacity-50" disabled={busy} onClick={() => void persist("SAVE_DRAFT")} type="button">{busy ? "Salvando…" : "Salvar rascunho"}</button><button className="min-h-11 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white disabled:opacity-50" disabled={busy || !previewReady || !selected || !professionalCrn} onClick={() => setReviewing(true)} type="button">Revisar para emitir</button></div></div> : null}
            {editable && !selected ? <p className="text-right text-xs text-slate-500">Salve o rascunho antes de iniciar a revisão para emissão.</p> : null}
          </div>
        )}
      </section>

      {previewMode ? createPortal(
        <div aria-label="Prévia da prescrição de fitoterápicos em rascunho" aria-modal="true" className="herbal-prescription-preview-portal fixed inset-0 z-[100] overflow-y-auto bg-slate-950/55 backdrop-blur-sm" role="dialog">
          <HerbalPrescriptionDocument autoPrint={previewMode === "PRINT"} embedded onClose={() => setPreviewMode(undefined)} prescription={transientPreview} preview />
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
