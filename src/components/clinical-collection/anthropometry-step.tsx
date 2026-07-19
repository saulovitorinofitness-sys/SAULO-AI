import type { FormEvent } from "react";

import type { AnthropometryData, ClinicalStepRecord } from "@/features/clinical-collection";
import { MeasurementField } from "./measurement-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";
import { SectionCard } from "./section-card";
import { ClinicalField, clinicalInputClass } from "./clinical-field";

const numberValue = (data: FormData, key: string) => { const raw = String(data.get(key) ?? "").replace(",", "."); return raw ? Number(raw) : undefined; };

export function AnthropometryStep({ record, saving, onDirty, onSave }: { record: ClinicalStepRecord<AnthropometryData>; saving: boolean; onDirty: () => void; onSave: (data: AnthropometryData) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSave({ weightKg: numberValue(data, "weightKg"), heightCm: numberValue(data, "heightCm"), bmi: record.data.bmi, notes: String(data.get("notes") ?? "").trim() || undefined });
  }
  return (
    <form noValidate onChange={onDirty} onSubmit={submit}>
      <div className="space-y-4">
        <PendingFieldsAlert fields={record.missingRequiredFields} />
        <SectionCard description="Dados antropométricos básicos; IMC calculado pelo serviço mock." title="Antropometria">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MeasurementField id="weightKg" label="Peso" onChange={onDirty} required unit="kg" value={record.data.weightKg} />
            <MeasurementField id="heightCm" label="Estatura" onChange={onDirty} required unit="cm" value={record.data.heightCm} />
            <MeasurementField id="bmi" label="IMC" readOnly unit="kg/m²" value={record.data.bmi} />
          </div>
          <div className="mt-5"><ClinicalField id="notes" label="Observações pertinentes"><textarea className={`${clinicalInputClass} min-h-24 resize-y py-3`} defaultValue={record.data.notes} id="notes" name="notes" onChange={onDirty} /></ClinicalField></div>
          <div className="mt-5"><ProfessionalAuditInfo audit={record.audit} origin={record.origin} /></div>
        </SectionCard>
      </div>
      <ResponsiveActionBar><button className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar etapa"}</button></ResponsiveActionBar>
    </form>
  );
}
