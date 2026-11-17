"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";

import {
  formatBmi,
  formatLocalizedNumber,
} from "@/features/clinical-collection/anthropometry-calculations";
import {
  bioimpedanceGroups,
  type BioimpedanceAvanutriData,
  type ClinicalCollectionView,
  type ClinicalStepRecord,
  type ProfessionalAudit,
} from "@/features/clinical-collection";
import {
  bioimpedanceEditableFields,
  parseBioimpedanceInputs,
  type BioimpedanceEditableKey,
  type BioimpedanceMeasurementErrors,
} from "@/features/clinical-collection/bioimpedance-measurements";
import { basalMetabolicRateMissingReason } from "@/features/clinical-collection/basal-metabolic-rate-status";

import { AccordionSection } from "@/components/ui/accordion-section";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
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

function EditableMeasurement({
  id,
  label,
  unit,
  value,
  error,
  hint,
  integer = false,
  onBlur,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  error?: string;
  hint?: string;
  integer?: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <ClinicalField hint={hint} id={id} label={label}>
      <span className="relative block">
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          className={`${clinicalInputClass} pr-16 font-semibold ${error ? "border-rose-500 ring-2 ring-rose-500/15" : ""}`}
          id={id}
          inputMode={integer ? "numeric" : "decimal"}
          name={id}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
          {unit}
        </span>
      </span>
      {error ? (
        <span
          className="mt-1.5 block text-xs font-semibold text-rose-700"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </ClinicalField>
  );
}

export function BioimpedanceStep({
  record,
  patientAge,
  patientSex,
  heightCm,
  measuredAt,
  responsibleProfessional,
  saving,
  onCompare,
  onDirty,
  onSave,
}: {
  record: ClinicalStepRecord<BioimpedanceAvanutriData>;
  patientAge?: number;
  patientSex?: ClinicalCollectionView["patientSex"];
  heightCm?: number;
  measuredAt?: string;
  responsibleProfessional: ProfessionalAudit;
  saving: boolean;
  onCompare: () => void;
  onDirty: (data: BioimpedanceAvanutriData) => void;
  onSave: (
    data: BioimpedanceAvanutriData,
    continueAfterSave: boolean,
  ) => Promise<void>;
}) {
  const submittingRef = useRef(false);
  const [openGroup, setOpenGroup] = useState(
    bioimpedanceGroups[0]?.key ?? "",
  );
  const [inputs, setInputs] = useState<
    Partial<Record<BioimpedanceEditableKey, string>>
  >(() =>
    Object.fromEntries(
      bioimpedanceEditableFields.map((field) => [
        field.key,
        formatLocalizedNumber(record.data[field.key] as number | undefined),
      ]),
    ),
  );
  const [fieldErrors, setFieldErrors] =
    useState<BioimpedanceMeasurementErrors>({});
  const parsedInputs = parseBioimpedanceInputs(inputs);
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
  const weightLabel = record.data.weightKg
    ? `${formatLocalizedNumber(record.data.weightKg)} kg`
    : "Não informado";
  const heightLabel = heightCm
    ? `${formatLocalizedNumber(heightCm)} cm`
    : "Não informado";
  const evaluationDate = measuredAt ? new Date(measuredAt) : undefined;
  const evaluationDateLabel =
    evaluationDate && !Number.isNaN(evaluationDate.getTime())
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
          evaluationDate,
        )
      : "Não informado";
  const missingBmiFields = [
    record.data.weightKg ? undefined : "peso",
    heightCm ? undefined : "altura",
  ].filter((value): value is string => Boolean(value));
  const bmiHint = record.data.bmi
    ? "Calculado automaticamente com peso e altura reais da Antropometria."
    : `IMC não calculado: informe ${missingBmiFields.join(" e ")} na Antropometria.`;
  const basalMetabolicRateMissing = basalMetabolicRateMissingReason({
    recordedValue: parsedInputs.data.basalMetabolicRateKcal,
    ageYears: patientAge,
    sex: patientSex,
    weightKg: record.data.weightKg,
    heightCm,
    protocolDefined: false,
  });
  const basalMetabolicRateHint = inputs.basalMetabolicRateKcal?.trim()
    ? "Valor real registrado no relatório de bioimpedância."
    : `${basalMetabolicRateMissing} Registre o valor real do relatório ou selecione o protocolo na Estratégia Nutricional.`;

  function draftFromForm(form: HTMLFormElement): BioimpedanceAvanutriData {
    const values = new FormData(form);
    const draftInputs = Object.fromEntries(
      bioimpedanceEditableFields.map((field) => [
        field.key,
        String(values.get(String(field.key)) ?? ""),
      ]),
    );
    return {
      ...parseBioimpedanceInputs(draftInputs).data,
      weightKg: record.data.weightKg,
      bmi: record.data.bmi,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submittingRef.current) return;

    const parsed = parseBioimpedanceInputs(inputs);
    const firstInvalidKey = Object.keys(parsed.errors)[0] as
      | BioimpedanceEditableKey
      | undefined;

    if (firstInvalidKey) {
      setFieldErrors(parsed.errors);
      const invalidGroup = bioimpedanceGroups.find((group) =>
        group.fields.some((field) => field.key === firstInvalidKey),
      );
      if (invalidGroup) setOpenGroup(invalidGroup.key);
      requestAnimationFrame(() =>
        document.getElementById(firstInvalidKey)?.focus(),
      );
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const continueAfterSave = submitter?.value !== "save";
    submittingRef.current = true;

    try {
      await onSave(
        {
          ...parsed.data,
          weightKg: record.data.weightKg,
          bmi: record.data.bmi,
        },
        continueAfterSave,
      );
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form
      id="clinical-form-bioimpedance"
      noValidate
      onChange={(event) => onDirty(draftFromForm(event.currentTarget))}
      onInvalid={focusFirstInvalidField}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <dl
          aria-label="Contexto da Bioimpedância"
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Sexo</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{sexLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Idade</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{ageLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Peso</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{weightLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Altura</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{heightLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Data da avaliação</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{evaluationDateLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Equipamento</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">Não informado</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Protocolo</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">Não informado</dd>
          </div>
        </dl>

        <div className="flex justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            onClick={onCompare}
            type="button"
          >
            Comparar avaliações
          </button>
        </div>

        {patientSex === undefined || patientSex === "NOT_INFORMED" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900" role="status">
            Sexo não informado no cadastro; nenhum cálculo dependente de sexo foi aplicado.
          </p>
        ) : null}

        <ProfessionalAuditInfo
          audit={record.audit}
          origin={record.origin}
          responsible={responsibleProfessional}
        />

        {bioimpedanceGroups.map((group, index) => {
          const description = group.key.includes("segmental")
            ? "Distribuição por segmento corporal conforme relatório do equipamento."
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
                        value={
                          formatLocalizedNumber(record.data.weightKg) ||
                          "Não informado"
                        }
                      />
                    );
                  }

                  if (field.key === "bmi") {
                    return (
                      <ReadOnlyMeasurement
                        hint={bmiHint}
                        id={String(field.key)}
                        key={String(field.key)}
                        label={field.label}
                        unit={field.unit}
                        value={formatBmi(record.data.bmi) || "Não informado"}
                      />
                    );
                  }

                  return (
                    <EditableMeasurement
                      error={
                        fieldErrors[field.key as BioimpedanceEditableKey]
                      }
                      id={String(field.key)}
                      hint={
                        field.key === "basalMetabolicRateKcal"
                          ? basalMetabolicRateHint
                          : undefined
                      }
                      integer={field.key === "metabolicAgeYears"}
                      key={String(field.key)}
                      label={field.label}
                      onBlur={() => {
                        const key = field.key as BioimpedanceEditableKey;
                        const value = parsedInputs.data[key];
                        if (value !== undefined) {
                          setInputs((current) => ({
                            ...current,
                            [key]: formatLocalizedNumber(value),
                          }));
                        }
                      }}
                      onChange={(value) => {
                        const key = field.key as BioimpedanceEditableKey;
                        setInputs((current) => ({ ...current, [key]: value }));
                        setFieldErrors((current) => ({
                          ...current,
                          [key]: undefined,
                        }));
                      }}
                      unit={field.unit}
                      value={
                        inputs[field.key as BioimpedanceEditableKey] ?? ""
                      }
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
          Somente registre valores confirmados no relatório do equipamento
        </span>

        <button
          className="min-h-11 rounded-xl border border-[#12664f] bg-white px-6 text-sm font-black text-[#12664f] hover:bg-emerald-50 disabled:opacity-60"
          disabled={saving}
          name="bioimpedanceAction"
          type="submit"
          value="save"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>

        <button
          className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60"
          disabled={saving}
          name="bioimpedanceAction"
          type="submit"
          value="continue"
        >
          {saving ? "Salvando..." : "Salvar e continuar"}
        </button>
      </ResponsiveActionBar>
    </form>
  );
}
