"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button, Card, FormField, Input, Select, Textarea } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import {
  SCIENTIFIC_LIBRARY_DATA_NATURES,
  SCIENTIFIC_LIBRARY_EDITORIAL_STATUSES,
  SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES,
  SCIENTIFIC_LIBRARY_PUBLICATION_TYPES,
  type ScientificLibraryDomain,
  type ScientificLibraryEvidenceCategory,
  type ScientificLibraryItem,
  type ScientificLibraryPublicationType,
} from "@/features/scientific-library/contracts";
import { normalizeExerciseAttributes } from "@/features/scientific-library/exercise-metadata";
import { scientificLibraryDomainLabels } from "@/features/scientific-library/labels";
import {
  SCIENTIFIC_LIBRARY_STATUSES,
  scientificLibraryStatusLabels,
  type ScientificLibraryDraft,
  type ScientificLibraryReferenceDraft,
} from "@/features/scientific-library/management-contracts";
import {
  SCIENTIFIC_LIBRARY_AREAS,
  scientificLibraryAreaDomains,
  scientificLibraryAreaLabels,
  type ScientificLibraryArea,
} from "@/features/scientific-library/organization";

import { ScientificExerciseFields } from "./scientific-exercise-fields";

const dataNatureLabels = {
  SCIENTIFIC: "Conteúdo científico",
  OFFICIAL_DATABASE: "Base oficial",
  PROFESSIONAL_PROTOCOL: "Protocolo profissional",
  OPERATIONAL: "Operacional",
  DEMONSTRATIVE: "Demonstrativo",
  LEGACY: "Legado",
} as const;

const editorialStatusLabels = {
  DRAFT: "Rascunho editorial",
  UNDER_REVIEW: "Em revisão editorial",
  APPROVED: "Aprovado",
  SUPERSEDED: "Substituído",
  ARCHIVED: "Arquivado",
  REJECTED: "Rejeitado",
} as const;

const publicationTypeLabels: Readonly<Record<ScientificLibraryPublicationType, string>> = {
  GUIDELINE_OR_CONSENSUS: "Diretriz ou consenso",
  SYSTEMATIC_REVIEW_META_ANALYSIS: "Revisão sistemática ou meta-análise",
  CLINICAL_TRIAL: "Ensaio clínico",
  OBSERVATIONAL_STUDY: "Estudo observacional",
  DIAGNOSTIC_STUDY: "Estudo diagnóstico",
  BIOMECHANICAL_STUDY: "Estudo biomecânico",
  TECHNICAL_BOOK_OR_MANUAL: "Livro ou manual técnico",
  OFFICIAL_DATABASE: "Base oficial",
  PROFESSIONAL_PROTOCOL: "Protocolo profissional",
  OTHER: "Outro",
  UNCLASSIFIED: "Não classificado",
};

const evidenceCategoryLabels: Readonly<Record<ScientificLibraryEvidenceCategory, string>> = {
  GUIDELINE_OR_CONSENSUS: "Diretriz ou consenso",
  SYSTEMATIC_REVIEW_META_ANALYSIS: "Revisão sistemática ou meta-análise",
  CLINICAL_TRIAL: "Ensaio clínico",
  OBSERVATIONAL_STUDY: "Estudo observacional",
  DIAGNOSTIC_STUDY: "Estudo diagnóstico",
  BIOMECHANICAL_STUDY: "Estudo biomecânico",
  TECHNICAL_REFERENCE: "Referência técnica",
  OFFICIAL_DATABASE: "Base oficial",
  PROFESSIONAL_EXPERIENCE: "Experiência profissional",
  UNCLASSIFIED: "Não classificado",
};

const operationalStatusLabels = {
  ...scientificLibraryStatusLabels,
  DRAFT: "Rascunho operacional",
  REVIEW: "Em revisão operacional",
  ACTIVE: "Ativo operacional",
  INACTIVE: "Inativo operacional",
} as const;

const editableEditorialStatuses = SCIENTIFIC_LIBRARY_EDITORIAL_STATUSES.filter(
  (status) => status !== "APPROVED",
);

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 md:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-[0.08em] text-[var(--primary)]" id={id}>{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function firstDomain(area: ScientificLibraryArea) {
  return scientificLibraryAreaDomains[area][0];
}

function referenceFromItem(item: ScientificLibraryItem): ScientificLibraryReferenceDraft[] {
  return item.references?.map((reference) => ({
    sourceTitle: reference.title ?? reference.sourceTitle ?? "",
    fullCitation: reference.fullCitation,
    authors:
      reference.authors ??
      (reference.institutionOrJournal
        ? undefined
        : reference.authorsOrInstitution),
    institutionOrJournal: reference.institutionOrJournal,
    publicationYear: reference.publicationYear,
    doi: reference.doi,
    pmid: reference.pmid,
    isbn: reference.isbn,
    officialUrl: reference.officialUrl,
    publicationType: reference.publicationType,
    evidenceCategory: reference.evidenceLevel ?? reference.evidenceCategory,
    language: reference.language,
    notes: reference.notes,
  })) ?? [];
}

function initialDraft(area: ScientificLibraryArea, domain?: ScientificLibraryDomain, item?: ScientificLibraryItem): ScientificLibraryDraft {
  if (item) {
    return {
      area: item.area ?? area,
      domain: item.domain,
      name: item.name,
      description: item.description,
      tags: [...item.tags],
      source: item.source,
      professionalNotes: item.professionalNotes ?? "",
      status: item.status ?? "DRAFT",
      externalCode: item.externalCode ?? "",
      classificationSystem: item.classificationSystem ?? "",
      sourceVersion: item.sourceVersion ?? "",
      attributes: normalizeExerciseAttributes(item.attributes),
      dataNature: item.dataNature ?? "DEMONSTRATIVE",
      editorialStatus: item.editorialStatus ?? "DRAFT",
      publicationType: item.publicationType ?? "UNCLASSIFIED",
      evidenceCategory: item.evidenceCategory ?? "UNCLASSIFIED",
      technicalContent: item.technicalContent ?? "",
      professionalApplication: item.professionalApplication ?? "",
      targetPopulation: item.targetPopulation ?? "",
      indications: item.indications ?? "",
      contraindications: item.contraindications ?? "",
      precautions: item.precautions ?? "",
      limitations: item.limitations ?? "",
      editorialVersion: item.editorialVersion ?? 1,
      references: referenceFromItem(item),
    };
  }
  return {
    area,
    domain: domain && scientificLibraryAreaDomains[area].includes(domain) ? domain : firstDomain(area),
    name: "",
    description: "",
    tags: [],
    source: "",
    professionalNotes: "",
    status: "DRAFT",
    externalCode: "",
    classificationSystem: "",
    sourceVersion: "",
    attributes: {},
    dataNature: "SCIENTIFIC",
    editorialStatus: "DRAFT",
    publicationType: "UNCLASSIFIED",
    evidenceCategory: "UNCLASSIFIED",
    technicalContent: "",
    professionalApplication: "",
    targetPopulation: "",
    indications: "",
    contraindications: "",
    precautions: "",
    limitations: "",
    editorialVersion: 1,
    references: [],
  };
}

function optionalReferenceValue(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

type SaveDisposition = "EXIT" | "ADD_ANOTHER";

export function ScientificLibraryItemForm({ initialArea, initialDomain, initialItem, onCancel, onSaved }: {
  initialArea: ScientificLibraryArea;
  initialDomain?: ScientificLibraryDomain;
  initialItem?: ScientificLibraryItem;
  onCancel: () => void;
  onSaved: (item: ScientificLibraryItem, disposition: SaveDisposition) => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(initialArea, initialDomain, initialItem));
  const [tags, setTags] = useState(() => initialItem?.tags.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    if (!dirty) return;
    const preventAccidentalExit = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventAccidentalExit);
    return () => window.removeEventListener("beforeunload", preventAccidentalExit);
  }, [dirty]);

  function changeDraft(next: ScientificLibraryDraft) {
    setDraft(next);
    setDirty(true);
  }

  function changeTags(value: string) {
    setTags(value);
    setDirty(true);
  }

  function attribute(key: string) {
    const value = draft.attributes[key];
    return typeof value === "string" ? value : "";
  }

  function setAttribute(key: string, value: string) {
    setDraft((current) => ({ ...current, attributes: { ...current.attributes, [key]: value } }));
    setDirty(true);
  }

  function selectArea(area: ScientificLibraryArea) {
    setDraft((current) => ({ ...current, area, domain: firstDomain(area), attributes: {} }));
    setDirty(true);
  }

  function addReference() {
    changeDraft({
      ...draft,
      references: [...(draft.references ?? []), {
        sourceTitle: "",
        publicationType: "UNCLASSIFIED",
        evidenceCategory: "UNCLASSIFIED",
      }],
    });
  }

  function changeReference(index: number, reference: ScientificLibraryReferenceDraft) {
    changeDraft({ ...draft, references: (draft.references ?? []).map((current, currentIndex) => currentIndex === index ? reference : current) });
  }

  function removeReference(index: number) {
    changeDraft({ ...draft, references: (draft.references ?? []).filter((_, currentIndex) => currentIndex !== index) });
  }

  function cancel() {
    if (dirty && !window.confirm("Existem alterações não salvas. Deseja voltar à Biblioteca e descartá-las?")) return;
    onCancel();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const disposition: SaveDisposition = submitter?.value === "ADD_ANOTHER" ? "ADD_ANOTHER" : "EXIT";
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/scientific-library", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...developmentUserRequestHeaders() },
      body: JSON.stringify({
        mode: initialItem ? "UPDATE" : "MANUAL",
        ...(initialItem ? { id: initialItem.id } : {}),
        draft: { ...draft, tags: tags.split(/[;,|]/).map((entry) => entry.trim()).filter(Boolean) },
      }),
    });
    const result = (await response.json().catch(() => null)) as { item?: ScientificLibraryItem; message?: string } | null;
    if (!response.ok || !result?.item) {
      setMessage(result?.message ?? "Não foi possível salvar o item.");
      setSaving(false);
      return;
    }
    setDirty(false);
    onSaved(result.item, disposition);
    if (disposition === "ADD_ANOTHER" && !initialItem) {
      setDraft(initialDraft(draft.area, draft.domain));
      setTags("");
      setMessage(draft.domain === "EXERCISE" ? "Exercício salvo com sucesso." : "Item salvo com sucesso.");
      setSaving(false);
      setFormVersion((current) => current + 1);
      window.setTimeout(() => document.getElementById("knowledge-name")?.focus(), 0);
    }
  }

  const posturalFinding = draft.domain === "POSTURAL_CHANGE";
  const condition = draft.domain === "POSTURAL_CONDITION" || draft.domain === "PATHOLOGY";
  const exercise = draft.domain === "EXERCISE";
  const approvedRecord = initialItem?.editorialStatus === "APPROVED";
  const references = draft.references ?? [];

  if (approvedRecord) {
    return (
      <Card className="mb-4 p-5 md:p-6" variant="elevated">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Conteúdo aprovado · versão {initialItem.editorialVersion ?? 1}</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{initialItem.name}</h2>
          </div>
          <Button onClick={onCancel} size="small" type="button" variant="ghost">Fechar / Voltar à Biblioteca</Button>
        </div>
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950" role="status">
          Esta versão está aprovada e permanece imutável. Alterações devem ocorrer em uma nova versão e passar pelo fluxo editorial próprio.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4 p-4 md:p-6" variant="elevated">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Gestão científica e editorial</p>
          <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{initialItem ? "Editar item" : "Novo item"}</h2>
        </div>
        <Button onClick={cancel} size="small" type="button" variant="ghost">Fechar / Voltar à Biblioteca</Button>
      </div>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-5 text-amber-950">
        Salvar como rascunho não representa aprovação científica. A aprovação editorial ocorrerá em fluxo próprio, com responsável, data e histórico.
      </p>

      <form className="mt-4 grid gap-4" key={formVersion} onSubmit={submit}>
        <Section id="scientific-identification" title="A — Identificação">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="knowledge-area" label="Área profissional" required><Select disabled={Boolean(initialItem)} id="knowledge-area" onChange={(event) => selectArea(event.target.value as ScientificLibraryArea)} value={draft.area}>{SCIENTIFIC_LIBRARY_AREAS.map((area) => <option key={area} value={area}>{scientificLibraryAreaLabels[area]}</option>)}</Select></FormField>
            <FormField id="knowledge-domain" label="Domínio" required><Select disabled={Boolean(initialItem)} id="knowledge-domain" onChange={(event) => changeDraft({ ...draft, domain: event.target.value as ScientificLibraryDomain, attributes: {} })} value={draft.domain}>{scientificLibraryAreaDomains[draft.area].map((domain) => <option key={domain} value={domain}>{scientificLibraryDomainLabels[domain]}</option>)}</Select></FormField>
            {!exercise ? <div className="md:col-span-2"><FormField id="knowledge-name" label="Título" required><Input autoFocus id="knowledge-name" maxLength={200} onChange={(event) => changeDraft({ ...draft, name: event.target.value })} required value={draft.name} /></FormField></div> : null}
            {!exercise ? <div className="md:col-span-2"><FormField id="knowledge-description" label={posturalFinding ? "Descrição observacional" : "Descrição / resumo"}><Textarea className="min-h-24" id="knowledge-description" maxLength={3000} onChange={(event) => changeDraft({ ...draft, description: event.target.value })} rows={3} value={draft.description} /></FormField></div> : null}
            {!exercise ? <div className="md:col-span-2"><FormField id="knowledge-tags" label="Tags" help="Separe por vírgula, ponto e vírgula ou barra vertical."><Input id="knowledge-tags" onChange={(event) => changeTags(event.target.value)} value={tags} /></FormField></div> : null}
          </div>
          {exercise ? <p className="mt-3 text-xs text-[var(--muted)]">A identificação e os campos técnicos específicos do exercício permanecem no bloco profissional abaixo.</p> : null}
          {posturalFinding ? <div className="mt-4 grid gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 md:grid-cols-3">
            <p className="md:col-span-3 text-sm font-bold text-amber-900">Achado/alteração observacional. Não representa diagnóstico clínico automático.</p>
            <FormField id="finding-region" label="Região corporal"><Input id="finding-region" onChange={(event) => setAttribute("Região corporal", event.target.value)} value={attribute("Região corporal")} /></FormField>
            <FormField id="finding-view" label="Plano ou vista aplicável"><Input id="finding-view" onChange={(event) => setAttribute("Plano ou vista", event.target.value)} value={attribute("Plano ou vista")} /></FormField>
            <FormField id="finding-relevance" label="Relevância"><Input id="finding-relevance" onChange={(event) => setAttribute("Relevância", event.target.value)} value={attribute("Relevância")} /></FormField>
          </div> : null}
          {condition ? <div className="mt-4 grid gap-4 rounded-xl border border-[var(--line)] p-4 md:grid-cols-3">
            <FormField id="external-code" label="Código externo" help="Opcional. Não invente códigos."><Input id="external-code" onChange={(event) => changeDraft({ ...draft, externalCode: event.target.value })} value={draft.externalCode} /></FormField>
            <FormField id="classification-system" label="Sistema de classificação"><Input id="classification-system" onChange={(event) => changeDraft({ ...draft, classificationSystem: event.target.value })} value={draft.classificationSystem} /></FormField>
            <FormField id="source-version" label="Versão da fonte"><Input id="source-version" onChange={(event) => changeDraft({ ...draft, sourceVersion: event.target.value })} value={draft.sourceVersion} /></FormField>
          </div> : null}
        </Section>

        {exercise ? <Section id="exercise-specific-fields" title="Dados específicos do exercício" description="Cadastro profissional compatível; não equivale a um artigo científico isolado."><div className="grid gap-4"><ScientificExerciseFields draft={draft} onChange={changeDraft} onDirty={() => setDirty(true)} onTagsChange={changeTags} tags={tags} /></div></Section> : null}

        <Section id="scientific-editorial-classification" title="B — Classificação editorial" description="Natureza, situação editorial e evidência são classificações independentes.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField id="data-nature" label="Natureza do dado" required><Select id="data-nature" onChange={(event) => changeDraft({ ...draft, dataNature: event.target.value as NonNullable<ScientificLibraryDraft["dataNature"]> })} value={draft.dataNature ?? "DEMONSTRATIVE"}>{SCIENTIFIC_LIBRARY_DATA_NATURES.map((nature) => <option key={nature} value={nature}>{dataNatureLabels[nature]}</option>)}</Select></FormField>
            <FormField id="editorial-status" label="Status editorial" required><Select id="editorial-status" onChange={(event) => changeDraft({ ...draft, editorialStatus: event.target.value as NonNullable<ScientificLibraryDraft["editorialStatus"]> })} value={draft.editorialStatus ?? "DRAFT"}>{editableEditorialStatuses.map((status) => <option key={status} value={status}>{editorialStatusLabels[status]}</option>)}</Select></FormField>
            <FormField id="editorial-version" label="Versão editorial" required><Input id="editorial-version" min={1} onChange={(event) => changeDraft({ ...draft, editorialVersion: event.target.valueAsNumber || 1 })} required type="number" value={draft.editorialVersion ?? 1} /></FormField>
            <FormField id="publication-type" label="Tipo de publicação"><Select id="publication-type" onChange={(event) => changeDraft({ ...draft, publicationType: event.target.value as ScientificLibraryPublicationType })} value={draft.publicationType ?? "UNCLASSIFIED"}>{SCIENTIFIC_LIBRARY_PUBLICATION_TYPES.map((type) => <option key={type} value={type}>{publicationTypeLabels[type]}</option>)}</Select></FormField>
            <FormField id="evidence-category" label="Categoria de evidência" help="Não atribui qualidade automaticamente."><Select id="evidence-category" onChange={(event) => changeDraft({ ...draft, evidenceCategory: event.target.value as ScientificLibraryEvidenceCategory })} value={draft.evidenceCategory ?? "UNCLASSIFIED"}>{SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES.map((category) => <option key={category} value={category}>{evidenceCategoryLabels[category]}</option>)}</Select></FormField>
          </div>
        </Section>

        <Section id="scientific-professional-content" title="C — Conteúdo profissional estruturado">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="technical-content" label="Conteúdo técnico"><Textarea className="min-h-24" id="technical-content" maxLength={30000} onChange={(event) => changeDraft({ ...draft, technicalContent: event.target.value })} rows={3} value={draft.technicalContent ?? ""} /></FormField>
            <FormField id="professional-application" label="Aplicação profissional"><Textarea className="min-h-24" id="professional-application" maxLength={10000} onChange={(event) => changeDraft({ ...draft, professionalApplication: event.target.value })} rows={3} value={draft.professionalApplication ?? ""} /></FormField>
            <FormField id="target-population" label="População-alvo"><Textarea className="min-h-24" id="target-population" maxLength={5000} onChange={(event) => changeDraft({ ...draft, targetPopulation: event.target.value })} rows={3} value={draft.targetPopulation ?? ""} /></FormField>
            <FormField id="indications" label="Indicações"><Textarea className="min-h-24" id="indications" maxLength={10000} onChange={(event) => changeDraft({ ...draft, indications: event.target.value })} rows={3} value={draft.indications ?? ""} /></FormField>
            <FormField id="contraindications" label="Contraindicações"><Textarea className="min-h-24" id="contraindications" maxLength={10000} onChange={(event) => changeDraft({ ...draft, contraindications: event.target.value })} rows={3} value={draft.contraindications ?? ""} /></FormField>
            <FormField id="precautions" label="Precauções"><Textarea className="min-h-24" id="precautions" maxLength={10000} onChange={(event) => changeDraft({ ...draft, precautions: event.target.value })} rows={3} value={draft.precautions ?? ""} /></FormField>
            <div className="md:col-span-2"><FormField id="limitations" label="Limitações"><Textarea className="min-h-24" id="limitations" maxLength={10000} onChange={(event) => changeDraft({ ...draft, limitations: event.target.value })} rows={3} value={draft.limitations ?? ""} /></FormField></div>
          </div>
        </Section>

        <Section id="scientific-references" title="D — Referências bibliográficas" description="Informe somente dados verificáveis. Identificadores e URL são opcionais.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text-secondary)]">{references.length ? `${references.length} referência(s)` : "Nenhuma referência adicionada."}</p>
            <Button onClick={addReference} size="small" type="button" variant="outline">+ Adicionar referência</Button>
          </div>
          <div className="mt-4 grid gap-4">
            {references.map((reference, index) => <fieldset className="rounded-xl border border-[var(--line)] p-4" key={`reference-${index}`}>
              <legend className="px-2 text-sm font-black text-[var(--text-primary)]">Referência {index + 1}</legend>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-3"><FormField id={`reference-title-${index}`} label="Título da fonte" required><Input id={`reference-title-${index}`} maxLength={500} onChange={(event) => changeReference(index, { ...reference, sourceTitle: event.target.value })} required value={reference.sourceTitle} /></FormField></div>
                <FormField id={`reference-authors-${index}`} label="Autores"><Input id={`reference-authors-${index}`} maxLength={2000} onChange={(event) => changeReference(index, { ...reference, authors: optionalReferenceValue(event.target.value) })} value={reference.authors ?? ""} /></FormField>
                <FormField id={`reference-institution-${index}`} label="Instituição ou periódico"><Input id={`reference-institution-${index}`} maxLength={500} onChange={(event) => changeReference(index, { ...reference, institutionOrJournal: optionalReferenceValue(event.target.value) })} value={reference.institutionOrJournal ?? ""} /></FormField>
                <FormField id={`reference-year-${index}`} label="Ano"><Input id={`reference-year-${index}`} max={new Date().getUTCFullYear() + 1} min={1000} onChange={(event) => changeReference(index, { ...reference, publicationYear: Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber })} type="number" value={reference.publicationYear ?? ""} /></FormField>
                <FormField id={`reference-doi-${index}`} label="DOI" help="Opcional; formato 10.xxxx/sufixo."><Input id={`reference-doi-${index}`} maxLength={255} onChange={(event) => changeReference(index, { ...reference, doi: optionalReferenceValue(event.target.value) })} value={reference.doi ?? ""} /></FormField>
                <FormField id={`reference-pmid-${index}`} label="PMID" help="Opcional; somente números."><Input id={`reference-pmid-${index}`} inputMode="numeric" onChange={(event) => changeReference(index, { ...reference, pmid: optionalReferenceValue(event.target.value) })} value={reference.pmid ?? ""} /></FormField>
                <FormField id={`reference-isbn-${index}`} label="ISBN" help="Opcional; ISBN-10 ou ISBN-13."><Input id={`reference-isbn-${index}`} maxLength={32} onChange={(event) => changeReference(index, { ...reference, isbn: optionalReferenceValue(event.target.value) })} value={reference.isbn ?? ""} /></FormField>
                <FormField id={`reference-url-${index}`} label="URL oficial"><Input id={`reference-url-${index}`} maxLength={2048} onChange={(event) => changeReference(index, { ...reference, officialUrl: optionalReferenceValue(event.target.value) })} type="url" value={reference.officialUrl ?? ""} /></FormField>
                <FormField id={`reference-publication-${index}`} label="Tipo de publicação"><Select id={`reference-publication-${index}`} onChange={(event) => changeReference(index, { ...reference, publicationType: event.target.value as ScientificLibraryPublicationType })} value={reference.publicationType}>{SCIENTIFIC_LIBRARY_PUBLICATION_TYPES.map((type) => <option key={type} value={type}>{publicationTypeLabels[type]}</option>)}</Select></FormField>
                <FormField id={`reference-evidence-${index}`} label="Categoria de evidência"><Select id={`reference-evidence-${index}`} onChange={(event) => changeReference(index, { ...reference, evidenceCategory: event.target.value as ScientificLibraryEvidenceCategory })} value={reference.evidenceCategory}>{SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES.map((category) => <option key={category} value={category}>{evidenceCategoryLabels[category]}</option>)}</Select></FormField>
                <FormField id={`reference-language-${index}`} label="Idioma"><Input id={`reference-language-${index}`} maxLength={80} onChange={(event) => changeReference(index, { ...reference, language: optionalReferenceValue(event.target.value) })} value={reference.language ?? ""} /></FormField>
                <div className="md:col-span-2 xl:col-span-3"><FormField id={`reference-citation-${index}`} label="Citação bibliográfica completa"><Textarea className="min-h-24" id={`reference-citation-${index}`} maxLength={4000} onChange={(event) => changeReference(index, { ...reference, fullCitation: optionalReferenceValue(event.target.value) })} rows={3} value={reference.fullCitation ?? ""} /></FormField></div>
                <div className="md:col-span-2 xl:col-span-3"><FormField id={`reference-notes-${index}`} label="Observações"><Textarea className="min-h-24" id={`reference-notes-${index}`} maxLength={3000} onChange={(event) => changeReference(index, { ...reference, notes: optionalReferenceValue(event.target.value) })} rows={3} value={reference.notes ?? ""} /></FormField></div>
              </div>
              <div className="mt-3 flex justify-end"><Button onClick={() => removeReference(index)} size="small" type="button" variant="ghost">Remover referência</Button></div>
            </fieldset>)}
          </div>
        </Section>

        {!exercise ? <Section id="scientific-operational-control" title="E — Controle operacional" description="O status operacional não representa aprovação editorial.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="knowledge-source" label="Fonte ou origem legada"><Input id="knowledge-source" maxLength={500} onChange={(event) => changeDraft({ ...draft, source: event.target.value })} value={draft.source} /></FormField>
            <FormField id="knowledge-status" label="Status operacional" required><Select id="knowledge-status" onChange={(event) => changeDraft({ ...draft, status: event.target.value as ScientificLibraryDraft["status"] })} value={draft.status}>{SCIENTIFIC_LIBRARY_STATUSES.map((status) => <option key={status} value={status}>{operationalStatusLabels[status]}</option>)}</Select></FormField>
            <div className="md:col-span-2"><FormField id="professional-notes" label="Observações profissionais"><Textarea className="min-h-24" id="professional-notes" maxLength={3000} onChange={(event) => changeDraft({ ...draft, professionalNotes: event.target.value })} rows={3} value={draft.professionalNotes} /></FormField></div>
          </div>
        </Section> : <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-xs text-[var(--muted)]">O controle operacional do exercício permanece no bloco específico para preservar compatibilidade com o cadastro atual. “Ativo” continua sendo apenas um status operacional.</p>}

        <p aria-live="polite" className="min-h-5 text-sm font-bold text-[var(--text-secondary)]" role="status">{message}</p>
        <div className="flex flex-wrap gap-3">
          {initialItem ? <Button loading={saving} type="submit" value="EXIT">Salvar alterações</Button> : <><Button loading={saving} type="submit" value="EXIT">Salvar e sair</Button><Button disabled={saving} type="submit" value="ADD_ANOTHER" variant="secondary">Salvar e adicionar outro</Button></>}
          <Button disabled={saving} onClick={cancel} type="button" variant="outline">Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}
