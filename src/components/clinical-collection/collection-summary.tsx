import Link from "next/link";

import { CheckIcon } from "@/components/ui/icons";
import {
  bilateralDifferenceSentence,
  bioimpedanceGroups,
  calculateBilateralDifferences,
  calculateRatio,
  classifyAdultBmi,
  clinicalStepLabels,
  formatClinicalNumber,
  perimetryGroups,
  type BioimpedanceAvanutriData,
  type ClinicalCollectionStepKey,
  type ClinicalCollectionView,
} from "@/features/clinical-collection";
import { nutritionClinicalFlowHref } from "@/features/nutrition-clinical-flow";

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

function evaluationDate(collection: ClinicalCollectionView) {
  const dates = steps
    .map((step) => collection.records[recordKey[step]].audit?.updatedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  return dates[0];
}

function overviewSentence(
  collection: ClinicalCollectionView,
  bmiClassification: string | undefined,
) {
  const anthropometry = collection.records.anthropometry.data;
  const identification = [
    collection.patientAge !== undefined
      ? `${collection.patientAge} anos`
      : undefined,
    collection.patientSex
      ? `sexo ${sexLabels[collection.patientSex]}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  const measurements = [
    isMeasurement(anthropometry.weightKg)
      ? `${formatClinicalNumber(anthropometry.weightKg)} kg`
      : undefined,
    isMeasurement(anthropometry.heightCm)
      ? `${formatClinicalNumber(anthropometry.heightCm / 100, 2, 2)} m`
      : undefined,
    isMeasurement(anthropometry.bmi)
      ? `IMC de ${formatClinicalNumber(anthropometry.bmi, 2, 2)} kg/m²`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  const parts = [
    `Paciente ${collection.patientName} (${collection.patientCode})`,
    ...identification,
  ];

  let sentence = parts.join(", ");
  if (measurements.length) {
    const last = measurements.at(-1);
    sentence += `, com ${measurements.slice(0, -1).join(", ")}${measurements.length > 1 ? " e " : ""}${last}`;
  }
  if (bmiClassification) {
    sentence += `, em faixa compatível com ${bmiClassification}`;
  }

  return `${sentence}.`;
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
  onComplete,
  onCorrect,
}: {
  collection: ClinicalCollectionView;
  completing: boolean;
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
  const missing = pending.flatMap((step) =>
    collection.records[recordKey[step]].missingRequiredFields.map(
      (field) => `${clinicalStepLabels[step]}: ${field}`,
    ),
  );
  const bmiClassification = classifyAdultBmi(
    anthropometry.data.bmi,
    collection.patientAge,
  );
  const assessedAt = evaluationDate(collection);
  const composition = compositionMetrics.flatMap((metric) => {
    const value = bioimpedance.data[metric.key];
    return isMeasurement(value)
      ? [{ label: metric.label, value, unit: metric.unit }]
      : [];
  });
  const totalBioimpedanceFields = bioimpedanceGroups
    .flatMap((group) => group.fields)
    .filter((field) => field.key !== "weightKg" && field.key !== "bmi").length;
  const bioimpedanceStatus =
    composition.length === 0
      ? "Bioimpedância não realizada."
      : composition.length < totalBioimpedanceFields
        ? "Bioimpedância parcialmente preenchida."
        : "Bioimpedância completa.";
  const perimetryValues = perimetryMetrics.flatMap((metric) => {
    const value = perimetry.data[metric.key] as number | undefined;
    return isMeasurement(value)
      ? [{ label: metric.label, value, unit: "cm" }]
      : [];
  });
  const perimetryStatus =
    perimetryValues.length === 0
      ? "Perimetria não realizada neste atendimento."
      : perimetryValues.length < perimetryMetrics.length
        ? "Perimetria parcial."
        : "Perimetria completa.";
  const bilateralDifferences = calculateBilateralDifferences(perimetry.data);
  const measuredAsymmetries = bilateralDifferences.filter(
    (comparison) => comparison.differenceCm > 0,
  );
  const waistHipRatio = calculateRatio(
    perimetry.data.waistCm,
    perimetry.data.hipCm,
  );
  const waistHeightRatio = calculateRatio(
    perimetry.data.waistCm,
    anthropometry.data.heightCm,
  );
  const mainFindings = [
    bmiClassification && isMeasurement(anthropometry.data.bmi)
      ? `IMC de ${formatClinicalNumber(anthropometry.data.bmi, 2, 2)} kg/m² em faixa compatível com ${bmiClassification}.`
      : undefined,
    isMeasurement(bioimpedance.data.bodyFatPercent)
      ? `Percentual de gordura informado pelo equipamento: ${formatClinicalNumber(bioimpedance.data.bodyFatPercent)}%.`
      : undefined,
    ...measuredAsymmetries.map(bilateralDifferenceSentence),
    bioimpedanceStatus,
    perimetryStatus,
  ].filter((value): value is string => Boolean(value));
  const posturalViews = [
    ["ANTERIOR", "Vista anterior"],
    ["POSTERIOR", "Vista posterior"],
    ["RIGHT_LATERAL", "Vista lateral direita"],
    ["LEFT_LATERAL", "Vista lateral esquerda"],
  ] as const;
  const posturalFindings = posturalViews.flatMap(([key, label]) => {
    const view = posturalAssessment.data.views[key];
    return view.state === "FINDING_RECORDED" && view.observation?.trim()
      ? [`${label}: ${view.observation.trim()}`]
      : [];
  });
  const missingInformation = [
    bioimpedanceStatus !== "Bioimpedância completa."
      ? bioimpedanceStatus
      : undefined,
    perimetryStatus !== "Perimetria completa." ? perimetryStatus : undefined,
    waistHipRatio === undefined
      ? "Dados insuficientes para cálculo da relação cintura/quadril."
      : undefined,
    waistHeightRatio === undefined
      ? "Dados insuficientes para cálculo da relação cintura/estatura."
      : undefined,
    posturalAssessment.data.views &&
    Object.values(posturalAssessment.data.views).every(
      (view) => view.state === "NOT_ASSESSED",
    )
      ? "Avaliação postural não realizada."
      : undefined,
  ].filter((value): value is string => Boolean(value));

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

      <PendingFieldsAlert fields={missing} />

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
            {assessedAt ? (
              <time
                className="text-xs font-semibold text-emerald-100"
                dateTime={assessedAt.toISOString()}
              >
                Avaliação em{" "}
                {new Intl.DateTimeFormat("pt-BR").format(assessedAt)}
              </time>
            ) : null}
          </div>
        </div>
        <p className="px-5 py-5 text-sm leading-7 text-slate-700 sm:px-6">
          {overviewSentence(collection, bmiClassification)}
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          description="Somente valores efetivamente registrados pelo equipamento."
          title="Composição corporal"
        >
          {composition.length ? (
            <MetricList items={composition} />
          ) : (
            <p className="text-sm text-slate-500">
              Bioimpedância não realizada.
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
              Perimetria não realizada neste atendimento.
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
                : "Dados insuficientes"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Relação cintura/estatura
            </dt>
            <dd className="mt-1 text-sm font-black text-slate-900">
              {waistHeightRatio !== undefined
                ? formatClinicalNumber(waistHeightRatio, 2, 2)
                : "Dados insuficientes"}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {posturalFindings.length ? (
        <SectionCard title="Achados posturais registrados">
          <ul className="space-y-2">
            {posturalFindings.map((finding) => (
              <li className="text-sm leading-6 text-slate-700" key={finding}>
                {finding}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="Principais achados da avaliação">
        <ul className="space-y-2">
          {mainFindings.map((finding) => (
            <li
              className="flex gap-2 text-sm leading-6 text-slate-700"
              key={finding}
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-[#3b9b7d]"
              />
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      {missingInformation.length ? (
        <SectionCard title="Dados não disponíveis">
          <ul className="space-y-2">
            {missingInformation.map((information) => (
              <li className="text-sm leading-6 text-slate-600" key={information}>
                {information}
              </li>
            ))}
          </ul>
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
        
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          href={`/pacientes/${collection.patientId}?scenario=${collection.scenario}`}
        >
          Voltar ao prontuário
        </Link>
        {collection.completed ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938]"
            href={nutritionClinicalFlowHref("NUTRITION_STRATEGY", {
              patientId: collection.patientId,
              attendanceId: collection.attendanceId,
              scenario: collection.scenario,
            })}
          >
            Continuar para Estratégia Nutricional
          </Link>
        ) : null}
        {!collection.completed ? (
          <button
            className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!collection.nutritionFlowReady || completing}
            onClick={onComplete}
            type="button"
          >
            {completing ? "Concluindo..." : "Concluir Avaliação e continuar"}
          </button>
        ) : null}
      </ResponsiveActionBar>
    </div>
  );
}
