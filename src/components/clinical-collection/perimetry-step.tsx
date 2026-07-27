"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { AccordionSection } from "@/components/ui/accordion-section";
import {
  formatLocalizedNumber,
  parseLocalizedDecimal,
} from "@/features/clinical-collection/anthropometry-calculations";
import {
  perimetryGroups,
  type ClinicalStepRecord,
  type PerimetryData,
  type PreviousPerimetryReference,
} from "@/features/clinical-collection";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { PreviousValueIndicator } from "./previous-value-indicator";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";

function OptionalPerimetryField({
  id,
  label,
  value,
  previousValue,
  onChange,
}: {
  id: string;
  label: string;
  value?: number;
  previousValue?: number;
  onChange: () => void;
}) {
  return (
    <ClinicalField id={id} label={label}>
      <span className="relative block">
        <input
          className={`${clinicalInputClass} pr-16 font-semibold`}
          defaultValue={formatLocalizedNumber(value)}
          id={id}
          inputMode="decimal"
          name={id}
          onChange={onChange}
          type="text"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
          cm
        </span>
      </span>
      {previousValue !== undefined ? (
        <span className="mt-1.5 block">
          <PreviousValueIndicator
            current={value}
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
  saving,
  onDirty,
  onSave,
}: {
  record: ClinicalStepRecord<PerimetryData>;
  previous?: PreviousPerimetryReference;
  saving: boolean;
  onDirty: () => void;
  onSave: (data: PerimetryData) => Promise<void>;
}) {
  const [openGroup, setOpenGroup] = useState(
    perimetryGroups[0]?.key ?? "notes",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const values: Record<string, number | string | undefined> = {};

    for (const group of perimetryGroups) {
      for (const field of group.fields) {
        values[String(field.key)] = parseLocalizedDecimal(
          String(form.get(String(field.key)) ?? ""),
        );
      }
    }

    values.notes = String(form.get("notes") ?? "").trim() || undefined;

    await onSave(values as PerimetryData);
  }

  return (
    <form id="clinical-form-perimetry" onChange={onDirty} onInvalid={focusFirstInvalidField} onSubmit={submit}>
      <div className="space-y-4">
        <ProfessionalAuditInfo
          audit={record.audit}
          origin={record.origin}
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
                  onChange={onDirty}
                  previousValue={
                    previous?.values[field.key] as number | undefined
                  }
                  value={record.data[field.key] as number | undefined}
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
              onChange={onDirty}
            />
          </ClinicalField>
        </AccordionSection>
      </div>

      <ResponsiveActionBar>
        <span className="mr-auto self-center px-2 text-xs font-semibold text-slate-500">
          Comparação discreta, sem interpretação automática
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
