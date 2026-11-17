"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";

import { AccordionSection } from "@/components/ui/accordion-section";
import {
  calculateBmi,
  formatBmi,
  formatHeightFromCentimeters,
  formatLocalizedNumber,
  heightMetersToCentimeters,
  normalizeHeightMeters,
  parseLocalizedDecimal,
  validateAnthropometryMeasurements,
} from "@/features/clinical-collection/anthropometry-calculations";
import type {
  AnthropometryData,
  ClinicalCollectionView,
  ClinicalStepRecord,
  ProfessionalAudit,
} from "@/features/clinical-collection";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";

export function AnthropometryStep({
  record,
  patientAge,
  patientSex,
  responsibleProfessional,
  saving,
  onDirty,
  onSave,
}: {
  record: ClinicalStepRecord<AnthropometryData>;
  patientAge?: number;
  patientSex?: ClinicalCollectionView["patientSex"];
  responsibleProfessional: ProfessionalAudit;
  saving: boolean;
  onDirty: (data: AnthropometryData) => void;
  onSave: (
    data: AnthropometryData,
    continueAfterSave: boolean,
  ) => Promise<void>;
}) {
  const submittingRef = useRef(false);
  const [openSection, setOpenSection] = useState("measurements");
  const [fieldErrors, setFieldErrors] = useState<{
    weightKg?: string;
    heightCm?: string;
  }>({});
  const [weightInput, setWeightInput] = useState(() =>
    formatLocalizedNumber(record.data.weightKg),
  );
  const [heightInput, setHeightInput] = useState(() =>
    formatHeightFromCentimeters(record.data.heightCm),
  );
  const weightKg = parseLocalizedDecimal(weightInput);
  const heightMeters = normalizeHeightMeters(heightInput);
  const heightCm = heightMetersToCentimeters(heightMeters);
  const bmi = calculateBmi(weightKg, heightMeters);
  const sexLabel =
    patientSex === "FEMALE"
      ? "Feminino"
      : patientSex === "MALE"
        ? "Masculino"
        : patientSex === "INTERSEX"
          ? "Intersexo"
          : "Não informado";
  const ageLabel =
    patientAge !== undefined && Number.isInteger(patientAge) && patientAge >= 0
      ? `${patientAge} anos`
      : "Não informado";

  function draftFromForm(form: HTMLFormElement): AnthropometryData {
    const values = new FormData(form);
    const draftWeight = parseLocalizedDecimal(
      String(values.get("weightKg") ?? ""),
    );
    const draftHeightMeters = normalizeHeightMeters(
      String(values.get("heightCm") ?? ""),
    );
    const draftHeight = heightMetersToCentimeters(draftHeightMeters);
    return {
      weightKg: draftWeight,
      heightCm: draftHeight,
      bmi: calculateBmi(draftWeight, draftHeightMeters),
      notes: String(values.get("notes") ?? "").trim() || undefined,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submittingRef.current) return;

    const data = new FormData(event.currentTarget);
    const errors = validateAnthropometryMeasurements({ weightKg, heightCm });

    if (weightInput.trim() && weightKg === undefined) {
      errors.weightKg = "O peso deve ser um número maior que zero.";
    }
    if (heightInput.trim() && heightCm === undefined) {
      errors.heightCm = "A altura deve ser um número maior que zero.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setOpenSection("measurements");
      requestAnimationFrame(() => {
        document
          .getElementById(errors.weightKg ? "weightKg" : "heightCm")
          ?.focus();
      });
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const continueAfterSave = submitter?.value !== "save";
    submittingRef.current = true;

    try {
      await onSave(
        {
          weightKg,
          heightCm,
          bmi,
          notes: String(data.get("notes") ?? "").trim() || undefined,
        },
        continueAfterSave,
      );
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form
      id="clinical-form-anthropometry"
      noValidate
      onChange={(event) => onDirty(draftFromForm(event.currentTarget))}
      onInvalid={focusFirstInvalidField}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <dl
          aria-label="Dados do paciente"
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Idade</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{ageLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Sexo</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{sexLabel}</dd>
          </div>
        </dl>

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
              <>
                <span className="relative block">
                  <input
                  aria-describedby={fieldErrors.weightKg ? "weightKg-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.weightKg)}
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
                  onChange={(event) => {
                    setWeightInput(event.target.value);
                    setFieldErrors((current) => ({ ...current, weightKg: undefined }));
                  }}
                  required
                  type="text"
                  value={weightInput}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
                    kg
                  </span>
                </span>
                {fieldErrors.weightKg ? (
                  <span className="mt-1.5 block text-xs font-semibold text-rose-700" id="weightKg-error" role="alert">
                    {fieldErrors.weightKg}
                  </span>
                ) : null}
              </>
            </ClinicalField>

            <ClinicalField
              hint="Informe em metros (1,56) ou centímetros (156)."
              id="heightCm"
              label="Estatura"
              required
            >
              <>
                <span className="relative block">
                  <input
                  aria-describedby={fieldErrors.heightCm ? "heightCm-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.heightCm)}
                  aria-required="true"
                  className={`${clinicalInputClass} pr-16 font-semibold`}
                  id="heightCm"
                  inputMode="decimal"
                  name="heightCm"
                  onBlur={() => {
                    if (heightMeters !== undefined) {
                      setHeightInput(formatLocalizedNumber(heightMeters));
                    }
                  }}
                  onChange={(event) => {
                    setHeightInput(event.target.value);
                    setFieldErrors((current) => ({ ...current, heightCm: undefined }));
                  }}
                  required
                  type="text"
                  value={heightInput}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
                    m
                  </span>
                </span>
                {fieldErrors.heightCm ? (
                  <span className="mt-1.5 block text-xs font-semibold text-rose-700" id="heightCm-error" role="alert">
                    {fieldErrors.heightCm}
                  </span>
                ) : null}
              </>
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
          <ProfessionalAuditInfo
            audit={record.audit}
            origin={record.origin}
            responsible={responsibleProfessional}
          />
        </AccordionSection>
      </div>

      <ResponsiveActionBar>
        <button
          className="min-h-11 rounded-xl border border-[#12664f] bg-white px-6 text-sm font-black text-[#12664f] hover:bg-emerald-50 disabled:opacity-60"
          disabled={saving}
          name="anthropometryAction"
          type="submit"
          value="save"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60"
          disabled={saving}
          name="anthropometryAction"
          type="submit"
          value="continue"
        >
          {saving ? "Salvando..." : "Salvar e continuar"}
        </button>
      </ResponsiveActionBar>
    </form>
  );
}
