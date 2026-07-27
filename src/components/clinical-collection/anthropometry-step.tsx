"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { AccordionSection } from "@/components/ui/accordion-section";
import {
  calculateBmi,
  formatBmi,
  formatHeightFromCentimeters,
  formatLocalizedNumber,
  heightMetersToCentimeters,
  normalizeHeightMeters,
  parseLocalizedDecimal,
} from "@/features/clinical-collection/anthropometry-calculations";
import type {
  AnthropometryData,
  ClinicalStepRecord,
} from "@/features/clinical-collection";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";

export function AnthropometryStep({
  record,
  saving,
  onDirty,
  onSave,
}: {
  record: ClinicalStepRecord<AnthropometryData>;
  saving: boolean;
  onDirty: () => void;
  onSave: (data: AnthropometryData) => Promise<void>;
}) {
  const [openSection, setOpenSection] = useState("measurements");
  const [weightInput, setWeightInput] = useState(() =>
    formatLocalizedNumber(record.data.weightKg),
  );
  const [heightInput, setHeightInput] = useState(() =>
    formatHeightFromCentimeters(record.data.heightCm),
  );
  const weightKg = parseLocalizedDecimal(weightInput);
  const heightMeters = normalizeHeightMeters(heightInput);
  const bmi = calculateBmi(weightKg, heightMeters);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    await onSave({
      weightKg,
      heightCm: heightMetersToCentimeters(heightMeters),
      bmi,
      notes: String(data.get("notes") ?? "").trim() || undefined,
    });
  }

  return (
    <form id="clinical-form-anthropometry" onChange={onDirty} onInvalid={focusFirstInvalidField} onSubmit={submit}>
      <div className="space-y-4">
        <PendingFieldsAlert fields={record.missingRequiredFields} />

        <AccordionSection
          description="Dados antropométricos básicos; IMC calculado automaticamente."
          number={1}
          onToggle={() =>
            setOpenSection((current) =>
              current === "measurements" ? "" : "measurements",
            )
          }
          open={openSection === "measurements"}
          title="Medidas antropométricas"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ClinicalField id="weightKg" label="Peso" required>
              <span className="relative block">
                <input
                  aria-required="true"
                  className={`${clinicalInputClass} pr-16 font-semibold`}
                  id="weightKg"
                  inputMode="decimal"
                  name="weightKg"
                  onBlur={() => {
                    if (weightKg !== undefined) {
                      setWeightInput(formatLocalizedNumber(weightKg));
                    }
                  }}
                  onChange={(event) => setWeightInput(event.target.value)}
                  required
                  type="text"
                  value={weightInput}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
                  kg
                </span>
              </span>
            </ClinicalField>

            <ClinicalField
              hint="Informe em metros (1,56) ou centímetros (156)."
              id="heightCm"
              label="Estatura"
              required
            >
              <span className="relative block">
                <input
                  aria-required="true"
                  className={`${clinicalInputClass} pr-16 font-semibold`}
                  id="heightCm"
                  inputMode="decimal"
                  name="heightCm"
                  onBlur={() => {
                    if (heightMeters !== undefined) {
                      setHeightInput(
                        heightMeters.toFixed(2).replace(".", ","),
                      );
                    }
                  }}
                  onChange={(event) => setHeightInput(event.target.value)}
                  required
                  type="text"
                  value={heightInput}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
                  m
                </span>
              </span>
            </ClinicalField>

            <ClinicalField id="bmi" label="IMC">
              <span className="relative block">
                <input
                  className={`${clinicalInputClass} bg-slate-100 pr-20 font-semibold text-slate-600`}
                  id="bmi"
                  name="bmi"
                  readOnly
                  type="text"
                  value={formatBmi(bmi)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
                  kg/m²
                </span>
              </span>
            </ClinicalField>
          </div>
        </AccordionSection>

        <AccordionSection
          number={2}
          onToggle={() =>
            setOpenSection((current) =>
              current === "notes" ? "" : "notes",
            )
          }
          open={openSection === "notes"}
          title="Observações"
        >
          <ClinicalField id="notes" label="Observações pertinentes">
            <textarea
              className={`${clinicalInputClass} min-h-24 resize-y py-3`}
              defaultValue={record.data.notes}
              id="notes"
              name="notes"
              onChange={onDirty}
            />
          </ClinicalField>
        </AccordionSection>

        <AccordionSection
          number={3}
          onToggle={() =>
            setOpenSection((current) =>
              current === "audit" ? "" : "audit",
            )
          }
          open={openSection === "audit"}
          title="Registro profissional"
        >
          <ProfessionalAuditInfo audit={record.audit} origin={record.origin} />
        </AccordionSection>
      </div>

      <ResponsiveActionBar>
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
