import {
  additionalDiagnoses,
  clinicalHistoryOptions,
  getPathologySexCompatibility,
  objectiveOptions,
} from "@/features/clinical-anamnesis";

import type { ClinicalCollectionView, PerimetryData } from "./contracts";

export interface BilateralDifference {
  readonly label: string;
  readonly rightCm: number;
  readonly leftCm: number;
  readonly differenceCm: number;
  readonly percentageDifference: number;
  readonly largerSide: "RIGHT" | "LEFT" | "EQUAL";
  readonly feminine: boolean;
}

const bilateralPairs = [
  {
    label: "Braço",
    feminine: false,
    rightKey: "rightArmCm",
    leftKey: "leftArmCm",
  },
  {
    label: "Antebraço",
    feminine: false,
    rightKey: "rightForearmCm",
    leftKey: "leftForearmCm",
  },
  {
    label: "Coxa",
    feminine: true,
    rightKey: "rightThighCm",
    leftKey: "leftThighCm",
  },
  {
    label: "Panturrilha",
    feminine: true,
    rightKey: "rightCalfCm",
    leftKey: "leftCalfCm",
  },
] as const satisfies readonly {
  label: string;
  feminine: boolean;
  rightKey: keyof PerimetryData;
  leftKey: keyof PerimetryData;
}[];

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function round(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function classifyAdultBmi(
  bmi: number | undefined,
  age: number | undefined,
) {
  if (!positiveNumber(bmi) || age === undefined || age < 18) return undefined;
  if (bmi < 18.5) return "baixo peso";
  if (bmi < 25) return "faixa de peso normal";
  if (bmi < 30) return "sobrepeso";
  if (bmi < 35) return "obesidade grau I";
  if (bmi < 40) return "obesidade grau II";
  return "obesidade grau III";
}

export function calculateRatio(
  numerator: number | undefined,
  denominator: number | undefined,
) {
  if (!positiveNumber(numerator) || !positiveNumber(denominator)) {
    return undefined;
  }

  return round(numerator / denominator, 2);
}

export function calculateBilateralDifferences(
  data: PerimetryData,
): readonly BilateralDifference[] {
  return bilateralPairs.flatMap((pair) => {
    const rightCm = data[pair.rightKey];
    const leftCm = data[pair.leftKey];

    if (!positiveNumber(rightCm) || !positiveNumber(leftCm)) return [];

    const differenceCm = round(Math.abs(rightCm - leftCm), 2);
    const bilateralMean = (rightCm + leftCm) / 2;

    return [
      {
        label: pair.label,
        rightCm,
        leftCm,
        differenceCm,
        percentageDifference: round(
          (differenceCm / bilateralMean) * 100,
          1,
        ),
        feminine: pair.feminine,
        largerSide:
          rightCm === leftCm
            ? "EQUAL"
            : rightCm > leftCm
              ? "RIGHT"
              : "LEFT",
      },
    ];
  });
}

export function formatClinicalNumber(
  value: number,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: false,
  }).format(value);
}

export function bilateralDifferenceSentence(
  comparison: BilateralDifference,
) {
  if (comparison.largerSide === "EQUAL") {
    return `${comparison.label}: sem diferença bilateral mensurada.`;
  }

  const right = comparison.feminine ? "direita" : "direito";
  const left = comparison.feminine ? "esquerda" : "esquerdo";
  const larger = comparison.largerSide === "RIGHT" ? right : left;
  const smaller = comparison.largerSide === "RIGHT" ? left : right;

  return `${comparison.label} ${larger} ${formatClinicalNumber(comparison.differenceCm)} cm maior que ${comparison.feminine ? "a" : "o"} ${smaller} (${formatClinicalNumber(comparison.percentageDifference, 1, 1)}% em relação à média bilateral).`;
}

export const ASSESSMENT_NOT_INFORMED = "Não informado";

const objectiveLabels = new Map(objectiveOptions);
const clinicalHistoryLabels = new Map(clinicalHistoryOptions);

export function assessmentObjectiveLabel(
  objective: string | undefined,
) {
  return objective
    ? objectiveLabels.get(
        objective as (typeof objectiveOptions)[number][0],
      ) ?? objective
    : ASSESSMENT_NOT_INFORMED;
}

export function assessmentConditionLabels(
  collection: ClinicalCollectionView,
) {
  const anamnesis = collection.anamnesis?.data;
  if (!anamnesis) return [];

  return [
    ...anamnesis.clinicalHistory.map(
      (condition) => clinicalHistoryLabels.get(condition) ?? condition,
    ),
    ...additionalDiagnoses(anamnesis.clinicalHistoryNotes),
  ];
}

export interface AssessmentSummarySourceDate {
  readonly key:
    | "ATTENDANCE"
    | "ANAMNESIS"
    | "ANTHROPOMETRY"
    | "PERIMETRY"
    | "BIOIMPEDANCE"
    | "POSTURAL_ASSESSMENT";
  readonly label: string;
  readonly value?: string;
}

export function assessmentSummarySourceDates(
  collection: ClinicalCollectionView,
): readonly AssessmentSummarySourceDate[] {
  return [
    {
      key: "ATTENDANCE",
      label: "Início do atendimento",
      value: collection.attendanceStartedAt,
    },
    {
      key: "ANAMNESIS",
      label: "Anamnese",
      value: collection.anamnesis?.occurredAt,
    },
    {
      key: "ANTHROPOMETRY",
      label: "Antropometria",
      value: collection.anthropometryMeasuredAt,
    },
    {
      key: "PERIMETRY",
      label: "Perimetria",
      value: collection.perimetryMeasuredAt,
    },
    {
      key: "BIOIMPEDANCE",
      label: "Bioimpedância",
      value: collection.bioimpedanceMeasuredAt,
    },
    {
      key: "POSTURAL_ASSESSMENT",
      label: "Avaliação Postural",
      value: collection.posturalAssessedAt,
    },
  ];
}

function hasPositiveMeasurement(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function assessmentSummaryMissingInformation(
  collection: ClinicalCollectionView,
) {
  const messages: string[] = [];
  const { anthropometry, bioimpedance, perimetry, posturalAssessment } =
    collection.records;
  const hasWeight = hasPositiveMeasurement(anthropometry.data.weightKg);
  const hasHeight = hasPositiveMeasurement(anthropometry.data.heightCm);
  const hasBmi = hasPositiveMeasurement(anthropometry.data.bmi);

  if (!collection.anamnesis) {
    messages.push("Anamnese não registrada neste atendimento.");
  }
  if (!hasBmi) {
    messages.push(
      !hasWeight && !hasHeight
        ? "Peso e altura não informados; IMC indisponível."
        : !hasWeight
          ? "Peso não informado; IMC indisponível."
          : "Altura não informada; IMC indisponível.",
    );
  }
  if (!hasPositiveMeasurement(perimetry.data.waistCm)) {
    messages.push(
      "Medida de cintura não informada; índices derivados indisponíveis.",
    );
  }
  if (!hasPositiveMeasurement(perimetry.data.hipCm)) {
    messages.push(
      "Medida de quadril não informada; relação cintura/quadril indisponível.",
    );
  }
  const hasBioimpedance = Object.entries(bioimpedance.data).some(
    ([key, value]) =>
      key !== "weightKg" && key !== "bmi" && hasPositiveMeasurement(value),
  );
  if (!hasBioimpedance) {
    messages.push("Bioimpedância não registrada neste atendimento.");
  }
  if (
    Object.values(posturalAssessment.data.views).every(
      (view) => view.state === "NOT_ASSESSED",
    )
  ) {
    messages.push("Avaliação Postural não registrada neste atendimento.");
  }
  if (!collection.connectedProfessional.professionalName.trim()) {
    messages.push("Profissional responsável não informado.");
  }

  return messages;
}

export function assessmentSummaryIntegrityIssues(
  collection: ClinicalCollectionView,
) {
  const issues: string[] = [];
  if (collection.summaryLoadIssue) issues.push(collection.summaryLoadIssue);

  if (
    collection.anamnesis &&
    (collection.anamnesis.attendanceId !== collection.attendanceId ||
      collection.anamnesis.masterRecordId !== collection.masterRecordId)
  ) {
    issues.push(
      "A Anamnese disponível não pertence ao atendimento atual e não foi consolidada.",
    );
  }

  for (const condition of assessmentConditionLabels(collection)) {
    const compatibility = getPathologySexCompatibility(
      condition,
      collection.patientSex ?? "NOT_INFORMED",
    );
    if (compatibility.status !== "COMPATIBLE" && compatibility.message) {
      issues.push(`Revisão profissional: ${compatibility.message}`);
    }
  }

  const sourceDates = assessmentSummarySourceDates(collection);
  const recordDateRequirements = [
    [
      collection.records.anthropometry.origin,
      sourceDates.find((source) => source.key === "ANTHROPOMETRY")?.value,
      "Antropometria",
    ],
    [
      collection.records.perimetry.origin,
      sourceDates.find((source) => source.key === "PERIMETRY")?.value,
      "Perimetria",
    ],
    [
      collection.records.bioimpedance.origin,
      sourceDates.find((source) => source.key === "BIOIMPEDANCE")?.value,
      "Bioimpedância",
    ],
    [
      collection.records.posturalAssessment.origin,
      sourceDates.find((source) => source.key === "POSTURAL_ASSESSMENT")
        ?.value,
      "Avaliação Postural",
    ],
  ] as const;

  for (const [origin, date, label] of recordDateRequirements) {
    if (origin && !date) {
      issues.push(`${label} sem data vinculada ao atendimento atual.`);
    }
    if (origin && origin.masterRecordId !== collection.masterRecordId) {
      issues.push(
        `${label} pertence a outro Prontuário Mestre e não deve ser utilizada.`,
      );
    }
  }

  return [...new Set(issues)];
}
