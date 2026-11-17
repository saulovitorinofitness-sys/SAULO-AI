"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";
import { clinicInstitutionalDocumentIdentity } from "@/config/institution";
import type {
  HerbalPrescriptionComponent,
  HerbalPrescriptionItem,
  HerbalPrescriptionView,
} from "@/features/herbal-prescriptions/contracts";
import { formulaModelDisplayName } from "@/features/herbal-prescriptions/formula-library";
import { herbalPrescriptionDocumentTitle } from "@/features/herbal-prescriptions/presentation";

const categoryLabels = {
  HERBAL: "Fitoterápico",
  SUPPLEMENT: "Suplemento",
  OTHER_FORMULATION: "Outra formulação",
} as const;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "America/Sao_Paulo",
});

function hasText(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function hasPrintableContent(item: HerbalPrescriptionItem) {
  return [
    item.identification,
    item.scientificName,
    item.plantPart,
    item.presentation,
    item.concentrationStandardization,
    item.dose,
    item.route,
    item.frequency,
    item.duration,
    item.quantity,
    item.orientations,
  ].some(hasText) || item.components.some((component) => hasText(component.identification));
}

function Detail({ label, children, wide = false }: {
  readonly label: string;
  readonly children: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[8px] font-black uppercase tracking-[0.08em] text-[#60746d]">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-[10px] font-semibold leading-[1.45] text-[#20312b]">{children}</dd>
    </div>
  );
}

function ComponentDetails({ component }: {
  readonly component: HerbalPrescriptionComponent;
}) {
  return (
    <li className="break-inside-avoid border-b border-[#e2ebe7] py-1.5 last:border-b-0">
      <p className="text-[10px] font-black text-[#20312b]">{component.identification}</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {hasText(component.scientificName) ? <Detail label="Nome científico">{component.scientificName}</Detail> : null}
        {hasText(component.plantPart) ? <Detail label="Parte utilizada">{component.plantPart}</Detail> : null}
        {hasText(component.concentrationStandardization) ? <Detail label="Concentração / padronização" wide>{component.concentrationStandardization}</Detail> : null}
      </dl>
    </li>
  );
}

function PrescriptionItem({ item, index }: {
  readonly item: HerbalPrescriptionItem;
  readonly index: number;
}) {
  const visibleComponents = item.components.filter((component) => hasText(component.identification));
  return (
    <li className="herbal-prescription-item break-inside-avoid border-b border-[#c9ddd5] py-3 last:border-b-0" data-herbal-item={index + 1}>
      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#60746d]">{categoryLabels[item.category]}</p>
      {hasText(item.identification) ? <h2 className="mt-0.5 text-[12px] font-black leading-5 text-[#12664f]">{formulaModelDisplayName(item.identification)}</h2> : null}
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
        {hasText(item.scientificName) ? <Detail label="Nome científico">{item.scientificName}</Detail> : null}
        {hasText(item.plantPart) ? <Detail label="Parte utilizada">{item.plantPart}</Detail> : null}
        {hasText(item.presentation) ? <Detail label="Apresentação">{item.presentation}</Detail> : null}
        {hasText(item.concentrationStandardization) ? <Detail label="Concentração / padronização">{item.concentrationStandardization}</Detail> : null}
        {hasText(item.dose) ? <Detail label="Dose">{item.dose}</Detail> : null}
        {hasText(item.route) ? <Detail label="Via">{item.route}</Detail> : null}
        {hasText(item.frequency) ? <Detail label="Frequência">{item.frequency}</Detail> : null}
        {hasText(item.duration) ? <Detail label="Duração">{item.duration}</Detail> : null}
        {hasText(item.quantity) ? <Detail label="Quantidade" wide>{item.quantity}</Detail> : null}
      </dl>
      {visibleComponents.length ? (
        <section className="mt-3 border-t border-[#d9e7e1] pt-3">
          <h3 className="text-[9px] font-black uppercase tracking-[0.1em] text-[#60746d]">Composição</h3>
          <ul className="mt-1">{visibleComponents.map((component, componentIndex) => (
            <ComponentDetails component={component} key={`${component.identification}:${componentIndex}`} />
          ))}</ul>
        </section>
      ) : null}
      {hasText(item.orientations) ? (
        <section className="mt-3 rounded-lg border border-[#b9d5ca] bg-[#f0f8f4] px-3 py-2.5">
          <h3 className="text-[9px] font-black uppercase tracking-[0.1em] text-[#12664f]">Modo de usar</h3>
          <p className="mt-1 whitespace-pre-wrap text-[10px] font-semibold leading-[1.5] text-[#20312b]">{item.orientations}</p>
        </section>
      ) : null}
    </li>
  );
}

export function HerbalPrescriptionDocument({
  prescription,
  autoPrint,
  preview = false,
  embedded = false,
  onClose,
}: {
  readonly prescription: HerbalPrescriptionView;
  readonly autoPrint: boolean;
  readonly preview?: boolean;
  readonly embedded?: boolean;
  readonly onClose?: () => void;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  useEffect(() => {
    if (!embedded) return;
    document.body.classList.add("herbal-prescription-preview-open");
    return () => document.body.classList.remove("herbal-prescription-preview-open");
  }, [embedded]);

  const snapshot = prescription.issuedSnapshot;
  const institution = snapshot?.institution ?? clinicInstitutionalDocumentIdentity();
  const patient = snapshot?.patient ?? prescription.patient;
  const professional = snapshot?.professional ?? prescription.responsibleProfessional;
  const documentDate = new Date(prescription.issuedAt ?? prescription.updatedAt);
  const birthDate = new Date(`${patient.birthDate}T12:00:00.000Z`);
  const printableItems = prescription.content.items.filter(hasPrintableContent);

  return (
    <div className="herbal-prescription-print-root min-h-screen bg-slate-100 px-3 py-5 print:min-h-0 print:bg-white print:p-0">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          body.herbal-prescription-preview-open > *:not(.herbal-prescription-preview-portal) { display: none !important; }
          body.herbal-prescription-preview-open > .herbal-prescription-preview-portal {
            display: block !important; position: static !important; inset: auto !important;
            overflow: visible !important; background: #fff !important; backdrop-filter: none !important;
          }
          body.herbal-prescription-preview-open * { visibility: hidden !important; }
          body.herbal-prescription-preview-open .herbal-prescription-print-root,
          body.herbal-prescription-preview-open .herbal-prescription-print-root * { visibility: visible !important; }
          body.herbal-prescription-preview-open .herbal-prescription-print-root {
            position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important;
          }
          .herbal-prescription-print-root { min-height: 0 !important; }
          .herbal-prescription-document {
            box-shadow: none !important; min-height: 0 !important; width: auto !important;
            max-width: none !important; padding: 0 !important;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap justify-between gap-2 print:hidden">
        {onClose ? (
          <button className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800" onClick={onClose} type="button">Voltar ao editor</button>
        ) : (
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800" href={`/entregaveis/fitoterapicos?patientId=${encodeURIComponent(prescription.patient.id)}`}>Voltar</Link>
        )}
        <button className="min-h-11 rounded-xl bg-[#12664f] px-5 text-sm font-black text-white" onClick={() => window.print()} type="button">{preview ? "Imprimir prévia / salvar em PDF" : "Imprimir / salvar em PDF"}</button>
      </div>
      <article className="herbal-prescription-document mx-auto min-h-[270mm] w-[210mm] max-w-full bg-white px-[16mm] py-[14mm] text-[#20312b] shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#12664f] pb-4">
          <InstitutionalDocumentIdentity identity={institution} />
          <p className="max-w-[28%] shrink-0 text-right text-[10px] font-medium leading-4 text-[#60746d]">{dateFormatter.format(documentDate)}</p>
        </header>

        <section className="mt-6">
          {preview ? <p className="mb-2 text-center text-[9px] font-black uppercase tracking-[0.18em] text-[#8a671d]">Rascunho - documento não emitido</p> : null}
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-[#12664f]">{herbalPrescriptionDocumentTitle(prescription.content)}</p>
          <h1 className="mt-5 text-[10px] font-black uppercase tracking-wide text-[#60746d]">Identificação da pessoa</h1>
          <dl className="mt-2 grid grid-cols-2 gap-x-10 gap-y-2 rounded-xl border border-[#c9ddd5] bg-[#f7fbf9] p-3 text-[10px]">
            <div className="col-span-2"><dt className="text-[8px] font-black uppercase text-[#60746d]">Nome</dt><dd className="mt-0.5 font-black text-[#20312b]">{patient.fullName}</dd></div>
            <div><dt className="text-[8px] font-black uppercase text-[#60746d]">Código clínico</dt><dd className="mt-0.5 font-semibold">{patient.clinicalCode}</dd></div>
            <div><dt className="text-[8px] font-black uppercase text-[#60746d]">Data de nascimento</dt><dd className="mt-0.5 font-semibold">{dateFormatter.format(birthDate)}</dd></div>
          </dl>
        </section>

        <ol className="mt-5 grid gap-3">
          {printableItems.map((item, index) => <PrescriptionItem item={item} index={index} key={`${item.identification}:${index}`} />)}
        </ol>

        <footer className="mt-5 break-inside-avoid">
          <section aria-label="Carimbo profissional e assinatura manuscrita" className="rounded-xl border border-[#c9ddd5] bg-[#fbfdfc] px-6 py-3">
            <div className="mx-auto max-w-[100mm] text-center">
              <div aria-label="Espaço em branco reservado para assinatura manuscrita" className="h-[14mm]" />
              <div className="border-t border-[#71877e] pt-2.5">
                <p className="text-[13px] font-black leading-5 text-[#20312b]">{professional.fullName}</p>
                {professional.nutritionTitle ? <p className="text-[10px] font-semibold leading-4 text-[#40564e]">{professional.nutritionTitle}</p> : null}
                {professional.crnRegistration ? <p className="text-[10px] font-bold leading-4 text-[#40564e]">{professional.crnRegistration}</p> : null}
              </div>
            </div>
          </section>
        </footer>
      </article>
    </div>
  );
}
