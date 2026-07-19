import type { FormEvent } from "react";

import { perimetryGroups, type ClinicalStepRecord, type PerimetryData, type PreviousPerimetryReference } from "@/features/clinical-collection";
import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { MeasurementField } from "./measurement-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";
import { SectionCard } from "./section-card";

export function PerimetryStep({ record, previous, saving, onDirty, onSave }: { record: ClinicalStepRecord<PerimetryData>; previous?: PreviousPerimetryReference; saving: boolean; onDirty: () => void; onSave: (data: PerimetryData) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, number | string | undefined> = {};
    for (const group of perimetryGroups) for (const field of group.fields) { const raw = String(form.get(String(field.key)) ?? "").replace(",", "."); values[String(field.key)] = raw ? Number(raw) : undefined; }
    values.notes = String(form.get("notes") ?? "").trim() || undefined;
    await onSave(values as PerimetryData);
  }
  return (
    <form noValidate onChange={onDirty} onSubmit={submit}>
      <div className="space-y-4">
        <PendingFieldsAlert fields={record.missingRequiredFields} />
        <ProfessionalAuditInfo audit={record.audit} origin={record.origin} />
        {perimetryGroups.map((group) => <SectionCard key={group.key} title={group.title}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.fields.map((field) => <MeasurementField id={String(field.key)} key={String(field.key)} label={field.label} onChange={onDirty} previousValue={previous?.values[field.key] as number | undefined} required unit="cm" value={record.data[field.key] as number | undefined} />)}</div></SectionCard>)}
        <SectionCard title="Observação"><ClinicalField id="notes" label="Observação da perimetria"><textarea className={`${clinicalInputClass} min-h-24 resize-y py-3`} defaultValue={record.data.notes} id="notes" name="notes" onChange={onDirty} /></ClinicalField></SectionCard>
      </div>
      <ResponsiveActionBar><span className="mr-auto self-center px-2 text-xs font-semibold text-slate-500">Comparação discreta, sem interpretação automática</span><button className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar etapa"}</button></ResponsiveActionBar>
    </form>
  );
}
