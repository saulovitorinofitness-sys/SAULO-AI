"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";

import { AccordionSection } from "@/components/ui/accordion-section";
import {
  formatLocalizedNumber,
} from "@/features/clinical-collection/anthropometry-calculations";
import {
  perimetryGroups,
  type ClinicalCollectionView,
  type ClinicalStepRecord,
  type PerimetryData,
  type PreviousPerimetryReference,
  type ProfessionalAudit,
} from "@/features/clinical-collection";
import {
  parsePerimetryInputs,
  perimetryMeasurementFields,
  type PerimetryMeasurementErrors,
  type PerimetryMeasurementKey,
} from "@/features/clinical-collection/perimetry-measurements";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { PreviousValueIndicator } from "./previous-value-indicator";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";

function OptionalPerimetryField({
  id,
  label,
  value,
  currentValue,
  error,
  previousValue,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  currentValue?: number;
  error?: string;
  previousValue?: number;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <ClinicalField id={id} label={label}>
      <span className="relative block">
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          className={`${clinicalInputClass} pr-16 font-semibold ${error ? "border-rose-500 ring-2 ring-rose-500/15" : ""}`}
          id={id}
          inputMode="decimal"
          name={id}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
          cm
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
      {previousValue !== undefined ? (
        <span className="mt-1.5 block">
          <PreviousValueIndicator
            current={currentValue}
            previous={previousValue}
            unit="cm"
          />
        </span>
      ) : null}
    </ClinicalField>
  );
}

export function PerimetryStep({
  record,
  previous,
  measuredAt,
  patientSex,
  responsibleProfessional,
  saving,
  onCompare,
  onDirty,
  onSave,
}: {
  record: ClinicalStepRecord<PerimetryData>;
  previous?: PreviousPerimetryReference;
  measuredAt?: string;
  patientSex?: ClinicalCollectionView["patientSex"];
  responsibleProfessional: ProfessionalAudit;
  saving: boolean;
  onCompare: () => void;
  onDirty: (data: PerimetryData) => void;
  onSave: (
    data: PerimetryData,
    continueAfterSave: boolean,
  ) => Promise<void>;
}) {
  const submittingRef = useRef(false);
  const [openGroup, setOpenGroup] = useState(
    perimetryGroups[0]?.key ?? "notes",
  );
  const [inputs, setInputs] = useState<
    Partial<Record<PerimetryMeasurementKey, string>>
  >(() =>
    Object.fromEntries(
      perimetryMeasurementFields.map((field) => [
        field.key,
        formatLocalizedNumber(record.data[field.key] as number | undefined),
      ]),
    ),
  );
  const [fieldErrors, setFieldErrors] =
    useState<PerimetryMeasurementErrors>({});
  const parsedInputs = parsePerimetryInputs(inputs);
  const sexLabel =
    patientSex === "FEMALE"
      ? "Feminino"
      : patientSex === "MALE"
        ? "Masculino"
        : patientSex === "INTERSEX"
          ? "Intersexo"
          : "Não informado";
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  });

  function dateLabel(value?: string) {
    if (!value) return "Não informado";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Não informado"
      : dateFormatter.format(date);
  }

  function draftFromForm(form: HTMLFormElement): PerimetryData {
    const values = new FormData(form);
    const draftInputs = Object.fromEntries(
      perimetryMeasurementFields.map((field) => [
        field.key,
        String(values.get(String(field.key)) ?? ""),
      ]),
    );
    return {
      ...parsePerimetryInputs(draftInputs).data,
      notes: String(values.get("notes") ?? "").trim() || undefined,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submittingRef.current) return;

    const form = new FormData(event.currentTarget);
    const parsed = parsePerimetryInputs(inputs);
    const firstInvalidKey = Object.keys(parsed.errors)[0] as
      | PerimetryMeasurementKey
      | undefined;

    if (firstInvalidKey) {
      setFieldErrors(parsed.errors);
      const invalidGroup = perimetryGroups.find((group) =>
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
          notes: String(form.get("notes") ?? "").trim() || undefined,
        },
        continueAfterSave,
      );
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form
      id="clinical-form-perimetry"
      noValidate
      onChange={(event) => onDirty(draftFromForm(event.currentTarget))}
      onInvalid={focusFirstInvalidField}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <dl
          aria-label="Contexto da Perimetria"
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
        >
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Sexo</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{sexLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Data da avaliação</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{dateLabel(measuredAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Avaliação anterior</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{dateLabel(previous?.measuredAt)}</dd>
          </div>
        </dl>

        <div className="flex justify-end">
          <button
            className="min-h-11 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            onClick={onCompare}
            type="button"
          >
            Comparar avaliações
          </button>
        </div>

        {patientSex === undefined || patientSex === "NOT_INFORMED" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900" role="status">
            Sexo não informado no cadastro; nenhuma validação específica por sexo foi aplicada.
          </p>
        ) : null}

        <ProfessionalAuditInfo
          audit={record.audit}
          origin={record.origin}
          responsible={responsibleProfessional}
        />

        {perimetryGroups.map((group, index) => (
          <AccordionSection
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
              {group.fields.map((field) => (
                <OptionalPerimetryField
                  id={String(field.key)}
                  key={String(field.key)}
                  label={field.label}
                  currentValue={
                    parsedInputs.data[field.key] as number | undefined
                  }
                  error={
                    fieldErrors[field.key as PerimetryMeasurementKey]
                  }
                  onBlur={() => {
                    const key = field.key as PerimetryMeasurementKey;
                    const value = parsedInputs.data[key];
                    if (value !== undefined) {
                      setInputs((current) => ({
                        ...current,
                        [key]: formatLocalizedNumber(value),
                      }));
                    }
                  }}
                  onChange={(value) => {
                    const key = field.key as PerimetryMeasurementKey;
                    setInputs((current) => ({ ...current, [key]: value }));
                    setFieldErrors((current) => ({
                      ...current,
                      [key]: undefined,
                    }));
                  }}
                  previousValue={
                    previous?.values[field.key] as number | undefined
                  }
                  value={
                    inputs[field.key as PerimetryMeasurementKey] ?? ""
                  }
                />
              ))}
            </div>
          </AccordionSection>
        ))}

        <AccordionSection
          number={perimetryGroups.length + 1}
          onToggle={() =>
            setOpenGroup((current) =>
              current === "notes" ? "" : "notes",
            )
          }
          open={openGroup === "notes"}
          title="Observação"
        >
          <ClinicalField
            id="notes"
            label="Observação da perimetria"
          >
            <textarea
              className={`${clinicalInputClass} min-h-24 resize-y py-3`}
              defaultValue={record.data.notes}
              id="notes"
              name="notes"
            />
          </ClinicalField>
        </AccordionSection>

      </div>

      <ResponsiveActionBar>
        <span className="mr-auto self-center px-2 text-xs font-semibold text-slate-500">
          Comparação discreta, sem interpretação automática
        </span>

        <button
          className="min-h-11 rounded-xl border border-[#12664f] bg-white px-6 text-sm font-black text-[#12664f] hover:bg-emerald-50 disabled:opacity-60"
          disabled={saving}
          name="perimetryAction"
          type="submit"
          value="save"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>

        <button
          className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60"
          disabled={saving}
          name="perimetryAction"
          type="submit"
          value="continue"
        >
          {saving ? "Salvando..." : "Salvar e continuar"}
        </button>
      </ResponsiveActionBar>
    </form>
  );
}
