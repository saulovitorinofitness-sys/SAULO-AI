"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  clinicalDecisionService,
  type ClinicalDecisionReviewPoint,
  type ClinicalDecisionScenario,
  type ClinicalDecisionWorkspace,
  type ProfessionalClinicalDecision,
  type ProfessionalDecisionSource,
} from "@/features/clinical-decision";
import { ClinicalAlertsPanel } from "./clinical-alerts-panel";
import { ClinicalDecisionHeader } from "./clinical-decision-header";
import { ClinicalDecisionHistory } from "./clinical-decision-history";
import { ClinicalEvidenceSummary } from "./clinical-evidence-summary";
import { ClinicalPendingItems } from "./clinical-pending-items";
import { ClinicalReviewPoints } from "./clinical-review-points";
import { ProfessionalDecisionForm, type DecisionDraft } from "./professional-decision-form";

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-6"><p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#397563]">{eyebrow}</p><h2 className="mb-4 mt-1 text-lg font-black text-slate-900">{title}</h2>{children}</section>;
}

export function ClinicalDecisionWorkspaceView({ initialWorkspace, scenarios }: { initialWorkspace: ClinicalDecisionWorkspace; scenarios: readonly ClinicalDecisionScenario[] }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedReview, setSelectedReview] = useState<{ item: ClinicalDecisionReviewPoint; source: ProfessionalDecisionSource }>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void clinicalDecisionService.getWorkspace({ patientId: initialWorkspace.patientId, attendanceId: initialWorkspace.attendanceId, collectionScenario: initialWorkspace.collectionScenario, decisionScenario: initialWorkspace.scenario }).then((next) => { if (active && next) setWorkspace(next); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialWorkspace]);

  async function save(draft: DecisionDraft) {
    const result = await clinicalDecisionService.saveDecision({ workspace, decision: { ...draft, reassessmentDate: draft.reassessmentDate || undefined, notes: draft.notes || undefined } });
    return result.decision;
  }

  function edit(decision: ProfessionalClinicalDecision) {
    setSelectedReview({ item: { id: decision.id, title: decision.decision, rationale: decision.rationale, evidenceIds: [], area: decision.area, relevance: decision.priority, status: "IN_REVIEW" }, source: "PREVIOUS_DECISION_REVIEW" });
  }

  const base = `/pacientes/${workspace.patientId}/atendimentos/${workspace.attendanceId}/decisao-clinica?scenario=${workspace.collectionScenario}`;
  const formKey = selectedReview ? `${selectedReview.item.id}:${selectedReview.source}` : "own-decision";

  return <div className="space-y-4">
    <ClinicalDecisionHeader workspace={workspace} />
    <nav aria-label="Cenários mockados" className="rounded-2xl border border-dashed border-[#b8cec5] bg-[#f7faf8] p-4">
      <div className="flex flex-wrap items-center gap-2"><strong className="mr-2 text-xs uppercase tracking-wide text-slate-500">Cenário de validação:</strong>{scenarios.map((scenario) => <Link aria-current={workspace.scenario === scenario.key ? "page" : undefined} className={`rounded-full px-3 py-2 text-xs font-black ${workspace.scenario === scenario.key ? "bg-[#12664f] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`} href={`${base}&decisionScenario=${scenario.key}`} key={scenario.key} title={scenario.description}>{scenario.label}</Link>)}</div>
    </nav>
    {loading ? <div aria-live="polite" className="rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-600">Atualizando dados mockados…</div> : null}
    {!workspace.permissions.canRead ? <Section eyebrow="Permissão" title="Acesso não permitido"><p className="text-sm text-slate-600">Seu perfil não possui acesso ao Motor de Decisão Clínica.</p></Section> : <>
      <Section eyebrow="Prontuário Mestre" title="Evidências disponíveis"><p className="mb-4 text-sm text-slate-600">Registros reutilizados do mesmo prontuário. Nenhuma informação é solicitada novamente.</p><ClinicalEvidenceSummary evidences={workspace.evidences} /></Section>
      <div className="grid gap-4 xl:grid-cols-2"><Section eyebrow="Revisão objetiva" title="Alertas para revisão profissional"><ClinicalAlertsPanel alerts={workspace.alerts} /></Section><Section eyebrow="Antes da decisão" title="Pendências antes da decisão"><ClinicalPendingItems items={workspace.pendingItems} /></Section></div>
      <Section eyebrow="Apoio assistido" title="Pontos para avaliação profissional"><p className="mb-4 text-sm text-slate-600">Possibilidades de revisão, sem diagnóstico, prescrição ou decisão automática.</p><ClinicalReviewPoints items={workspace.reviewPoints} onUse={(item, source) => setSelectedReview({ item, source })} /></Section>
      {workspace.permissions.canWrite ? <ProfessionalDecisionForm areas={workspace.permissions.allowedDecisionAreas} key={formKey} onSaved={(decision) => setWorkspace((current) => ({ ...current, history: [decision, ...current.history] }))} professionalName={workspace.responsibleProfessional.professionalName} save={save} selectedReview={selectedReview} /> : null}
      <Section eyebrow="Continuidade e autoria" title="Histórico de decisões"><ClinicalDecisionHistory decisions={workspace.history} onEdit={edit} onReview={(id) => setWorkspace((current) => ({ ...current, history: current.history.map((item) => item.id === id ? { ...item, status: "REVIEWED" } : item) }))} /></Section>
    </>}
  </div>;
}
