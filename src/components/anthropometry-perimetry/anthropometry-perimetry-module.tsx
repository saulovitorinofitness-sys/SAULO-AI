"use client";

import Link from "next/link";
import { useState } from "react";

import { ResponsiveActionBar } from "@/components/clinical-collection/responsive-action-bar";
import { SectionCard } from "@/components/clinical-collection/section-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { anthropometryPerimetryService, type AnthropometryAssessment, type AnthropometryPerimetryView } from "@/features/anthropometry-perimetry";
import { AnthropometryComparison } from "./anthropometry-comparison";
import { AnthropometryHeader } from "./anthropometry-header";
import { AnthropometryHistory } from "./anthropometry-history";
import { BasicMeasurementsCard } from "./basic-measurements-card";
import { BilateralComparisonCard } from "./bilateral-comparison-card";
import { BodyRegionOverview } from "./body-region-overview";
import { PerimetryForm } from "./perimetry-form";

type Action = "START" | "SAVE_DRAFT" | "COMPLETE" | "REVIEW";

export function AnthropometryPerimetryModule({ initialView }: { initialView: AnthropometryPerimetryView }) {
  const [view, setView] = useState(initialView); const [assessment, setAssessment] = useState(initialView.currentAssessment); const [editing, setEditing] = useState(initialView.canEdit && (initialView.currentAssessment.status === "IN_PROGRESS" || initialView.currentAssessment.status === "NOT_STARTED")); const [state, setState] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE"); const [errors, setErrors] = useState<string[]>([]);
  const collectionHref = `/pacientes/${view.patientId}/atendimentos/${view.attendanceId}/coleta?scenario=${view.collectionScenario}&step=ANTHROPOMETRY`;
  function validateComplete(current: AnthropometryAssessment) { return current.measurements.flatMap((item) => item.notPerformed && !item.reason?.trim() ? [`Informe a justificativa de ${item.label}.`] : !item.notPerformed && item.valueCm === undefined ? [`Informe ${item.label} ou marque como não realizado.`] : []); }
  async function execute(action: Action) {
    if (!view.canEdit) { setErrors(["Seu perfil possui acesso somente para visualização."]); return; }
    const validation = action === "COMPLETE" || action === "REVIEW" ? validateComplete(assessment) : []; setErrors(validation); if (validation.length) return;
    setState("SAVING"); try { const result = await anthropometryPerimetryService.save({ patientId: view.patientId, attendanceId: view.attendanceId, scenario: view.collectionScenario, assessment, action }); setView(result.view); setAssessment(result.view.currentAssessment); setEditing(action === "START" || action === "SAVE_DRAFT"); setState("SAVED"); } catch { setState("ERROR"); }
  }
  return <div className="space-y-4">
    <AnthropometryHeader assessment={assessment} view={view} />
    <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-sky-900">Dados demonstrativos, sem interpretação clínica ou persistência no banco.</p><p className="mt-1 text-xs text-sky-700">Peso, altura e IMC permanecem vinculados à Coleta Clínica.</p></div><Link className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-300 bg-white px-4 text-sm font-black text-sky-900" href={`/pacientes/${view.patientId}?scenario=${view.collectionScenario}`}>Retornar ao Prontuário Mestre</Link></div>
    <p aria-live="polite" className={`rounded-xl p-3 text-sm font-semibold ${state === "ERROR" || errors.length ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`} role={errors.length ? "alert" : "status"}>{errors.length ? errors.join(" ") : state === "SAVING" ? "Salvando no mock…" : state === "SAVED" ? "Avaliação atualizada no estado mockado." : state === "ERROR" ? "Não foi possível salvar a avaliação mockada." : "A decisão sobre qualquer diferença permanece com o profissional."}</p>
    <SectionCard description="Identificação e contexto reutilizados do Prontuário Mestre." title="1. Resumo da avaliação"><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Paciente</dt><dd className="mt-1 text-sm font-black">{view.patientName}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Código</dt><dd className="mt-1 text-sm font-black">{view.patientCode}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Profissional</dt><dd className="mt-1 text-sm font-black">{assessment.professionalName}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Medidas registradas</dt><dd className="mt-1 text-sm font-black">{assessment.measurements.filter((item) => item.valueCm !== undefined).length} de {assessment.measurements.length}</dd></div></dl></SectionCard>
    <BasicMeasurementsCard assessment={assessment} sourceHref={collectionHref} />
    <div id="perimetry"><PerimetryForm disabled={!editing} measurements={assessment.measurements} onChange={(measurements) => setAssessment({ ...assessment, measurements })} /></div>
    <BilateralComparisonCard measurements={assessment.measurements} />
    <AnthropometryComparison assessments={[assessment, ...view.assessments.filter((item) => item.id !== assessment.id)]} />
    <BodyRegionOverview measurements={assessment.measurements} />
    <AnthropometryHistory assessments={[assessment, ...view.assessments.filter((item) => item.id !== assessment.id)]} />
    <SectionCard description="Registro livre; não será convertido em diagnóstico automático." title="8. Observações profissionais"><label className="text-sm font-bold text-slate-700" htmlFor="anthropometry-notes">Condições, mensuração, edema observado, roupa, pontos anatômicos e outras observações<Textarea className="mt-2 min-h-32" disabled={!editing} id="anthropometry-notes" onChange={(event) => setAssessment({ ...assessment, professionalNotes: event.target.value })} value={assessment.professionalNotes} /></label></SectionCard>
    <SectionCard collapsible defaultOpen={false} description="Orientações operacionais demonstrativas; não constituem protocolo científico definitivo." title="9. Padronização da coleta"><ul className="list-disc space-y-2 pl-5 text-sm text-slate-700"><li>Utilizar os mesmos pontos anatômicos nas reavaliações.</li><li>Registrar o lado correto.</li><li>Manter unidade em centímetros.</li><li>Registrar quando uma medida não puder ser realizada.</li><li>Evitar duplicar dados já existentes.</li><li>Confirmar os valores antes de concluir.</li></ul></SectionCard>
    <ResponsiveActionBar><span className="mr-auto self-center px-2 text-xs font-semibold text-slate-500">Mock vinculado ao Prontuário Mestre</span>{view.canEdit && !editing ? <Button onClick={() => setEditing(true)} type="button" variant="outline">Editar</Button> : null}{view.canEdit && assessment.status === "NOT_STARTED" ? <Button onClick={() => void execute("START")} type="button">Iniciar avaliação</Button> : null}{view.canEdit && editing ? <Button disabled={state === "SAVING"} onClick={() => void execute("SAVE_DRAFT")} type="button" variant="outline">Salvar rascunho</Button> : null}{view.canEdit && editing ? <Button disabled={state === "SAVING"} onClick={() => void execute("COMPLETE")} type="button">Concluir</Button> : null}{view.canEdit && assessment.status === "COMPLETED" && !editing ? <Button onClick={() => void execute("REVIEW")} type="button">Revisar</Button> : null}</ResponsiveActionBar>
  </div>;
}
