import type { FormEvent } from "react";

import { bioimpedanceGroups, type BioimpedanceAvanutriData, type ClinicalStepRecord } from "@/features/clinical-collection";
import { MeasurementField } from "./measurement-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";
import { SectionCard } from "./section-card";

export function BioimpedanceStep({ record, saving, onDirty, onSave }: { record: ClinicalStepRecord<BioimpedanceAvanutriData>; saving: boolean; onDirty: () => void; onSave: (data: BioimpedanceAvanutriData) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, number | undefined> = {};
    for (const group of bioimpedanceGroups) for (const field of group.fields) { const raw = String(form.get(String(field.key)) ?? "").replace(",", "."); values[String(field.key)] = raw ? Number(raw) : undefined; }
    await onSave(values as BioimpedanceAvanutriData);
  }
  return (
    <form noValidate onChange={onDirty} onSubmit={submit}>
      <div className="space-y-4">
        <PendingFieldsAlert fields={record.missingRequiredFields} />
        <ProfessionalAuditInfo audit={record.audit} origin={record.origin} />
        {bioimpedanceGroups.map((group, index) => (
          <SectionCard collapsible defaultOpen={index < 2 || record.status !== "COMPLETED"} description={group.key.includes("segmental") ? "Distribuição por segmento corporal conforme relatório Avanutri." : undefined} key={group.key} title={group.title}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.fields.map((field) => <MeasurementField id={String(field.key)} key={String(field.key)} label={field.label} onChange={onDirty} required={field.required} unit={field.unit} value={record.data[field.key] as number | undefined} />)}
            </div>
          </SectionCard>
        ))}
      </div>
      <ResponsiveActionBar><span className="mr-auto self-center px-2 text-xs font-semibold text-slate-500">Somente campos confirmados no relatório Avanutri</span><button className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar etapa"}</button></ResponsiveActionBar>
    </form>
  );
}
