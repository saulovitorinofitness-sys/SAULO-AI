"use client";

import Link from "next/link";
import { useEffect } from "react";

import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";
import { clinicInstitutionalDocumentIdentity } from "@/config/institution";
import type { ExamRequestView } from "@/features/exam-requests/contracts";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "America/Sao_Paulo",
});

const legalFoundation = "Fundamentação: Lei nº 8.234/1991, art. 4º, VIII, e Resolução CFN nº 306/2003, art. 1º — solicitação de exames laboratoriais no âmbito da avaliação e do acompanhamento nutricional.";

export function ExamRequestDocument({
  request,
  autoPrint,
  preview = false,
  embedded = false,
  onClose,
}: {
  readonly request: ExamRequestView;
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
    document.body.classList.add("exam-request-embedded-preview-open");
    return () => document.body.classList.remove("exam-request-embedded-preview-open");
  }, [embedded]);

  const issuedAt = new Date(request.issuedAt ?? request.updatedAt);
  const issuedSnapshot = request.issuedSnapshot;
  const institutionalIdentity = issuedSnapshot?.institution ?? clinicInstitutionalDocumentIdentity();
  const patient = issuedSnapshot?.patient ?? request.patient;
  const birthDate = new Date(`${patient.birthDate}T12:00:00.000Z`);
  const compactExamList = request.content.requestedExams.length >= 9;
  const professional = issuedSnapshot?.professional ?? {
    fullName: request.responsibleProfessional.fullName,
    nutritionTitle: request.responsibleProfessional.nutritionTitle,
    crnRegistration: request.responsibleProfessional.crnRegistration,
  };

  return (
    <div className="exam-request-print-root min-h-screen bg-slate-100 px-3 py-5 print:min-h-0 print:bg-white print:p-0">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          body.exam-request-embedded-preview-open > *:not(.exam-request-preview-portal) { display: none !important; }
          body.exam-request-embedded-preview-open > .exam-request-preview-portal {
            display: block !important;
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            background: #fff !important;
            backdrop-filter: none !important;
          }
          body.exam-request-embedded-preview-open * { visibility: hidden !important; }
          body.exam-request-embedded-preview-open .exam-request-print-root,
          body.exam-request-embedded-preview-open .exam-request-print-root * { visibility: visible !important; }
          body.exam-request-embedded-preview-open .exam-request-print-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
          }
          .exam-request-print-root { min-height: 0 !important; }
          .exam-request-document {
            box-shadow: none !important;
            min-height: 0 !important;
            width: auto !important;
            max-width: none !important;
            padding: 0 !important;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap justify-between gap-2 print:hidden">
        {onClose ? <button className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800" onClick={onClose} type="button">Voltar ao editor</button> : <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800" href={`/entregaveis/solicitacoes-exames?patientId=${encodeURIComponent(request.patient.id)}`}>Voltar</Link>}
        <button className="min-h-11 rounded-xl bg-[#12664f] px-5 text-sm font-black text-white" onClick={() => window.print()} type="button">{preview ? "Imprimir prévia / salvar em PDF" : "Imprimir / salvar em PDF"}</button>
      </div>
      <article className="exam-request-document mx-auto min-h-[270mm] w-[210mm] max-w-full bg-white px-[16mm] py-[14mm] text-[#20312b] shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#12664f] pb-4">
          <InstitutionalDocumentIdentity identity={institutionalIdentity} />
          <p className="max-w-[28%] shrink-0 text-right text-[10px] font-medium leading-4 text-[#60746d]">{dateFormatter.format(issuedAt)}</p>
        </header>

        <section className="mt-7">
          {preview ? <p className="mb-2 text-center text-[9px] font-black uppercase tracking-[0.18em] text-[#8a671d]">Rascunho — documento não emitido</p> : null}
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-[#12664f]">Solicitação de exames</p>
          <h2 className="mt-5 text-sm font-black uppercase tracking-wide text-[#60746d]">Identificação da pessoa</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-12 gap-y-3 rounded-xl border border-[#c9ddd5] bg-[#f7fbf9] p-4 text-sm">
            <div className="col-span-2"><dt className="text-[10px] font-black uppercase text-[#60746d]">Nome</dt><dd className="mt-1 font-black text-[#20312b]">{patient.fullName}</dd></div>
            <div><dt className="text-[10px] font-black uppercase text-[#60746d]">Código clínico</dt><dd className="mt-1 font-semibold">{patient.clinicalCode}</dd></div>
            <div><dt className="text-[10px] font-black uppercase text-[#60746d]">Data de nascimento</dt><dd className="mt-1 font-semibold">{dateFormatter.format(birthDate)}</dd></div>
          </dl>
        </section>

        <section className="mt-7">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#12664f]">Exames solicitados</h2>
          <ol className={`mt-3 grid pl-6 text-[#20312b] ${compactExamList ? "gap-1 text-[11px] leading-4" : "gap-2 text-sm leading-6"}`}>
            {request.content.requestedExams.map((exam, index) => <li className={`break-inside-avoid list-decimal border-b border-[#e3eee9] pl-1 ${compactExamList ? "pb-1" : "pb-2"}`} key={`${exam}:${index}`}>{exam}</li>)}
          </ol>
        </section>

        {request.content.justification ? (
          <section className="mt-7 break-inside-avoid rounded-xl border border-[#d9e7e1] p-4">
            <h2 className="text-xs font-black uppercase tracking-wide text-[#60746d]">Justificativa</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{request.content.justification}</p>
          </section>
        ) : null}
        {request.content.orientations ? (
          <section className="mt-4 break-inside-avoid rounded-xl border border-[#d9e7e1] bg-[#f7fbf9] p-4">
            <h2 className="text-xs font-black uppercase tracking-wide text-[#60746d]">Orientações</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{request.content.orientations}</p>
          </section>
        ) : null}

        <footer className="mt-10">
          <section aria-label="Carimbo profissional e assinatura manuscrita" className="break-inside-avoid rounded-xl border border-[#c9ddd5] bg-[#fbfdfc] px-6 py-5">
            <div className="mx-auto max-w-[100mm] text-center">
              <div aria-label="Espaço em branco reservado para assinatura manuscrita" className="h-[22mm]" />
              <div className="border-t border-[#71877e] pt-3">
                <p className="text-[15px] font-black leading-5 text-[#20312b]">{professional.fullName}</p>
                {professional.nutritionTitle ? <p className="text-xs font-semibold leading-5 text-[#40564e]">{professional.nutritionTitle}</p> : null}
                {professional.crnRegistration ? <p className="text-xs font-bold leading-5 text-[#40564e]">{professional.crnRegistration}</p> : null}
              </div>
            </div>
          </section>
          <p className="mt-8 border-t border-[#b8cbc3] pt-3 text-[10px] leading-[1.5] text-[#40564e] print:text-[10pt] print:leading-[1.45]">{legalFoundation}</p>
        </footer>
      </article>
    </div>
  );
}
