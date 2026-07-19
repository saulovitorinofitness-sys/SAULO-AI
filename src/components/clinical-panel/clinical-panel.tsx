"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clinicalCollectionService, type ClinicalPanelView, type PerimetryData } from "@/features/clinical-collection";
import { SaveStatus } from "@/components/clinical-collection/save-status";
import { PageState } from "@/components/ui/page-state";
import { Button, ButtonLink } from "@/components/ui/button";
import { ClinicalComparisonIndicator } from "./clinical-comparison-indicator";
import { ClinicalPanelHeader } from "./clinical-panel-header";
import { ClinicalSummaryCard } from "./clinical-summary-card";
import { CollapsibleClinicalSection } from "./collapsible-clinical-section";
import { DataIntegrityAlert } from "./data-integrity-alert";
import { ResponsiveBottomActions } from "./responsive-bottom-actions";

function Metric({ label, value, unit }: { label: string; value?: number; unit?: string }) {
  return <div className="rounded-[var(--radius-medium)] bg-[var(--surface-elevated)] p-3.5"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-lg font-black text-slate-900">{value ?? "—"}{value !== undefined && unit ? <span className="ml-1 text-xs font-bold text-slate-400">{unit}</span> : null}</dd></div>;
}

function PerimetryMetric({ label, current, previous }: { label: string; current?: number; previous?: number }) {
  return <div className="rounded-[var(--radius-medium)] bg-[var(--surface-elevated)] p-3.5"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-base font-black text-slate-900">{current ?? "—"}{current !== undefined ? <span className="ml-1 text-xs text-slate-400">cm</span> : null}</dd><div className="mt-1"><ClinicalComparisonIndicator current={current} previous={previous} /></div></div>;
}

const stateLabels = { NOT_ASSESSED: "Não avaliada", NO_FINDING_RECORDED: "Sem achado registrado", FINDING_RECORDED: "Achado identificado" } as const;

export function ClinicalPanel({ initialPanel }: { initialPanel: ClinicalPanelView }) {
  const [panel, setPanel] = useState(initialPanel);
  const [saveState, setSaveState] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");

  useEffect(() => {
    let active = true;
    void clinicalCollectionService.getClinicalPanel({ patientId: initialPanel.collection.patientId, attendanceId: initialPanel.collection.attendanceId, scenario: initialPanel.collection.scenario }).then((updated) => { if (active && updated) setPanel(updated); });
    return () => { active = false; };
  }, [initialPanel]);

  async function confirmProfessionalReview() {
    setSaveState("SAVING");
    try {
      const result = await clinicalCollectionService.updateClinicalPanel({ patientId: panel.collection.patientId, attendanceId: panel.collection.attendanceId, scenario: panel.collection.scenario, action: "CONFIRM_DATA" });
      setPanel(result.panel);
      setSaveState("SAVED");
    } catch {
      setSaveState("ERROR");
    }
  }

  const collectionHref = `/pacientes/${panel.collection.patientId}/atendimentos/${panel.collection.attendanceId}/coleta?scenario=${panel.collection.scenario}`;
  const decisionHref = `/pacientes/${panel.collection.patientId}/atendimentos/${panel.collection.attendanceId}/decisao-clinica?scenario=${panel.collection.scenario}`;
  const record = panel.collection.records;
  const previous = panel.collection.previousPerimetry?.values;

  if (!panel.accessible) {
    return <div className="space-y-4"><ClinicalPanelHeader panel={panel} /><DataIntegrityAlert issues={panel.integrityIssues} /><PageState action={<ButtonLink href={`${collectionHref}&step=${panel.collection.firstIncompleteStep === "SUMMARY" ? "ANTHROPOMETRY" : panel.collection.firstIncompleteStep}`}>Corrigir coleta</ButtonLink>} description="O painel definitivo permanece bloqueado até que todas as etapas obrigatórias e os valores requeridos estejam consistentes." title="Painel Clínico bloqueado" tone="blocked" /></div>;
  }

  const perimetryFields: readonly [string, keyof PerimetryData][] = [
    ["Cintura", "waistCm"], ["Abdômen", "abdomenCm"], ["Quadril", "hipCm"], ["Braço direito", "rightArmCm"], ["Braço esquerdo", "leftArmCm"], ["Coxa direita", "rightThighCm"], ["Coxa esquerda", "leftThighCm"], ["Panturrilha direita", "rightCalfCm"], ["Panturrilha esquerda", "leftCalfCm"],
  ];

  return (
    <div className="space-y-4">
      <ClinicalPanelHeader panel={panel} />
      <DataIntegrityAlert issues={panel.integrityIssues} />
      {panel.confirmedAt ? <div className="flex flex-col gap-3 rounded-[var(--radius-large)] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between" role="status"><span><strong>Revisão profissional confirmada no mock.</strong> O Motor de Decisão Clínica está liberado para este atendimento.</span><ButtonLink className="shrink-0" href={decisionHref}>Abrir Motor de Decisão</ButtonLink></div> : <div className="rounded-[var(--radius-large)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status"><strong>Revisão profissional pendente.</strong> Confira os dados consolidados e confirme a revisão para liberar o Motor de Decisão Clínica.</div>}
      <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">A decisão final permanece sob responsabilidade do profissional habilitado.</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <ClinicalSummaryCard audit={record.anthropometry.audit} status={record.anthropometry.status} title="Antropometria">
          <dl className="grid gap-3 sm:grid-cols-3"><Metric label="Peso" unit="kg" value={record.anthropometry.data.weightKg} /><Metric label="Estatura" unit="cm" value={record.anthropometry.data.heightCm} /><Metric label="IMC" unit="kg/m²" value={record.anthropometry.data.bmi} /></dl>
          <p className="mt-3 text-xs font-semibold text-slate-500">Classificação visual: não disponibilizada pelo mock.</p>
        </ClinicalSummaryCard>

        <ClinicalSummaryCard audit={record.bioimpedance.audit} status={record.bioimpedance.status} title="Bioimpedância Avanutri">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Peso" unit="kg" value={record.bioimpedance.data.weightKg} /><Metric label="Gordura corporal" unit="%" value={record.bioimpedance.data.bodyFatPercent} /><Metric label="Massa de gordura" unit="kg" value={record.bioimpedance.data.fatMassKg} /><Metric label="Massa livre de gordura" unit="kg" value={record.bioimpedance.data.fatFreeMassKg} /><Metric label="Massa muscular esquelética" unit="kg" value={record.bioimpedance.data.skeletalMuscleMassKg} /><Metric label="Água corporal" unit="L" value={record.bioimpedance.data.totalBodyWaterL} /><Metric label="Gordura visceral" value={record.bioimpedance.data.visceralFatLevel} /><Metric label="Taxa metabólica basal" unit="kcal" value={record.bioimpedance.data.basalMetabolicRateKcal} /><Metric label="Idade metabólica" unit="anos" value={record.bioimpedance.data.metabolicAgeYears} /></dl>
          <CollapsibleClinicalSection title="Ver análise completa"><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Água intracelular" unit="L" value={record.bioimpedance.data.intracellularWaterL} /><Metric label="Água extracelular" unit="L" value={record.bioimpedance.data.extracellularWaterL} /><Metric label="Proteína" unit="kg" value={record.bioimpedance.data.proteinKg} /><Metric label="Minerais" unit="kg" value={record.bioimpedance.data.mineralsKg} /><Metric label="Índice apendicular" unit="kg/m²" value={record.bioimpedance.data.appendicularIndex} /></dl><h3 className="mb-2 mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Massa magra segmentar</h3><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Braço direito" unit="kg" value={record.bioimpedance.data.leanRightArmKg} /><Metric label="Braço esquerdo" unit="kg" value={record.bioimpedance.data.leanLeftArmKg} /><Metric label="Tronco" unit="kg" value={record.bioimpedance.data.leanTrunkKg} /><Metric label="Perna direita" unit="kg" value={record.bioimpedance.data.leanRightLegKg} /><Metric label="Perna esquerda" unit="kg" value={record.bioimpedance.data.leanLeftLegKg} /></dl><h3 className="mb-2 mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Gordura segmentar</h3><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Braço direito" unit="kg" value={record.bioimpedance.data.fatRightArmKg} /><Metric label="Braço esquerdo" unit="kg" value={record.bioimpedance.data.fatLeftArmKg} /><Metric label="Tronco" unit="kg" value={record.bioimpedance.data.fatTrunkKg} /><Metric label="Perna direita" unit="kg" value={record.bioimpedance.data.fatRightLegKg} /><Metric label="Perna esquerda" unit="kg" value={record.bioimpedance.data.fatLeftLegKg} /></dl></CollapsibleClinicalSection>
        </ClinicalSummaryCard>

        <ClinicalSummaryCard audit={record.perimetry.audit} status={record.perimetry.status} title="Perimetria">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{perimetryFields.map(([label, key]) => <PerimetryMetric current={record.perimetry.data[key] as number | undefined} key={key} label={label} previous={previous?.[key] as number | undefined} />)}</dl>
          <CollapsibleClinicalSection title="Ver demais medidas"><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><PerimetryMetric current={record.perimetry.data.neckCm} label="Pescoço" previous={previous?.neckCm} /><PerimetryMetric current={record.perimetry.data.shouldersCm} label="Ombros" previous={previous?.shouldersCm} /><PerimetryMetric current={record.perimetry.data.chestCm} label="Tórax" previous={previous?.chestCm} /><PerimetryMetric current={record.perimetry.data.rightForearmCm} label="Antebraço direito" previous={previous?.rightForearmCm} /><PerimetryMetric current={record.perimetry.data.leftForearmCm} label="Antebraço esquerdo" previous={previous?.leftForearmCm} /></dl></CollapsibleClinicalSection>
        </ClinicalSummaryCard>

        <ClinicalSummaryCard audit={record.posturalAssessment.audit} status={record.posturalAssessment.status} title="Avaliação Postural">
          <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(record.posturalAssessment.data.views).map(([view, data]) => <div className="rounded-xl bg-[#f7faf8] p-3.5" key={view}><dt className="text-xs font-semibold text-slate-500">{({ ANTERIOR: "Vista anterior", POSTERIOR: "Vista posterior", RIGHT_LATERAL: "Vista lateral direita", LEFT_LATERAL: "Vista lateral esquerda" } as Record<string, string>)[view]}</dt><dd className="mt-1 text-sm font-black text-slate-800">{stateLabels[data.state]}</dd>{data.observation ? <p className="mt-1 text-xs text-slate-500">{data.observation}</p> : null}</div>)}</dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Principais achados</h3><p className="mt-2 text-sm text-slate-700">{record.posturalAssessment.data.identifiedChanges === "FINDING_RECORDED" ? record.posturalAssessment.data.identifiedChangesNotes : stateLabels[record.posturalAssessment.data.identifiedChanges]}</p></div><div className="rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Limitações funcionais</h3><p className="mt-2 text-sm text-slate-700">{record.posturalAssessment.data.functionalLimitations === "FINDING_RECORDED" ? record.posturalAssessment.data.functionalLimitationsNotes : stateLabels[record.posturalAssessment.data.functionalLimitations]}</p></div></div>
          {record.posturalAssessment.data.notes ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><strong>Observações:</strong> {record.posturalAssessment.data.notes}</p> : null}
        </ClinicalSummaryCard>
      </div>

      <ResponsiveBottomActions>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black text-slate-600 hover:bg-slate-100" href={`/pacientes/${panel.collection.patientId}?scenario=${panel.collection.scenario}`}>Voltar ao prontuário</Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50" href={`${collectionHref}&step=ANTHROPOMETRY`}>Corrigir coleta</Link>
        <span className="self-center px-2"><SaveStatus state={saveState} /></span>
        <Button disabled={saveState === "SAVING" || Boolean(panel.confirmedAt)} loading={saveState === "SAVING"} onClick={confirmProfessionalReview} type="button" variant="secondary">{panel.confirmedAt ? "Revisão confirmada" : "Confirmar revisão profissional"}</Button>
        {panel.confirmedAt ? <ButtonLink href={decisionHref}>Abrir Motor de Decisão</ButtonLink> : <Button aria-disabled="true" disabled type="button">Motor bloqueado até a confirmação</Button>}
      </ResponsiveBottomActions>
    </div>
  );
}
