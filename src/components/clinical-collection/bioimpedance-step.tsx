"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import {
  formatBmi,
  formatLocalizedNumber,
} from "@/features/clinical-collection/anthropometry-calculations";
import {
  bioimpedanceGroups,
  type BioimpedanceAvanutriData,
  type ClinicalStepRecord,
} from "@/features/clinical-collection";

import { AccordionSection } from "@/components/ui/accordion-section";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { MeasurementField } from "./measurement-field";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";

function ReadOnlyMeasurement({
  id,
  label,
  unit,
  value,
  hint,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  hint: string;
}) {
  return (
    <ClinicalField hint={hint} id={id} label={label}>
      <span className="relative block">
        <input
          className={`${clinicalInputClass} bg-slate-100 pr-20 font-semibold text-slate-600`}
          id={id}
          name={id}
          readOnly
          type="text"
          value={value}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
          {unit}
        </span>
      </span>
    </ClinicalField>
  );
}

export function BioimpedanceStep({
  record,
  saving,
  onDirty,
  onSave,
}: {
  record: ClinicalStepRecord<BioimpedanceAvanutriData>;
  saving: boolean;
  onDirty: () => void;
  onSave: (data: BioimpedanceAvanutriData) => Promise<void>;
}) {
  const [openGroup, setOpenGroup] = useState(
    bioimpedanceGroups[0]?.key ?? "",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const values: Record<string, number | undefined> = {};

    for (const group of bioimpedanceGroups) {
      for (const field of group.fields) {
        const raw = String(form.get(String(field.key)) ?? "").replace(",", ".");
        const parsed = raw ? Number(raw) : undefined;

        values[String(field.key)] =
          field.key === "metabolicAgeYears"
            ? parsed !== undefined &&
              Number.isInteger(parsed) &&
              parsed > 0
              ? parsed
              : undefined
            : parsed;
      }
    }

    await onSave(values as BioimpedanceAvanutriData);
  }

  return (
    <form id="clinical-form-bioimpedance" onChange={onDirty} onInvalid={focusFirstInvalidField} onSubmit={submit}>
      <div className="space-y-4">
        <ProfessionalAuditInfo
          audit={record.audit}
          origin={record.origin}
        />

        {bioimpedanceGroups.map((group, index) => {
          const description = group.key.includes("segmental")
            ? "Distribuição por segmento corporal conforme relatório Avanutri."
            : undefined;

          return (
            <AccordionSection
              description={description}
              key={group.key}
              number={index + 1}
              onToggle={() =>
                setOpenGroup((current) =>
                  current === group.key ? "" : group.key,
                )
              }
              open={openGroup === group.key}
              title={group.title}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.fields.map((field) => {
                  if (field.key === "weightKg") {
                    return (
                      <ReadOnlyMeasurement
                        hint="Herdado da Antropometria do mesmo Prontuário Mestre."
                        id={String(field.key)}
                        key={String(field.key)}
                        label={field.label}
                        unit={field.unit}
                        value={formatLocalizedNumber(record.data.weightKg)}
                      />
                    );
                  }

                  if (field.key === "bmi") {
                    return (
                      <ReadOnlyMeasurement
                        hint="Calculado automaticamente com o Peso e a Altura da Antropometria."
                        id={String(field.key)}
                        key={String(field.key)}
                        label={field.label}
                        unit={field.unit}
                        value={formatBmi(record.data.bmi)}
                      />
                    );
                  }

                  if (field.key === "metabolicAgeYears") {
                    return (
                      <ClinicalField
                        hint="Opcional. Informe somente o valor inteiro fornecido pelo equipamento."
                        id={String(field.key)}
                        key={String(field.key)}
                        label={field.label}
                      >
                        <span className="relative block">
                          <input
                            className={`${clinicalInputClass} pr-16 font-semibold`}
                            defaultValue={record.data.metabolicAgeYears}
                            id={String(field.key)}
                            inputMode="numeric"
                            min="1"
                            name={String(field.key)}
                            onChange={onDirty}
                            step="1"
                            type="number"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
                            {field.unit}
                          </span>
                        </span>
                      </ClinicalField>
                    );
                  }

                  return (
                    <MeasurementField
                      id={String(field.key)}
                      key={String(field.key)}
                      label={field.label}
                      onChange={onDirty}
                      unit={field.unit}
                      value={record.data[field.key] as number | undefined}
                    />
                  );
                })}
              </div>
            </AccordionSection>
          );
        })}
      </div>

      <ResponsiveActionBar>
        <span className="mr-auto self-center px-2 text-xs font-semibold text-slate-500">
          Somente campos confirmados no relatório Avanutri
        </span>

        <button
          className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving ? "Salvando..." : "Salvar e continuar"}
        </button>
      </ResponsiveActionBar>
    </form>
  );
}
