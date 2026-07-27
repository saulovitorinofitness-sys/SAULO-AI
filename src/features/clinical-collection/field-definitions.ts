import type { BioimpedanceAvanutriData, PerimetryData } from "./contracts";

export interface MeasurementDefinition<T> {
  readonly key: keyof T;
  readonly label: string;
  readonly unit: string;
  readonly required: boolean;
  readonly precision?: number;
}

export interface MeasurementGroup<T> {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly MeasurementDefinition<T>[];
}

export const bioimpedanceGroups: readonly MeasurementGroup<BioimpedanceAvanutriData>[] = [
  {
    key: "global", title: "Composição global", fields: [
      { key: "weightKg", label: "Peso", unit: "kg", required: false, precision: 1 },
      { key: "bodyFatPercent", label: "Percentual de gordura", unit: "%", required: false, precision: 1 },
      { key: "fatMassKg", label: "Massa de gordura", unit: "kg", required: false, precision: 1 },
      { key: "fatFreeMassKg", label: "Massa livre de gordura", unit: "kg", required: false, precision: 1 },
      { key: "skeletalMuscleMassKg", label: "Massa muscular esquelética", unit: "kg", required: false, precision: 1 },
      { key: "proteinKg", label: "Proteína", unit: "kg", required: false, precision: 1 },
      { key: "mineralsKg", label: "Minerais", unit: "kg", required: false, precision: 1 },
    ],
  },
  {
    key: "water", title: "Água corporal", fields: [
      { key: "totalBodyWaterL", label: "Água corporal total", unit: "L", required: false, precision: 1 },
      { key: "intracellularWaterL", label: "Água intracelular", unit: "L", required: false, precision: 1 },
      { key: "extracellularWaterL", label: "Água extracelular", unit: "L", required: false, precision: 1 },
    ],
  },
  {
    key: "metabolic", title: "Dados metabólicos", fields: [
      { key: "bmi", label: "IMC", unit: "kg/m²", required: false, precision: 2 },
      { key: "visceralFatLevel", label: "Nível de gordura visceral", unit: "nível", required: false },
      { key: "basalMetabolicRateKcal", label: "Taxa metabólica basal", unit: "kcal", required: false },
      { key: "appendicularIndex", label: "Índice apendicular", unit: "kg/m²", required: false, precision: 1 },
      { key: "metabolicAgeYears", label: "Idade metabólica", unit: "anos", required: false },
    ],
  },
  {
    key: "segmental-lean", title: "Massa magra segmentar", fields: [
      { key: "leanRightArmKg", label: "Braço direito", unit: "kg", required: false, precision: 1 },
      { key: "leanLeftArmKg", label: "Braço esquerdo", unit: "kg", required: false, precision: 1 },
      { key: "leanTrunkKg", label: "Tronco", unit: "kg", required: false, precision: 1 },
      { key: "leanRightLegKg", label: "Perna direita", unit: "kg", required: false, precision: 1 },
      { key: "leanLeftLegKg", label: "Perna esquerda", unit: "kg", required: false, precision: 1 },
    ],
  },
  {
    key: "segmental-fat", title: "Gordura segmentar", fields: [
      { key: "fatRightArmKg", label: "Braço direito", unit: "kg", required: false, precision: 1 },
      { key: "fatLeftArmKg", label: "Braço esquerdo", unit: "kg", required: false, precision: 1 },
      { key: "fatTrunkKg", label: "Tronco", unit: "kg", required: false, precision: 1 },
      { key: "fatRightLegKg", label: "Perna direita", unit: "kg", required: false, precision: 1 },
      { key: "fatLeftLegKg", label: "Perna esquerda", unit: "kg", required: false, precision: 1 },
    ],
  },
];

export const perimetryGroups: readonly MeasurementGroup<PerimetryData>[] = [
  { key: "upper", title: "Região superior", fields: [
    { key: "neckCm", label: "Pescoço", unit: "cm", required: false, precision: 1 },
    { key: "shouldersCm", label: "Ombros", unit: "cm", required: false, precision: 1 },
    { key: "chestCm", label: "Tórax", unit: "cm", required: false, precision: 1 },
  ] },
  { key: "trunk", title: "Tronco", fields: [
    { key: "waistCm", label: "Cintura", unit: "cm", required: false, precision: 1 },
    { key: "abdomenCm", label: "Abdômen", unit: "cm", required: false, precision: 1 },
    { key: "hipCm", label: "Quadril", unit: "cm", required: false, precision: 1 },
  ] },
  { key: "arms", title: "Membros superiores", fields: [
    { key: "rightArmCm", label: "Braço direito", unit: "cm", required: false, precision: 1 },
    { key: "leftArmCm", label: "Braço esquerdo", unit: "cm", required: false, precision: 1 },
    { key: "rightForearmCm", label: "Antebraço direito", unit: "cm", required: false, precision: 1 },
    { key: "leftForearmCm", label: "Antebraço esquerdo", unit: "cm", required: false, precision: 1 },
  ] },
  { key: "legs", title: "Membros inferiores", fields: [
    { key: "rightThighCm", label: "Coxa direita", unit: "cm", required: false, precision: 1 },
    { key: "leftThighCm", label: "Coxa esquerda", unit: "cm", required: false, precision: 1 },
    { key: "rightCalfCm", label: "Panturrilha direita", unit: "cm", required: false, precision: 1 },
    { key: "leftCalfCm", label: "Panturrilha esquerda", unit: "cm", required: false, precision: 1 },
  ] },
];

export const clinicalStepLabels = {
  ANTHROPOMETRY: "Antropometria",
  BIOIMPEDANCE: "Bioimpedância",
  PERIMETRY: "Perimetria",
  POSTURAL_ASSESSMENT: "Avaliação Postural",
  SUMMARY: "Resumo",
} as const;
