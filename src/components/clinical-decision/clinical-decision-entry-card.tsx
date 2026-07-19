"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clinicalCollectionService, type CurrentAttendanceView } from "@/features/clinical-collection";

type CardState = "COLLECTION_BLOCKED" | "LOADING_PANEL" | "PANEL_REVIEW_REQUIRED" | "MOTOR_AVAILABLE";

export function ClinicalDecisionEntryCard({ attendance }: { attendance: CurrentAttendanceView }) {
  const collectionComplete = attendance.status === "COLLECTION_COMPLETE";
  const [state, setState] = useState<CardState>(collectionComplete ? "LOADING_PANEL" : "COLLECTION_BLOCKED");

  useEffect(() => {
    if (!collectionComplete) return;
    let active = true;
    void clinicalCollectionService.getClinicalPanel({ patientId: attendance.patientId, attendanceId: attendance.attendanceId, scenario: attendance.scenario }).then((panel) => {
      if (!active) return;
      setState(panel?.accessible && panel.confirmedAt ? "MOTOR_AVAILABLE" : "PANEL_REVIEW_REQUIRED");
    });
    return () => { active = false; };
  }, [attendance, collectionComplete]);

  const collectionHref = `/pacientes/${attendance.patientId}/atendimentos/${attendance.attendanceId}/coleta?scenario=${attendance.scenario}`;
  const panelHref = `/pacientes/${attendance.patientId}/atendimentos/${attendance.attendanceId}/painel-clinico?scenario=${attendance.scenario}`;
  const decisionHref = `/pacientes/${attendance.patientId}/atendimentos/${attendance.attendanceId}/decisao-clinica?scenario=${attendance.scenario}`;
  const content = {
    COLLECTION_BLOCKED: { description: "Conclua todas as etapas obrigatórias da coleta clínica antes da revisão profissional.", label: "Motor bloqueado" },
    LOADING_PANEL: { description: "Verificando a confirmação profissional do Painel Clínico Integrado.", label: "Verificando painel…" },
    PANEL_REVIEW_REQUIRED: { description: "A coleta está concluída. Revise e confirme os dados no Painel Clínico Integrado para liberar o Motor.", label: "Revisar no Painel Clínico" },
    MOTOR_AVAILABLE: { description: "A coleta e a revisão profissional do Painel Clínico estão confirmadas.", label: "Abrir Motor de Decisão" },
  }[state];
  const href = state === "MOTOR_AVAILABLE" ? decisionHref : state === "PANEL_REVIEW_REQUIRED" ? panelHref : collectionHref;

  return <section className="rounded-2xl border border-[#b8cec5] bg-gradient-to-br from-[#f4faf7] to-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#397563]">Análise profissional</p><h2 className="mt-1 text-lg font-black text-[#103f32]">Decisão Clínica</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">{content.description}</p></div>{state === "LOADING_PANEL" ? <span aria-live="polite" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-black text-slate-500">{content.label}</span> : state === "COLLECTION_BLOCKED" ? <span aria-disabled="true" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-5 text-sm font-black text-amber-900">{content.label}</span> : <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#12664f] px-5 text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12664f]" href={href}>{content.label}</Link>}</div></section>;
}
