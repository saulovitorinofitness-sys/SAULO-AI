import type { PerimetryData } from "./contracts";

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
