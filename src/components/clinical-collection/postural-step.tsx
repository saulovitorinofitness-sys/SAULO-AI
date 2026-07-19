import type { FormEvent } from "react";

import type { ClinicalStepRecord, PosturalAssessmentData, PosturalViewKey, StructuredFindingState } from "@/features/clinical-collection";
import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";
import { SectionCard } from "./section-card";

const viewDefinitions: readonly { key: PosturalViewKey; title: string }[] = [
  { key: "ANTERIOR", title: "Vista anterior" },
  { key: "POSTERIOR", title: "Vista posterior" },
  { key: "RIGHT_LATERAL", title: "Vista lateral direita" },
  { key: "LEFT_LATERAL", title: "Vista lateral esquerda" },
];

const stateOptions: readonly { value: StructuredFindingState; label: string }[] = [
  { value: "NOT_ASSESSED", label: "Não avaliada" },
  { value: "NO_FINDING_RECORDED", label: "Sem achado registrado" },
  { value: "FINDING_RECORDED", label: "Achado identificado" },
];

function PosturalArea({ id, title, state, observation, onDirty }: { id: string; title: string; state: StructuredFindingState; observation?: string; onDirty: () => void }) {
  return (
    <SectionCard title={title}>
      <div className="grid gap-4 md:grid-cols-2">
        <ClinicalField id={`${id}-state`} label="Situação" required><select className={clinicalInputClass} defaultValue={state} id={`${id}-state`} name={`${id}-state`} onChange={onDirty}>{stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></ClinicalField>
        <ClinicalField hint="Descreva somente o que foi observado; nenhuma análise automática será aplicada." id={`${id}-observation`} label="Observação"><textarea className={`${clinicalInputClass} min-h-24 resize-y py-3`} defaultValue={observation} id={`${id}-observation`} name={`${id}-observation`} onChange={onDirty} /></ClinicalField>
      </div>
    </SectionCard>
  );
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || undefined;

export function PosturalStep({ record, saving, onDirty, onSave }: { record: ClinicalStepRecord<PosturalAssessmentData>; saving: boolean; onDirty: () => void; onSave: (data: PosturalAssessmentData) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const state = (key: string) => String(form.get(key)) as StructuredFindingState;
    await onSave({
      views: {
        ANTERIOR: { state: state("anterior-state"), observation: text(form, "anterior-observation") },
        POSTERIOR: { state: state("posterior-state"), observation: text(form, "posterior-observation") },
        RIGHT_LATERAL: { state: state("right_lateral-state"), observation: text(form, "right_lateral-observation") },
        LEFT_LATERAL: { state: state("left_lateral-state"), observation: text(form, "left_lateral-observation") },
      },
      identifiedChanges: state("identifiedChanges"),
      identifiedChangesNotes: text(form, "identifiedChangesNotes"),
      functionalLimitations: state("functionalLimitations"),
      functionalLimitationsNotes: text(form, "functionalLimitationsNotes"),
      notes: text(form, "posturalNotes"),
      futureCorrectiveExercisesNote: record.data.futureCorrectiveExercisesNote,
    });
  }
  return (
    <form noValidate onChange={onDirty} onSubmit={submit}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-amber-950">Etapa obrigatória no Atendimento Completo SV</p><p className="mt-1 text-xs text-amber-800">As quatro vistas precisam ser registradas antes da conclusão.</p></div><span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Obrigatória</span></div>
        <PendingFieldsAlert fields={record.missingRequiredFields} />
        <ProfessionalAuditInfo audit={record.audit} origin={record.origin} />
        {viewDefinitions.map((view) => <PosturalArea id={view.key.toLocaleLowerCase("en-US")} key={view.key} observation={record.data.views[view.key].observation} onDirty={onDirty} state={record.data.views[view.key].state} title={view.title} />)}
        <SectionCard title="Alterações identificadas"><div className="grid gap-4 md:grid-cols-2"><ClinicalField id="identifiedChanges" label="Situação" required><select className={clinicalInputClass} defaultValue={record.data.identifiedChanges} id="identifiedChanges" name="identifiedChanges" onChange={onDirty}>{stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></ClinicalField><ClinicalField id="identifiedChangesNotes" label="Descrição"><textarea className={`${clinicalInputClass} min-h-24 resize-y py-3`} defaultValue={record.data.identifiedChangesNotes} id="identifiedChangesNotes" name="identifiedChangesNotes" onChange={onDirty} /></ClinicalField></div></SectionCard>
        <SectionCard title="Limitações funcionais"><div className="grid gap-4 md:grid-cols-2"><ClinicalField id="functionalLimitations" label="Situação" required><select className={clinicalInputClass} defaultValue={record.data.functionalLimitations} id="functionalLimitations" name="functionalLimitations" onChange={onDirty}>{stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></ClinicalField><ClinicalField id="functionalLimitationsNotes" label="Descrição"><textarea className={`${clinicalInputClass} min-h-24 resize-y py-3`} defaultValue={record.data.functionalLimitationsNotes} id="functionalLimitationsNotes" name="functionalLimitationsNotes" onChange={onDirty} /></ClinicalField></div></SectionCard>
        <SectionCard title="Observações"><ClinicalField id="posturalNotes" label="Observações gerais"><textarea className={`${clinicalInputClass} min-h-28 resize-y py-3`} defaultValue={record.data.notes} id="posturalNotes" name="posturalNotes" onChange={onDirty} /></ClinicalField></SectionCard>
        <SectionCard description="Vínculo preparado apenas visualmente; nenhum plano de treino é gerado nesta Sprint." title="Exercícios corretivos sugeridos ou vinculados futuramente"><p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{record.data.futureCorrectiveExercisesNote ?? "Nenhum exercício vinculado nesta Sprint."}</p></SectionCard>
      </div>
      <ResponsiveActionBar><button className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar etapa"}</button></ResponsiveActionBar>
    </form>
  );
}
