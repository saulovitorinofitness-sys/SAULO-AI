"use client";

import { useState } from "react";
import type { AnthropometryAssessment } from "@/features/anthropometry-perimetry";
import { AssessmentStatusBadge } from "./assessment-status-badge";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" });
export function AnthropometryHistory({ assessments }: { assessments: readonly AnthropometryAssessment[] }) {
  const [expanded, setExpanded] = useState<string>();
  return <section className="rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-5"><h2 className="text-base font-black text-slate-900">7. Histórico</h2><ol className="mt-4 space-y-3">{assessments.map((assessment) => { const count = assessment.measurements.filter((item) => item.valueCm !== undefined).length; return <li className="rounded-xl border border-slate-200 p-4" key={assessment.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-slate-900">{date.format(new Date(`${assessment.assessmentDate}T00:00:00Z`))} · {assessment.type === "INITIAL" ? "Avaliação inicial" : "Reavaliação"}</p><p className="mt-1 text-xs text-slate-500">{assessment.professionalName} · {count} medidas registradas</p></div><AssessmentStatusBadge status={assessment.status} /></div><div className="mt-3 flex flex-wrap gap-2"><button aria-expanded={expanded === assessment.id} className="min-h-10 rounded-lg px-3 text-xs font-black text-[#12664f]" onClick={() => setExpanded(expanded === assessment.id ? undefined : assessment.id)} type="button">Visualizar</button><a className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-black text-[#12664f]" href="#anthropometry-comparison">Comparar</a></div>{expanded === assessment.id ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p>{assessment.professionalNotes || "Sem observações profissionais."}</p><p className="mt-2 font-semibold">Versão {assessment.version} · atualizada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(assessment.updatedAt))}</p></div> : null}</li>; })}</ol></section>;
}
