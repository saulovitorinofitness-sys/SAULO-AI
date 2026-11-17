import { CheckIcon } from "@/components/ui/icons";
import {
  ASSESSMENT_NOT_INFORMED,
  assessmentConditionLabels,
  assessmentObjectiveLabel,
  assessmentSummaryIntegrityIssues,
  assessmentSummaryMissingInformation,
  assessmentSummarySourceDates,
  bilateralDifferenceSentence,
  calculateBilateralDifferences,
  calculateRatio,
  classifyAdultBmi,
  clinicalStepLabels,
  formatClinicalNumber,
  perimetryGroups,
  posturalSegmentsByView,
  type BioimpedanceAvanutriData,
  type ClinicalCollectionStepKey,
  type ClinicalCollectionView,
} from "@/features/clinical-collection";
import { safeClinicalTexts } from "@/features/clinical-collection/clinical-text-safety";

import { CompletionBadge } from "./completion-badge";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ResponsiveActionBar } from "./responsive-action-bar";
import { SectionCard } from "./section-card";

const steps = [
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
] as const;
const recordKey = {
  ANTHROPOMETRY: "anthropometry",
  BIOIMPEDANCE: "bioimpedance",
  PERIMETRY: "perimetry",
  POSTURAL_ASSESSMENT: "posturalAssessment",
} as const;
const sexLabels = {
  FEMALE: "feminino",
  MALE: "masculino",
  INTERSEX: "intersexo",
  NOT_INFORMED: "não informado",
} as const;

const compositionMetrics: readonly {
  key: keyof BioimpedanceAvanutriData;
  label: string;
  unit: string;
}[] = [
  { key: "bodyFatPercent", label: "Percentual de gordura", unit: "%" },
  { key: "fatMassKg", label: "Massa de gordura", unit: "kg" },
  { key: "fatFreeMassKg", label: "Massa livre de gordura", unit: "kg" },
  {
    key: "skeletalMuscleMassKg",
    label: "Massa muscular esquelética",
    unit: "kg",
  },
  { key: "proteinKg", label: "Proteína", unit: "kg" },
  { key: "mineralsKg", label: "Minerais", unit: "kg" },
  { key: "totalBodyWaterL", label: "Água corporal total", unit: "L" },
  { key: "intracellularWaterL", label: "Água intracelular", unit: "L" },
  { key: "extracellularWaterL", label: "Água extracelular", unit: "L" },
  { key: "visceralFatLevel", label: "Gordura visceral", unit: "nível" },
  {
    key: "basalMetabolicRateKcal",
    label: "Taxa metabólica basal",
    unit: "kcal/dia",
  },
  { key: "appendicularIndex", label: "Índice apendicular", unit: "kg/m²" },
  { key: "metabolicAgeYears", label: "Idade metabólica", unit: "anos" },
  { key: "leanRightArmKg", label: "Massa magra · braço direito", unit: "kg" },
  { key: "leanLeftArmKg", label: "Massa magra · braço esquerdo", unit: "kg" },
  { key: "leanTrunkKg", label: "Massa magra · tronco", unit: "kg" },
  { key: "leanRightLegKg", label: "Massa magra · perna direita", unit: "kg" },
  { key: "leanLeftLegKg", label: "Massa magra · perna esquerda", unit: "kg" },
  { key: "fatRightArmKg", label: "Gordura · braço direito", unit: "kg" },
  { key: "fatLeftArmKg", label: "Gordura · braço esquerdo", unit: "kg" },
  { key: "fatTrunkKg", label: "Gordura · tronco", unit: "kg" },
  { key: "fatRightLegKg", label: "Gordura · perna direita", unit: "kg" },
  { key: "fatLeftLegKg", label: "Gordura · perna esquerda", unit: "kg" },
];

const perimetryMetrics = perimetryGroups.flatMap((group) =>
  group.fields.map((field) => ({
    key: field.key,
    label: field.label,
  })),
);

function isMeasurement(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function displayText(value: string | null | undefined) {
  return value?.trim() || ASSESSMENT_NOT_INFORMED;
}

function formatDate(value: string | undefined) {
  if (!value) return ASSESSMENT_NOT_INFORMED;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ASSESSMENT_NOT_INFORMED
    : new Intl.DateTimeFormat("pt-BR").format(date);
}

function TextList({ items }: { items: readonly string[] }) {
  const available = safeClinicalTexts(items);
  return available.length ? (
    <ul className="space-y-1.5">
      {available.map((item, index) => (
        <li className="text-sm leading-6 text-slate-700" key={`${item}-${index}`}>
          {item}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-slate-500">{ASSESSMENT_NOT_INFORMED}</p>
  );
}

function SummaryDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold leading-6 text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function MetricList({
  items,
}: {
  items: readonly { label: string; value: number; unit: string }[];
}) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div
          className="flex min-h-11 items-center justify-between gap-4 py-2.5"
          key={item.label}
        >
          <dt className="text-sm text-slate-600">{item.label}</dt>
          <dd className="text-right text-sm font-black text-slate-900">
            {formatClinicalNumber(item.value)}{" "}
            <span className="font-semibold text-slate-400">{item.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CollectionSummary({
  collection,
  completing,
  canComplete,
  canContinueToNutrition,
  onComplete,
  onCorrect,
}: {
  collection: ClinicalCollectionView;
  completing: boolean;
  canComplete: boolean;
  canContinueToNutrition: boolean;
  onComplete: () => Promise<void>;
  onCorrect: (step: ClinicalCollectionStepKey) => void;
}) {
  const { anthropometry, bioimpedance, perimetry, posturalAssessment } =
    collection.records;
  const pending = steps.filter(
    (step) =>
      step !== "POSTURAL_ASSESSMENT" &&
      collection.records[recordKey[step]].status !== "COMPLETED",
  );
  const incompleteRequiredFields = pending.flatMap((step) =>
    collection.records[recordKey[step]].missingRequiredFields.map(
      (field) => `${clinicalStepLabels[step]}: ${field}`,
    ),
  );
  const bmiClassification = classifyAdultBmi(
    anthropometry.data.bmi,
    collection.patientAge,
  );
  const sourceDates = assessmentSummarySourceDates(collection);
  const missingInformation = assessmentSummaryMissingInformation(collection);
  const integrityIssues = assessmentSummaryIntegrityIssues(collection);
  const anamnesis = collection.anamnesis?.data;
  const composition = compositionMetrics.flatMap((metric) => {
    const value = bioimpedance.data[metric.key];
    return isMeasurement(value)
      ? [{ label: metric.label, value, unit: metric.unit }]
      : [];
  });
  const perimetryValues = perimetryMetrics.flatMap((metric) => {
    const value = perimetry.data[metric.key] as number | undefined;
    return isMeasurement(value)
      ? [{ label: metric.label, value, unit: "cm" }]
      : [];
  });
  const bilateralDifferences = calculateBilateralDifferences(perimetry.data);
  const waistHipRatio = calculateRatio(
    perimetry.data.waistCm,
    perimetry.data.hipCm,
  );
  const waistHeightRatio = calculateRatio(
    perimetry.data.waistCm,
    anthropometry.data.heightCm,
  );
  const posturalViews = [
    ["ANTERIOR", "Vista anterior"],
    ["POSTERIOR", "Vista posterior"],
    ["RIGHT_LATERAL", "Vista lateral direita"],
    ["LEFT_LATERAL", "Vista lateral esquerda"],
  ] as const;
  const posturalFindings = posturalViews.flatMap(([key, label]) => {
    const view = posturalAssessment.data.views[key];
    if (view.state !== "FINDING_RECORDED") return [];
    const segmentFindings = posturalSegmentsByView[key].flatMap((segment) => {
      const finding = view.segments?.[segment.key];
      const detail = [finding?.selectedOption, finding?.observation]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
      return detail.length
        ? [`${label} · ${segment.name}: ${detail.join(" — ")}`]
        : [];
    });
    return [
      ...segmentFindings,
      ...(view.observation?.trim()
        ? [`${label} · observação geral: ${view.observation.trim()}`]
        : []),
    ];
  });
  const medicationItems =
    anamnesis?.medications.map((item) =>
      [item.name, item.dose, item.frequency, item.reason]
        .filter(Boolean)
        .join(" · "),
    ) ?? [];
  const supplementItems =
    anamnesis?.supplements.map((item) =>
      [item.name, item.dose, item.frequency]
        .filter(Boolean)
        .join(" · "),
    ) ?? [];
  const surgeryItems =
    anamnesis?.surgeries.map((item) =>
      [item.procedure, item.date, item.notes].filter(Boolean).join(" · "),
    ) ?? [];
  const injuryItems =
    anamnesis?.injuries.map((item) =>
      [item.region, item.date, item.situation, item.notes]
        .filter(Boolean)
        .join(" · "),
    ) ?? [];
  const professional = collection.connectedProfessional;
  const professionalValue = professional
    ? [professional.professionalName]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" · ") || ASSESSMENT_NOT_INFORMED
    : ASSESSMENT_NOT_INFORMED;

  return (
    <div className="space-y-4">
      {collection.completed ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
          role="status"
        >
          <CheckIcon className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black">Avaliação concluída</p>
            <p className="mt-1 text-xs">
              Os dados permanecem vinculados ao mesmo Prontuário Mestre.
            </p>
          </div>
        </div>
      ) : null}

      <PendingFieldsAlert fields={incompleteRequiredFields} />

      {posturalAssessment.status !== "COMPLETED" ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
          role="status"
        >
          <p className="text-sm font-black">Avaliação Postural pendente</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            O módulo continua disponível para preenchimento completo, mas esta
            pendência não bloqueia a continuidade do atendimento nutricional.
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius-large)] border border-[#cfe1d9] bg-white shadow-[var(--shadow-subtle)]">
        <div className="bg-[#103f32] px-5 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Visão geral da avaliação
              </p>
              <h2 className="mt-1 text-xl font-black">
                {collection.patientName}
              </h2>
              <p className="mt-1 text-sm font-semibold text-emerald-100">
                {collection.patientCode}
              </p>
            </div>
            <time className="text-xs font-semibold text-emerald-100">
              Atendimento em {formatDate(collection.attendanceStartedAt)}
            </time>
          </div>
        </div>
        <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          <SummaryDatum
            label="Idade"
            value={
              collection.patientAge !== undefined
                ? `${collection.patientAge} anos`
                : ASSESSMENT_NOT_INFORMED
            }
          />
          <SummaryDatum
            label="Sexo cadastrado"
            value={
              collection.patientSex
                ? sexLabels[collection.patientSex]
                : ASSESSMENT_NOT_INFORMED
            }
          />
          <SummaryDatum
            label="Profissão"
            value={displayText(collection.patientProfession)}
          />
          <SummaryDatum
            label="Telefone"
            value={displayText(collection.patientPhone)}
          />
          <SummaryDatum label="Profissional responsável" value={professionalValue} />
          {collection.patientCode.trim() ? (
            <SummaryDatum label="Código clínico" value={collection.patientCode} />
          ) : null}
        </dl>
      </section>

      <SectionCard
        description="Dados do registro de Anamnese vinculado a este atendimento."
        title="Anamnese clínica"
      >
        <dl className="grid gap-5 sm:grid-cols-2">
          <SummaryDatum
            label="Objetivo principal"
            value={
              anamnesis
                ? assessmentObjectiveLabel(anamnesis.primaryObjective)
                : ASSESSMENT_NOT_INFORMED
            }
          />
          <SummaryDatum
            label="Queixa principal"
            value={displayText(anamnesis?.chiefComplaint)}
          />
          <SummaryDatum
            label="Objetivos secundários"
            value={
              anamnesis?.secondaryObjectives.length
                ? anamnesis.secondaryObjectives
                    .map((objective) => assessmentObjectiveLabel(objective))
                    .join(", ")
                : ASSESSMENT_NOT_INFORMED
            }
          />
          <SummaryDatum
            label="Situação atual"
            value={displayText(anamnesis?.currentIllness.currentSituation)}
          />
          <SummaryDatum
            label="Restrições e intolerâncias"
            value={displayText(anamnesis?.nutrition.restrictions)}
          />
        </dl>
        <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Diagnósticos e patologias</h3>
            <div className="mt-2"><TextList items={assessmentConditionLabels(collection)} /></div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Alergias registradas</h3>
            <div className="mt-2"><TextList items={anamnesis?.allergies ?? []} /></div>
          </div>
          <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Medicamentos</h3><div className="mt-2"><TextList items={medicationItems} /></div></div>
          <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Suplementos</h3><div className="mt-2"><TextList items={supplementItems} /></div></div>
          <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Cirurgias</h3><div className="mt-2"><TextList items={surgeryItems} /></div></div>
          <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Lesões e limitações</h3><div className="mt-2"><TextList items={injuryItems} /></div></div>
        </div>
      </SectionCard>

      <SectionCard title="Antropometria">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryDatum label="Peso" value={isMeasurement(anthropometry.data.weightKg) ? `${formatClinicalNumber(anthropometry.data.weightKg)} kg` : ASSESSMENT_NOT_INFORMED} />
          <SummaryDatum label="Altura" value={isMeasurement(anthropometry.data.heightCm) ? `${formatClinicalNumber(anthropometry.data.heightCm / 100, 2, 2)} m` : ASSESSMENT_NOT_INFORMED} />
          <SummaryDatum label="IMC" value={isMeasurement(anthropometry.data.bmi) ? `${formatClinicalNumber(anthropometry.data.bmi, 2, 2)} kg/m²` : ASSESSMENT_NOT_INFORMED} />
          <SummaryDatum label="Classificação existente" value={bmiClassification ?? ASSESSMENT_NOT_INFORMED} />
        </dl>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          description="Somente valores efetivamente registrados pelo equipamento."
          title="Composição corporal"
        >
          {composition.length ? (
            <MetricList items={composition} />
          ) : (
            <p className="text-sm text-slate-500">
              {ASSESSMENT_NOT_INFORMED}
            </p>
          )}
        </SectionCard>

        <SectionCard
          description="Medidas registradas e variações bilaterais mensuradas, sem inferência de causa."
          title="Perimetria e assimetrias"
        >
          {perimetryValues.length ? (
            <MetricList items={perimetryValues} />
          ) : (
            <p className="text-sm text-slate-500">
              {ASSESSMENT_NOT_INFORMED}
            </p>
          )}
          {bilateralDifferences.length ? (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {bilateralDifferences.map((comparison) => (
                <li
                  className="text-sm leading-6 text-slate-700"
                  key={comparison.label}
                >
                  {bilateralDifferenceSentence(comparison)}
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        description="Relações matemáticas apresentadas sem classificação automática de risco."
        title="Indicadores antropométricos"
      >
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Relação cintura/quadril
            </dt>
            <dd className="mt-1 text-sm font-black text-slate-900">
              {waistHipRatio !== undefined
                ? formatClinicalNumber(waistHipRatio, 2, 2)
                : ASSESSMENT_NOT_INFORMED}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Relação cintura/estatura
            </dt>
            <dd className="mt-1 text-sm font-black text-slate-900">
              {waistHeightRatio !== undefined
                ? formatClinicalNumber(waistHeightRatio, 2, 2)
                : ASSESSMENT_NOT_INFORMED}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Avaliação Postural">
        <TextList items={posturalFindings} />
        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <SummaryDatum label="Resumo técnico registrado" value={displayText(posturalAssessment.data.technicalSummary?.editedSummary ?? posturalAssessment.data.technicalSummary?.generatedOriginal)} />
          <SummaryDatum label="Conclusão do avaliador" value={displayText(posturalAssessment.data.evaluatorConclusion)} />
        </dl>
      </SectionCard>

      <SectionCard title="Observações clínicas registradas">
        <TextList
          items={[
            anamnesis?.generalNotes ?? "",
            anthropometry.data.notes ?? "",
            perimetry.data.notes ?? "",
            posturalAssessment.data.notes ?? "",
            posturalAssessment.data.identifiedChangesNotes ?? "",
            posturalAssessment.data.functionalLimitationsNotes ?? "",
            posturalAssessment.data.futureCorrectiveExercisesNote ?? "",
            posturalAssessment.data.followUp?.observation ?? "",
          ]}
        />
      </SectionCard>

      <SectionCard title="Datas das fontes consolidadas">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sourceDates.map((source) => (
            <SummaryDatum key={source.label} label={source.label} value={formatDate(source.value)} />
          ))}
        </dl>
      </SectionCard>

      {integrityIssues.length ? (
        <SectionCard title="Alertas para revisão profissional">
          <TextList items={integrityIssues} />
        </SectionCard>
      ) : null}

      {missingInformation.length ? (
        <SectionCard title="Dados não disponíveis">
          <TextList items={missingInformation} />
        </SectionCard>
      ) : null}

      <SectionCard title="Completude das etapas">
        <div className="flex flex-wrap gap-2">
          {steps.map((step) => {
            const record = collection.records[recordKey[step]];
            return (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-left transition hover:border-[#9fc5b6]"
                key={step}
                onClick={() => onCorrect(step)}
                type="button"
              >
                <span className="text-xs font-black text-slate-700">
                  {clinicalStepLabels[step]}
                </span>
                <CompletionBadge
                  required={step === "POSTURAL_ASSESSMENT"}
                  status={record.status}
                />
                {step === "POSTURAL_ASSESSMENT" &&
                record.status !== "COMPLETED" ? (
                  <span className="text-[10px] font-bold text-amber-700">
                    não bloqueia Nutrição
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <ResponsiveActionBar>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          onClick={() => onCorrect("POSTURAL_ASSESSMENT")}
          type="button"
        >
          Voltar para Avaliação Postural
        </button>
        {canContinueToNutrition || !collection.completed ? (
          <button
            className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={
              completing ||
              (!collection.completed &&
                (!collection.nutritionFlowReady || !canComplete))
            }
            onClick={onComplete}
            type="button"
          >
            {completing
              ? "Salvando..."
              : canContinueToNutrition
                ? "Salvar e continuar"
                : "Confirmar resumo"}
          </button>
        ) : null}
      </ResponsiveActionBar>
    </div>
  );
}
