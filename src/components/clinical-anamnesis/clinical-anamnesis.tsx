"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ClinicalField,
  clinicalInputClass,
} from "@/components/clinical-collection/clinical-field";
import { SectionCard } from "@/components/clinical-collection/section-card";
import { Button } from "@/components/ui/button";
import { SectionGuide } from "@/components/ui/section-guide";
import {
  clinicalAnamnesisService,
  clinicalHistoryOptions,
  familyHistoryOptions,
  objectiveOptions,
  type AnamnesisObjective,
  type ClinicalAnamnesisData,
  type ClinicalAnamnesisView,
  type ClinicalHistoryItem,
  type FamilyHistoryItem,
} from "@/features/clinical-anamnesis";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const areaClass = `${clinicalInputClass} min-h-24 resize-y py-3`;

type SaveState = "IDLE" | "SAVING" | "SAVED" | "ERROR";
type SectionKey =
  | "CONSULTA"
  | "HISTORICO"
  | "MEDICAMENTOS"
  | "RESTRICOES"
  | "HABITOS"
  | "ROTINA"
  | "ALIMENTACAO"
  | "OBSERVACOES";

type ChecklistProps<T extends string> = {
  readonly options: readonly (readonly [T, string])[];
  readonly values: readonly T[];
  readonly disabled: boolean;
  readonly onChange: (values: T[]) => void;
};

function Checklist<T extends string>({
  options,
  values,
  disabled,
  onChange,
}: ChecklistProps<T>) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {options.map(([value, label]) => {
        const checked = values.includes(value);
        return (
          <label
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
              checked
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            key={value}
          >
            <input
              checked={checked}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, value]
                    : values.filter((item) => item !== value),
                )
              }
              type="checkbox"
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

type RepeatingColumn<T> = {
  readonly key: Exclude<keyof T, "id">;
  readonly label: string;
  readonly type?: string;
};

type RepeatingTableProps<T extends { readonly id: string }> = {
  readonly title: string;
  readonly emptyLabel: string;
  readonly rows: readonly T[];
  readonly columns: readonly RepeatingColumn<T>[];
  readonly disabled: boolean;
  readonly create: () => T;
  readonly onChange: (rows: T[]) => void;
};

function RepeatingTable<T extends { readonly id: string }>({
  title,
  emptyLabel,
  rows,
  columns,
  disabled,
  create,
  onChange,
}: RepeatingTableProps<T>) {
  return (
    <div>
      <div className="space-y-3">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-4"
              key={row.id}
            >
              {columns.map((column) => (
                <label
                  className="text-xs font-bold text-slate-600"
                  key={String(column.key)}
                >
                  {column.label}
                  <input
                    className={`${clinicalInputClass} bg-white`}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(
                        rows.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, [column.key]: event.target.value }
                            : item,
                        ) as T[],
                      )
                    }
                    type={column.type ?? "text"}
                    value={String(row[column.key] ?? "")}
                  />
                </label>
              ))}
              {!disabled ? (
                <Button
                  className="self-end"
                  onClick={() =>
                    onChange(rows.filter((_, itemIndex) => itemIndex !== index))
                  }
                  size="small"
                  type="button"
                  variant="destructive"
                >
                  Remover
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            {emptyLabel}
          </p>
        )}
      </div>
      {!disabled ? (
        <Button
          className="mt-3"
          onClick={() => onChange([...rows, create()])}
          size="small"
          type="button"
          variant="secondary"
        >
          Adicionar {title.toLocaleLowerCase("pt-BR")}
        </Button>
      ) : null}
    </div>
  );
}

function filledText(value: string) {
  return value.trim().length > 0;
}

export function ClinicalAnamnesis({
  continueHref,
  initialView,
}: {
  readonly continueHref?: string;
  readonly initialView: ClinicalAnamnesisView;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [data, setData] = useState<ClinicalAnamnesisData>(initialView.data);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("IDLE");
  const [activeSection, setActiveSection] = useState<SectionKey>("CONSULTA");
  const [diagnosisDraft, setDiagnosisDraft] = useState("");
  const [allergyDraft, setAllergyDraft] = useState("");

  useEffect(() => {
    let active = true;
    void clinicalAnamnesisService
      .get({ patientId: initialView.patientId, scenario: initialView.scenario })
      .then((stored) => {
        if (active && stored) {
          setView(stored);
          setData(stored.data);
        }
      });
    return () => {
      active = false;
    };
  }, [initialView]);

  const sectionCompletion = useMemo(
    () => ({
      CONSULTA:
        filledText(data.chiefComplaint) || Boolean(data.primaryObjective),
      HISTORICO:
        data.clinicalHistory.length > 0 ||
        filledText(data.clinicalHistoryNotes) ||
        data.familyHistory.length > 0 ||
        data.surgeries.length > 0 ||
        data.injuries.length > 0,
      MEDICAMENTOS:
        data.medications.length > 0 || data.supplements.length > 0,
      RESTRICOES:
        data.allergies.length > 0 || filledText(data.nutrition.restrictions),
      HABITOS:
        filledText(data.sleep.hours) ||
        filledText(data.sleep.quality) ||
        filledText(data.habits.alcohol) ||
        filledText(data.habits.smoking),
      ROTINA:
        filledText(data.physicalActivity.frequency) ||
        filledText(data.physicalActivity.modality),
      ALIMENTACAO:
        filledText(data.nutrition.mealsPerDay) ||
        filledText(data.nutrition.water) ||
        filledText(data.nutrition.preferences),
      OBSERVACOES: filledText(data.generalNotes),
    }),
    [data],
  );

  const completion = useMemo(() => {
    const values = Object.values(sectionCompletion);
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [sectionCompletion]);

  const sections = useMemo(
    () =>
      [
        ["CONSULTA", "Consulta", "Queixa, objetivo e evolução"],
        ["HISTORICO", "Histórico clínico", "Patologias, família, cirurgias e lesões"],
        ["MEDICAMENTOS", "Medicamentos", "Medicamentos e suplementos"],
        ["RESTRICOES", "Alergias e restrições", "Alergias, intolerâncias e restrições"],
        ["HABITOS", "Sono e hábitos", "Sono, estresse, álcool e tabagismo"],
        ["ROTINA", "Rotina e atividade", "Atividade física e rotina funcional"],
        ["ALIMENTACAO", "Rotina alimentar", "Refeições, água e preferências"],
        ["OBSERVACOES", "Observações", "Registro clínico complementar"],
      ] as const,
    [],
  );

  const update = <K extends keyof ClinicalAnamnesisData>(
    key: K,
    value: ClinicalAnamnesisData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaveState("SAVING");
    try {
      const result = await clinicalAnamnesisService.save({
        patientId: view.patientId,
        scenario: view.scenario,
        data,
      });
      setView(result.view);
      setData(result.view.data);
      setEditing(false);
      setSaveState("SAVED");
      if (continueHref) {
        router.push(continueHref);
      }
    } catch {
      setSaveState("ERROR");
    }
  }

  const disabled = !editing;

  return (
    <div className="space-y-4 pb-24">
      <section className="rounded-2xl bg-[#103f32] p-5 text-white shadow-[0_16px_38px_rgb(10_73_56/0.14)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">
              Prontuário Mestre · Anamnese Clínica
            </p>
            <h2 className="mt-1 text-xl font-black">{view.patientName}</h2>
            <p className="mt-2 text-xs font-semibold text-emerald-100">
              {view.patientCode} · versão {view.version}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-white/10 p-3 text-xs">
              <p className="font-black uppercase tracking-wide text-emerald-100">
                Preenchimento
              </p>
              <p className="mt-1 text-lg font-black">{completion}%</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-xs">
              <p>
                Atualizada por <strong>{view.audit.professionalName}</strong>
              </p>
              <p className="mt-1">
                {dateTime.format(new Date(view.audit.updatedAt))}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
        <div>
          <p className="text-sm font-black text-emerald-950">
            Fonte clínica oficial do paciente
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-800">
            Cada informação é registrada uma única vez e herdada somente pelos módulos autorizados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-live="polite"
            className={`text-xs font-bold ${
              saveState === "ERROR" ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {saveState === "SAVING"
              ? "Salvando…"
              : saveState === "SAVED"
                ? "Anamnese salva."
                : saveState === "ERROR"
                  ? "Erro ao salvar."
                  : ""}
          </span>
          {editing ? (
            <>
              <Button
                onClick={() => {
                  setData(view.data);
                  setEditing(false);
                  setSaveState("IDLE");
                }}
                size="small"
                type="button"
                variant="ghost"
              >
                Cancelar
              </Button>
              <Button
                disabled={saveState === "SAVING"}
                loading={saveState === "SAVING"}
                onClick={save}
                size="small"
                type="button"
              >
                {continueHref ? "Salvar e continuar" : "Salvar anamnese"}
              </Button>
            </>
          ) : (
            <Button
              disabled={!view.canEdit}
              onClick={() => setEditing(true)}
              size="small"
              type="button"
            >
              Preencher ou editar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-2 lg:sticky lg:top-4">
          <p className="px-3 pb-2 pt-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Blocos da anamnese
          </p>
          <nav className="space-y-1" aria-label="Blocos da anamnese">
            {sections.map(([key, title, description]) => {
              const active = activeSection === key;
              const completed = sectionCompletion[key];
              return (
                <button
                  className={`w-full rounded-xl px-3 py-3 text-left transition ${
                    active
                      ? "bg-emerald-950 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                  key={key}
                  onClick={() => setActiveSection(key)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black">{title}</span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        completed
                          ? active
                            ? "bg-emerald-300"
                            : "bg-emerald-500"
                          : active
                            ? "bg-white/40"
                            : "bg-slate-300"
                      }`}
                    />
                  </span>
                  <span
                    className={`mt-1 block text-[11px] font-semibold ${
                      active ? "text-emerald-100" : "text-slate-400"
                    }`}
                  >
                    {description}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <fieldset disabled={disabled}>
          {activeSection === "CONSULTA" ? (
            <div className="space-y-4">
              <SectionCard title="Motivo da consulta e objetivos">
                <SectionGuide>
                  Qual é o principal motivo da consulta e o que o paciente deseja alcançar?
                </SectionGuide>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ClinicalField id="chiefComplaint" label="Queixa principal">
                    <textarea
                      className={areaClass}
                      id="chiefComplaint"
                      onChange={(event) => update("chiefComplaint", event.target.value)}
                      placeholder="Não informado"
                      value={data.chiefComplaint}
                    />
                  </ClinicalField>
                  <ClinicalField id="primaryObjective" label="Objetivo principal">
                    <select
                      className={clinicalInputClass}
                      id="primaryObjective"
                      onChange={(event) =>
                        update(
                          "primaryObjective",
                          event.target.value as AnamnesisObjective,
                        )
                      }
                      value={data.primaryObjective}
                    >
                      <option value="">Não informado</option>
                      {objectiveOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </ClinicalField>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-bold text-slate-700">
                    Objetivos secundários
                  </p>
                  <Checklist
                    disabled={disabled}
                    onChange={(values) => update("secondaryObjectives", values)}
                    options={objectiveOptions}
                    values={data.secondaryObjectives}
                  />
                </div>
              </SectionCard>

              <SectionCard title="História do problema atual">
                <SectionGuide>
                  Quando o problema começou, como evoluiu e qual é a situação atual?
                </SectionGuide>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ClinicalField id="onset" label="Quando começou">
                    <input
                      className={clinicalInputClass}
                      id="onset"
                      onChange={(event) =>
                        update("currentIllness", {
                          ...data.currentIllness,
                          onset: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.currentIllness.onset}
                    />
                  </ClinicalField>
                  <ClinicalField id="duration" label="Duração ou tempo de evolução">
                    <input
                      className={clinicalInputClass}
                      id="duration"
                      onChange={(event) =>
                        update("currentIllness", {
                          ...data.currentIllness,
                          duration: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.currentIllness.duration}
                    />
                  </ClinicalField>
                  <ClinicalField id="evolution" label="Evolução">
                    <textarea
                      className={areaClass}
                      id="evolution"
                      onChange={(event) =>
                        update("currentIllness", {
                          ...data.currentIllness,
                          evolution: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.currentIllness.evolution}
                    />
                  </ClinicalField>
                  <ClinicalField id="previousTreatments" label="Tratamentos anteriores">
                    <textarea
                      className={areaClass}
                      id="previousTreatments"
                      onChange={(event) =>
                        update("currentIllness", {
                          ...data.currentIllness,
                          previousTreatments: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.currentIllness.previousTreatments}
                    />
                  </ClinicalField>
                  <div className="sm:col-span-2">
                    <ClinicalField id="currentSituation" label="Situação atual">
                      <textarea
                        className={areaClass}
                        id="currentSituation"
                        onChange={(event) =>
                          update("currentIllness", {
                            ...data.currentIllness,
                            currentSituation: event.target.value,
                          })
                        }
                        placeholder="Não informado"
                        value={data.currentIllness.currentSituation}
                      />
                    </ClinicalField>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeSection === "HISTORICO" ? (
            <div className="space-y-4">
              <SectionCard title="Patologias e diagnósticos">
                <SectionGuide>
                  Quais doenças ou condições clínicas o paciente possui?
                </SectionGuide>
                <Checklist<ClinicalHistoryItem>
                  disabled={disabled}
                  onChange={(values) => update("clinicalHistory", values)}
                  options={clinicalHistoryOptions}
                  values={data.clinicalHistory}
                />
                <div className="mt-4">
                  <ClinicalField
                    id="clinicalHistoryNotes"
                    label="Diagnósticos adicionais"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          className={clinicalInputClass}
                          id="clinicalHistoryNotes"
                          onChange={(event) => setDiagnosisDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            const diagnosis = diagnosisDraft.trim();
                            if (!diagnosis) return;
                            const diagnoses = data.clinicalHistoryNotes
                              .split("\n")
                              .map((item) => item.trim())
                              .filter(Boolean);
                            if (
                              !diagnoses.some(
                                (item) =>
                                  item.toLocaleLowerCase("pt-BR") ===
                                  diagnosis.toLocaleLowerCase("pt-BR"),
                              )
                            ) {
                              update(
                                "clinicalHistoryNotes",
                                [...diagnoses, diagnosis].join("\n"),
                              );
                            }
                            setDiagnosisDraft("");
                          }}
                          placeholder="Digite o diagnóstico"
                          value={diagnosisDraft}
                        />
                        <Button
                          disabled={disabled || !diagnosisDraft.trim()}
                          onClick={() => {
                            const diagnosis = diagnosisDraft.trim();
                            if (!diagnosis) return;
                            const diagnoses = data.clinicalHistoryNotes
                              .split("\n")
                              .map((item) => item.trim())
                              .filter(Boolean);
                            if (
                              !diagnoses.some(
                                (item) =>
                                  item.toLocaleLowerCase("pt-BR") ===
                                  diagnosis.toLocaleLowerCase("pt-BR"),
                              )
                            ) {
                              update(
                                "clinicalHistoryNotes",
                                [...diagnoses, diagnosis].join("\n"),
                              );
                            }
                            setDiagnosisDraft("");
                          }}
                          size="small"
                          type="button"
                          variant="secondary"
                        >
                          Adicionar diagnóstico
                        </Button>
                      </div>

                      {data.clinicalHistoryNotes
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean).length ? (
                        <div className="flex flex-wrap gap-2">
                          {data.clinicalHistoryNotes
                            .split("\n")
                            .map((item) => item.trim())
                            .filter(Boolean)
                            .map((diagnosis) => (
                              <span
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-950"
                                key={diagnosis}
                              >
                                {diagnosis}
                                {!disabled ? (
                                  <button
                                    aria-label={`Remover ${diagnosis}`}
                                    className="text-base leading-none text-rose-600 hover:text-rose-800"
                                    onClick={() =>
                                      update(
                                        "clinicalHistoryNotes",
                                        data.clinicalHistoryNotes
                                          .split("\n")
                                          .map((item) => item.trim())
                                          .filter(
                                            (item) => item && item !== diagnosis,
                                          )
                                          .join("\n"),
                                      )
                                    }
                                    type="button"
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                          Nenhum diagnóstico adicional informado.
                        </p>
                      )}
                    </div>
                  </ClinicalField>
                </div>
              </SectionCard>

              <SectionCard title="Histórico familiar">
                <SectionGuide>
                  Existem doenças ou condições clínicas relevantes na família do paciente?
                </SectionGuide>
                <Checklist<FamilyHistoryItem>
                  disabled={disabled}
                  onChange={(values) => update("familyHistory", values)}
                  options={familyHistoryOptions}
                  values={data.familyHistory}
                />
              </SectionCard>

              <SectionCard title="Cirurgias e lesões">
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 text-sm font-black text-slate-800">Cirurgias</h3>
                    <SectionGuide>
                      O paciente já realizou algum procedimento cirúrgico?
                    </SectionGuide>
                    <RepeatingTable
                      columns={[
                        { key: "procedure", label: "Procedimento" },
                        { key: "date", label: "Data", type: "date" },
                        { key: "notes", label: "Observações" },
                      ]}
                      create={() => ({
                        id: crypto.randomUUID(),
                        procedure: "",
                        date: "",
                        notes: "",
                      })}
                      disabled={disabled}
                      emptyLabel="Nenhuma cirurgia informada."
                      onChange={(rows) => update("surgeries", rows)}
                      rows={data.surgeries}
                      title="cirurgia"
                    />
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-black text-slate-800">Lesões</h3>
                    <SectionGuide>
                      Existe alguma lesão, dor ou limitação funcional relevante?
                    </SectionGuide>
                    <RepeatingTable
                      columns={[
                        { key: "region", label: "Região" },
                        { key: "date", label: "Data", type: "date" },
                        { key: "situation", label: "Situação atual" },
                        { key: "notes", label: "Observações" },
                      ]}
                      create={() => ({
                        id: crypto.randomUUID(),
                        region: "",
                        date: "",
                        situation: "",
                        notes: "",
                      })}
                      disabled={disabled}
                      emptyLabel="Nenhuma lesão informada."
                      onChange={(rows) => update("injuries", rows)}
                      rows={data.injuries}
                      title="lesão"
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeSection === "MEDICAMENTOS" ? (
            <SectionCard title="Medicamentos e suplementos em uso">
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-black text-slate-800">
                    Medicamentos
                  </h3>
                  <SectionGuide>
                    Quais medicamentos o paciente utiliza atualmente?
                  </SectionGuide>
                  <RepeatingTable
                    columns={[
                      { key: "name", label: "Nome" },
                      { key: "dose", label: "Dose" },
                      { key: "frequency", label: "Frequência" },
                      { key: "reason", label: "Motivo" },
                    ]}
                    create={() => ({
                      id: crypto.randomUUID(),
                      name: "",
                      dose: "",
                      frequency: "",
                      reason: "",
                    })}
                    disabled={disabled}
                    emptyLabel="Nenhum medicamento informado."
                    onChange={(rows) => update("medications", rows)}
                    rows={data.medications}
                    title="medicamento"
                  />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-black text-slate-800">
                    Suplementos
                  </h3>
                  <SectionGuide>
                    O paciente utiliza algum suplemento regularmente?
                  </SectionGuide>
                  <RepeatingTable
                    columns={[
                      { key: "name", label: "Nome" },
                      { key: "dose", label: "Dose" },
                      { key: "frequency", label: "Frequência" },
                    ]}
                    create={() => ({
                      id: crypto.randomUUID(),
                      name: "",
                      dose: "",
                      frequency: "",
                    })}
                    disabled={disabled}
                    emptyLabel="Nenhum suplemento informado."
                    onChange={(rows) => update("supplements", rows)}
                    rows={data.supplements}
                    title="suplemento"
                  />
                </div>
              </div>
            </SectionCard>
          ) : null}

          {activeSection === "RESTRICOES" ? (
            <SectionCard title="Alergias, intolerâncias e restrições">
              <SectionGuide>
                Existe alergia, intolerância ou restrição alimentar que precise ser considerada?
              </SectionGuide>
              <div className="grid gap-4 lg:grid-cols-2">
                <ClinicalField id="allergies" label="Alergias conhecidas">
                  <div className="space-y-3">
                    {!disabled ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          className={clinicalInputClass}
                          id="allergies"
                          onChange={(event) => setAllergyDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();

                            const allergy = allergyDraft.trim();
                            if (!allergy) return;

                            const alreadyExists = data.allergies.some(
                              (item) =>
                                item.toLocaleLowerCase("pt-BR") ===
                                allergy.toLocaleLowerCase("pt-BR"),
                            );

                            if (!alreadyExists) {
                              update("allergies", [...data.allergies, allergy]);
                            }
                            setAllergyDraft("");
                          }}
                          placeholder="Digite uma alergia"
                          value={allergyDraft}
                        />
                        <Button
                          onClick={() => {
                            const allergy = allergyDraft.trim();
                            if (!allergy) return;

                            const alreadyExists = data.allergies.some(
                              (item) =>
                                item.toLocaleLowerCase("pt-BR") ===
                                allergy.toLocaleLowerCase("pt-BR"),
                            );

                            if (!alreadyExists) {
                              update("allergies", [...data.allergies, allergy]);
                            }
                            setAllergyDraft("");
                          }}
                          size="small"
                          type="button"
                          variant="secondary"
                        >
                          Adicionar
                        </Button>
                      </div>
                    ) : null}

                    {data.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {data.allergies.map((allergy) => (
                          <span
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                            key={allergy}
                          >
                            {allergy}
                            {!disabled ? (
                              <button
                                aria-label={`Remover alergia ${allergy}`}
                                className="rounded-full px-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                                onClick={() =>
                                  update(
                                    "allergies",
                                    data.allergies.filter(
                                      (item) => item !== allergy,
                                    ),
                                  )
                                }
                                type="button"
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                        Nenhuma alergia informada.
                      </p>
                    )}
                  </div>
                </ClinicalField>
                {view.canViewNutrition ? (
                  <ClinicalField
                    id="nutrition-restrictions"
                    label="Intolerâncias e restrições alimentares"
                  >
                    <textarea
                      className={areaClass}
                      id="nutrition-restrictions"
                      onChange={(event) =>
                        update("nutrition", {
                          ...data.nutrition,
                          restrictions: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.nutrition.restrictions}
                    />
                  </ClinicalField>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {activeSection === "HABITOS" ? (
            <SectionCard title="Sono, estresse e hábitos">
              <SectionGuide>
                Como estão o sono, o estresse e os hábitos de vida do paciente?
              </SectionGuide>
              <div className="grid gap-4 sm:grid-cols-3">
                <ClinicalField id="sleepHours" label="Horas de sono">
                  <input
                    className={clinicalInputClass}
                    id="sleepHours"
                    onChange={(event) =>
                      update("sleep", { ...data.sleep, hours: event.target.value })
                    }
                    placeholder="Não informado"
                    value={data.sleep.hours}
                  />
                </ClinicalField>
                <ClinicalField id="sleepQuality" label="Qualidade do sono">
                  <select
                    className={clinicalInputClass}
                    id="sleepQuality"
                    onChange={(event) =>
                      update("sleep", { ...data.sleep, quality: event.target.value })
                    }
                    value={data.sleep.quality}
                  >
                    <option value="">Não informado</option>
                    <option value="Boa">Boa</option>
                    <option value="Regular">Regular</option>
                    <option value="Ruim">Ruim</option>
                  </select>
                </ClinicalField>
                <ClinicalField id="awakenings" label="Despertares noturnos">
                  <input
                    className={clinicalInputClass}
                    id="awakenings"
                    onChange={(event) =>
                      update("sleep", {
                        ...data.sleep,
                        awakenings: event.target.value,
                      })
                    }
                    placeholder="Não informado"
                    value={data.sleep.awakenings}
                  />
                </ClinicalField>
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-sm font-bold text-slate-700" htmlFor="stress">
                  Estresse percebido: {data.stressLevel}/10
                  <input
                    className="mt-3 w-full accent-[var(--primary)]"
                    id="stress"
                    max="10"
                    min="0"
                    onChange={(event) =>
                      update("stressLevel", Number(event.target.value))
                    }
                    type="range"
                    value={data.stressLevel}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["alcohol", "Álcool"],
                    ["smoking", "Tabagismo"],
                    ["others", "Outros hábitos"],
                  ] as const
                ).map(([key, label]) => (
                  <ClinicalField id={`habit-${key}`} key={key} label={label}>
                    <input
                      className={clinicalInputClass}
                      id={`habit-${key}`}
                      onChange={(event) =>
                        update("habits", {
                          ...data.habits,
                          [key]: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.habits[key]}
                    />
                  </ClinicalField>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {activeSection === "ROTINA" ? (
            <SectionCard title="Rotina e atividade física">
              <SectionGuide>
                Como é a rotina atual de exercícios e movimentação diária?
              </SectionGuide>
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["frequency", "Frequência"],
                    ["duration", "Duração"],
                    ["modality", "Modalidade"],
                  ] as const
                ).map(([key, label]) => (
                  <ClinicalField id={`activity-${key}`} key={key} label={label}>
                    <input
                      className={clinicalInputClass}
                      id={`activity-${key}`}
                      onChange={(event) =>
                        update("physicalActivity", {
                          ...data.physicalActivity,
                          [key]: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.physicalActivity[key]}
                    />
                  </ClinicalField>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {activeSection === "ALIMENTACAO" ? (
            view.canViewNutrition ? (
              <SectionCard title="Rotina alimentar">
                <SectionGuide>
                  Como é a rotina alimentar habitual do paciente?
                </SectionGuide>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ClinicalField
                    id="nutrition-mealsPerDay"
                    label="Número habitual de refeições"
                  >
                    <input
                      className={clinicalInputClass}
                      id="nutrition-mealsPerDay"
                      onChange={(event) =>
                        update("nutrition", {
                          ...data.nutrition,
                          mealsPerDay: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.nutrition.mealsPerDay}
                    />
                  </ClinicalField>
                  <ClinicalField id="nutrition-water" label="Consumo de água">
                    <input
                      className={clinicalInputClass}
                      id="nutrition-water"
                      onChange={(event) =>
                        update("nutrition", {
                          ...data.nutrition,
                          water: event.target.value,
                        })
                      }
                      placeholder="Não informado"
                      value={data.nutrition.water}
                    />
                  </ClinicalField>
                  <div className="sm:col-span-2">
                    <ClinicalField
                      id="nutrition-preferences"
                      label="Preferências, recusas e observações alimentares"
                    >
                      <textarea
                        className={areaClass}
                        id="nutrition-preferences"
                        onChange={(event) =>
                          update("nutrition", {
                            ...data.nutrition,
                            preferences: event.target.value,
                          })
                        }
                        placeholder="Não informado"
                        value={data.nutrition.preferences}
                      />
                    </ClinicalField>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <SectionCard title="Rotina alimentar">
                <p className="text-sm font-semibold text-slate-500">
                  Este perfil não possui permissão para visualizar dados nutricionais.
                </p>
              </SectionCard>
            )
          ) : null}

          {activeSection === "OBSERVACOES" ? (
            <div className="space-y-4">
              <SectionCard title="Observações clínicas gerais">
                <SectionGuide>
                  Existe alguma informação clínica importante que ainda não foi registrada?
                </SectionGuide>
                <ClinicalField id="generalNotes" label="Observações">
                  <textarea
                    className={`${areaClass} min-h-40`}
                    id="generalNotes"
                    onChange={(event) => update("generalNotes", event.target.value)}
                    placeholder="Não informado"
                    value={data.generalNotes}
                  />
                </ClinicalField>
              </SectionCard>

              <div className="grid gap-4 xl:grid-cols-2">
                <SectionCard title="Linha do tempo clínica">
                  {view.timeline.length ? (
                    <ol className="space-y-3">
                      {[...view.timeline].reverse().map((item) => (
                        <li className="rounded-xl border border-slate-200 p-3" key={item.id}>
                          <p className="text-sm font-black text-slate-800">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                          <p className="mt-2 text-[11px] font-semibold text-slate-400">
                            {item.actorName} · {dateTime.format(new Date(item.occurredAt))}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Nenhum evento clínico registrado.
                    </p>
                  )}
                </SectionCard>
                <SectionCard title="Histórico de versões">
                  {view.history.length ? (
                    <ol className="space-y-3">
                      {view.history.map((item) => (
                        <li className="rounded-xl border border-slate-200 p-3" key={item.id}>
                          <p className="text-sm font-black text-slate-800">
                            Versão {item.version}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{item.summary}</p>
                          <p className="mt-2 text-[11px] text-slate-400">
                            {item.changedBy} · {dateTime.format(new Date(item.changedAt))}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Nenhuma versão anterior disponível.
                    </p>
                  )}
                </SectionCard>
              </div>
            </div>
          ) : null}
        </fieldset>
      </div>
    </div>
  );
}
