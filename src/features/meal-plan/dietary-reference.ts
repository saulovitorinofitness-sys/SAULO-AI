import type { MealPlanFoodNutrients } from "./record";

export type DietaryReferenceSex = "FEMALE" | "MALE";
export type DietaryReferenceLifeStage = "UNKNOWN" | "NONE" | "PREGNANCY" | "LACTATION";
export type DietaryReferenceType = "RDA" | "AI" | "CDRR";
export type DietaryReferenceScope =
  | "TOTAL_INTAKE"
  | "SUPPLEMENTS_AND_FORTIFIED_FOODS"
  | "SUPPLEMENTS_ONLY"
  | "PREFORMED_VITAMIN_A"
  | "SPECIFIC_FORM_NOT_DISTINGUISHED";

export type DietaryReferenceNutrient = Exclude<
  keyof MealPlanFoodNutrients,
  | "energyKcal"
  | "proteinGrams"
  | "carbohydratesGrams"
  | "fatsGrams"
  | "sugarsGrams"
  | "cholesterolMg"
  | "saturatedFatsGrams"
  | "transFatsGrams"
  | "monounsaturatedFatsGrams"
  | "polyunsaturatedFatsGrams"
>;

export interface DietaryReferenceProfile {
  readonly sex: DietaryReferenceSex;
  readonly ageYears: number;
  readonly ageAt: string;
  readonly birthDate: string;
  readonly lifeStage: DietaryReferenceLifeStage;
  readonly origin:
    | "MASTER_RECORD_AND_ATTENDANCE"
    | "PROFESSIONAL_CONFIRMATION"
    | "PROFESSIONAL_ADJUSTMENT";
  readonly adjustmentReason?: string;
  readonly adjustedByUserId?: string;
  readonly adjustedAt?: string;
}

const dietaryReferenceSexByCadastroValue: Readonly<Record<string, DietaryReferenceSex>> = {
  FEMALE: "FEMALE",
  FEMININO: "FEMALE",
  F: "FEMALE",
  MULHER: "FEMALE",
  MALE: "MALE",
  MASCULINO: "MALE",
  M: "MALE",
  HOMEM: "MALE",
};

/** Converte apenas valores explicitamente conhecidos do cadastro; não infere sexo. */
export function normalizeDietaryReferenceSex(value: unknown): DietaryReferenceSex | null {
  if (typeof value !== "string") return null;
  return dietaryReferenceSexByCadastroValue[value.trim().toLocaleUpperCase("pt-BR")] ?? null;
}

export function dietaryReferenceLifeStageFromProtocols(protocols: readonly string[] | null | undefined) {
  if (protocols?.includes("PREGNANCY")) return "PREGNANCY" as const;
  if (protocols?.includes("LACTATION")) return "LACTATION" as const;
  return "UNKNOWN" as const;
}

function calendarDateParts(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : br
      ? { year: Number(br[3]), month: Number(br[2]), day: Number(br[1]) }
      : null;
  if (parts) {
    const checked = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return checked.getUTCFullYear() === parts.year &&
      checked.getUTCMonth() === parts.month - 1 &&
      checked.getUTCDate() === parts.day
      ? parts
      : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? null
    : { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
}

function dietaryReferenceDateTime(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(new Date(value).valueOf())) return value;
  const parts = calendarDateParts(value);
  if (!parts) return value;
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T12:00:00.000Z`;
}

export function formatDietaryReferenceClinicalDate(value: string) {
  const parts = calendarDateParts(value);
  if (!parts) return "Data inválida";
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${String(parts.year).padStart(4, "0")}`;
}

export function deriveDietaryReferenceProfile(input: {
  readonly patientSex: unknown;
  readonly birthDate: string;
  readonly attendanceDate: string;
  readonly clinicalProtocols?: readonly string[] | null;
}): DietaryReferenceProfile | null {
  const sex = normalizeDietaryReferenceSex(input.patientSex);
  const ageYears = ageInCompletedYears(input.birthDate, input.attendanceDate);
  if (!sex || ageYears === null || ageYears < 1) return null;
  return {
    sex,
    ageYears,
    ageAt: dietaryReferenceDateTime(input.attendanceDate),
    birthDate: input.birthDate,
    lifeStage: dietaryReferenceLifeStageFromProtocols(input.clinicalProtocols),
    origin: "MASTER_RECORD_AND_ATTENDANCE",
  };
}

export interface DietaryReferenceValue {
  readonly nutrient: DietaryReferenceNutrient;
  readonly label: string;
  readonly unit: "g" | "mg" | "mcg RAE" | "mcg DFE" | "mcg";
  readonly referenceType: DietaryReferenceType;
  readonly referenceValue: number;
  readonly referenceRequiredForm?: "RAE" | "DFE";
  readonly ul?: number;
  readonly upperType?: "UL" | "CDRR";
  readonly ulScope?: DietaryReferenceScope;
  readonly ulComparison: "APPLICABLE" | "NOT_ESTABLISHED" | "NOT_DETERMINABLE";
  readonly ulRequiredForm?: "RETINOL" | "FOLIC_ACID";
  readonly note?: string;
  readonly source: {
    readonly organization: "NASEM / Health Canada";
    readonly edition: string;
    readonly url: string;
  };
}

export const DIETARY_REFERENCE_SOURCE = {
  organization: "NASEM / Health Canada",
  edition: "DRI reports 1997–2019; tabelas oficiais Health Canada atualizadas em 2025",
  url: "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html",
} as const;

const vitaminSource = {
  ...DIETARY_REFERENCE_SOURCE,
  url: "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html",
};
const elementSource = {
  ...DIETARY_REFERENCE_SOURCE,
  url: "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html",
};
const macroSource = {
  ...DIETARY_REFERENCE_SOURCE,
  url: "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html",
};

const editionByNutrient: Readonly<Record<DietaryReferenceNutrient, string>> = {
  fiberGrams: "NASEM DRI Macronutrients (2005)",
  calciumMg: "NASEM DRI Calcium and Vitamin D (2011)",
  ironMg: "IOM DRI Vitamin A, Vitamin K and Trace Elements (2001)",
  magnesiumMg: "IOM DRI Calcium, Phosphorus, Magnesium, Vitamin D and Fluoride (1997)",
  phosphorusMg: "IOM DRI Calcium, Phosphorus, Magnesium, Vitamin D and Fluoride (1997)",
  potassiumMg: "NASEM DRI Sodium and Potassium (2019)",
  sodiumMg: "NASEM DRI Sodium and Potassium (2019)",
  zincMg: "IOM DRI Vitamin A, Vitamin K and Trace Elements (2001)",
  copperMg: "IOM DRI Vitamin A, Vitamin K and Trace Elements (2001)",
  manganeseMg: "IOM DRI Vitamin A, Vitamin K and Trace Elements (2001)",
  seleniumMcg: "IOM DRI Vitamin C, Vitamin E, Selenium and Carotenoids (2000)",
  vitaminAMcg: "IOM DRI Vitamin A, Vitamin K and Trace Elements (2001)",
  vitaminCMg: "IOM DRI Vitamin C, Vitamin E, Selenium and Carotenoids (2000)",
  vitaminDMcg: "NASEM DRI Calcium and Vitamin D (2011)",
  vitaminEMg: "IOM DRI Vitamin C, Vitamin E, Selenium and Carotenoids (2000)",
  vitaminKMcg: "IOM DRI Vitamin A, Vitamin K and Trace Elements (2001)",
  thiamineMg: "IOM DRI Thiamin, Riboflavin, Niacin, Vitamin B6, Folate and Vitamin B12 (1998)",
  riboflavinMg: "IOM DRI Thiamin, Riboflavin, Niacin, Vitamin B6, Folate and Vitamin B12 (1998)",
  niacinMg: "IOM DRI Thiamin, Riboflavin, Niacin, Vitamin B6, Folate and Vitamin B12 (1998)",
  vitaminB6Mg: "IOM DRI Thiamin, Riboflavin, Niacin, Vitamin B6, Folate and Vitamin B12 (1998)",
  folateMcg: "IOM DRI Thiamin, Riboflavin, Niacin, Vitamin B6, Folate and Vitamin B12 (1998)",
  vitaminB12Mcg: "IOM DRI Thiamin, Riboflavin, Niacin, Vitamin B6, Folate and Vitamin B12 (1998)",
};

export function ageInCompletedYears(birthDate: string, atDate: string) {
  const birth = calendarDateParts(birthDate);
  const at = calendarDateParts(atDate);
  if (!birth || !at) return null;
  let age = at.year - birth.year;
  if (
    at.month < birth.month ||
    (at.month === birth.month && at.day < birth.day)
  ) age -= 1;
  return age < 0 ? null : age;
}

type Band = "1_3" | "4_8" | "9_13" | "14_18" | "19_30" | "31_50" | "51_70" | "71_PLUS";

export function dietaryReferenceAgeBand(ageYears: number): Band | null {
  if (!Number.isInteger(ageYears) || ageYears < 1) return null;
  if (ageYears <= 3) return "1_3";
  if (ageYears <= 8) return "4_8";
  if (ageYears <= 13) return "9_13";
  if (ageYears <= 18) return "14_18";
  if (ageYears <= 30) return "19_30";
  if (ageYears <= 50) return "31_50";
  if (ageYears <= 70) return "51_70";
  return "71_PLUS";
}

const byBand = (band: Band, values: readonly number[]) =>
  values[["1_3", "4_8", "9_13", "14_18", "19_30", "31_50", "51_70", "71_PLUS"].indexOf(band)];

function lifeStageValue(profile: DietaryReferenceProfile, ordinary: number, pregnancy: number, lactation: number) {
  if (profile.lifeStage === "PREGNANCY") return pregnancy;
  if (profile.lifeStage === "LACTATION") return lactation;
  return ordinary;
}

function row(input: Omit<DietaryReferenceValue, "source"> & { source?: DietaryReferenceValue["source"] }): DietaryReferenceValue {
  const source = input.source ?? elementSource;
  return {
    ...input,
    upperType: input.ul ? (input.upperType ?? "UL") : undefined,
    source: { ...source, edition: editionByNutrient[input.nutrient] },
  };
}

/**
 * DRI para indivíduos a partir de 1 ano. Gestação/lactação só são aceitas para
 * perfil feminino de 14 a 50 anos; fora disso o perfil é deliberadamente recusado.
 */
export function selectDietaryReferences(profile: DietaryReferenceProfile): readonly DietaryReferenceValue[] | null {
  const band = dietaryReferenceAgeBand(profile.ageYears);
  if (!band || profile.lifeStage === "UNKNOWN") return null;
  if (
    profile.lifeStage !== "NONE" &&
    (profile.sex !== "FEMALE" || profile.ageYears < 14 || profile.ageYears > 50)
  ) return null;

  const female = profile.sex === "FEMALE";
  const adult = profile.ageYears >= 19;
  const pregnant = profile.lifeStage === "PREGNANCY";
  const lactating = profile.lifeStage === "LACTATION";
  const stage = pregnant || lactating;
  const vitaminAUl = byBand(band, [600, 900, 1700, 2800, 3000, 3000, 3000, 3000]);
  const vitaminCUl = byBand(band, [400, 650, 1200, 1800, 2000, 2000, 2000, 2000]);
  const vitaminEUl = byBand(band, [200, 300, 600, 800, 1000, 1000, 1000, 1000]);
  const vitaminDUl = byBand(band, [63, 75, 100, 100, 100, 100, 100, 100]);
  const b6Ul = byBand(band, [30, 40, 60, 80, 100, 100, 100, 100]);
  const folateUl = byBand(band, [300, 400, 600, 800, 1000, 1000, 1000, 1000]);
  const calciumUl = byBand(band, [2500, 2500, 3000, 3000, 2500, 2500, 2000, 2000]);
  const ironUl = byBand(band, [40, 40, 40, 45, 45, 45, 45, 45]);
  const zincUl = byBand(band, [7, 12, 23, 34, 40, 40, 40, 40]);
  const copperUl = byBand(band, [1, 3, 5, 8, 10, 10, 10, 10]);
  const manganeseUl = byBand(band, [2, 3, 6, 9, 11, 11, 11, 11]);
  const seleniumUl = byBand(band, [90, 150, 280, 400, 400, 400, 400, 400]);
  const phosphorusUl = byBand(band, [3000, 3000, 4000, 4000, 4000, 4000, 4000, 3000]);

  const calcium = byBand(band, [700, 1000, 1300, 1300, 1000, 1000, female ? 1200 : 1000, 1200]);
  const iron = byBand(band, [7, 10, 8, female ? 15 : 11, female ? 18 : 8, female ? 18 : 8, 8, 8]);
  const magnesium = byBand(band, [80, 130, female ? 240 : 240, female ? 360 : 410, female ? 310 : 400, female ? 320 : 420, female ? 320 : 420, female ? 320 : 420]);
  const phosphorus = byBand(band, [460, 500, 1250, 1250, 700, 700, 700, 700]);
  const zinc = byBand(band, [3, 5, 8, female ? 9 : 11, female ? 8 : 11, female ? 8 : 11, female ? 8 : 11, female ? 8 : 11]);
  const copper = byBand(band, [0.34, 0.44, 0.7, 0.89, 0.9, 0.9, 0.9, 0.9]);
  const manganese = byBand(band, [1.2, 1.5, female ? 1.6 : 1.9, female ? 1.6 : 2.2, female ? 1.8 : 2.3, female ? 1.8 : 2.3, female ? 1.8 : 2.3, female ? 1.8 : 2.3]);
  const selenium = byBand(band, [20, 30, 40, 55, 55, 55, 55, 55]);
  const potassium = byBand(band, [2000, 2300, female ? 2300 : 2500, female ? 2300 : 3000, female ? 2600 : 3400, female ? 2600 : 3400, female ? 2600 : 3400, female ? 2600 : 3400]);
  const sodium = byBand(band, [800, 1000, 1200, 1500, 1500, 1500, 1500, 1500]);
  const fiber = byBand(band, [19, 25, female ? 26 : 31, female ? 26 : 38, female ? 25 : 38, female ? 25 : 38, female ? 21 : 30, female ? 21 : 30]);

  const vitaminA = byBand(band, [300, 400, 600, female ? 700 : 900, female ? 700 : 900, female ? 700 : 900, female ? 700 : 900, female ? 700 : 900]);
  const vitaminC = byBand(band, [15, 25, 45, female ? 65 : 75, female ? 75 : 90, female ? 75 : 90, female ? 75 : 90, female ? 75 : 90]);
  const vitaminD = profile.ageYears > 70 ? 20 : 15;
  const vitaminE = byBand(band, [6, 7, 11, 15, 15, 15, 15, 15]);
  const vitaminK = byBand(band, [30, 55, 60, 75, female ? 90 : 120, female ? 90 : 120, female ? 90 : 120, female ? 90 : 120]);
  const thiamine = byBand(band, [0.5, 0.6, 0.9, female ? 1 : 1.2, female ? 1.1 : 1.2, female ? 1.1 : 1.2, female ? 1.1 : 1.2, female ? 1.1 : 1.2]);
  const riboflavin = byBand(band, [0.5, 0.6, 0.9, female ? 1 : 1.3, female ? 1.1 : 1.3, female ? 1.1 : 1.3, female ? 1.1 : 1.3, female ? 1.1 : 1.3]);
  const niacin = byBand(band, [6, 8, 12, female ? 14 : 16, female ? 14 : 16, female ? 14 : 16, female ? 14 : 16, female ? 14 : 16]);
  const b6 = byBand(band, [0.5, 0.6, 1, female ? 1.2 : 1.3, 1.3, 1.3, female ? 1.5 : 1.7, female ? 1.5 : 1.7]);
  const folate = byBand(band, [150, 200, 300, 400, 400, 400, 400, 400]);
  const b12 = byBand(band, [0.9, 1.2, 1.8, 2.4, 2.4, 2.4, 2.4, 2.4]);

  return [
    row({ nutrient: "fiberGrams", label: "Fibra total", unit: "g", referenceType: "AI", referenceValue: lifeStageValue(profile, fiber, 28, 29), ulComparison: "NOT_ESTABLISHED", source: macroSource }),
    row({ nutrient: "calciumMg", label: "Cálcio", unit: "mg", referenceType: "RDA", referenceValue: stage ? (profile.ageYears <= 18 ? 1300 : 1000) : calcium, ul: calciumUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE" }),
    row({ nutrient: "ironMg", label: "Ferro", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, iron, 27, 9), ul: ironUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE" }),
    row({ nutrient: "magnesiumMg", label: "Magnésio", unit: "mg", referenceType: "RDA", referenceValue: stage ? (profile.ageYears <= 18 ? (pregnant ? 400 : 360) : pregnant ? (profile.ageYears <= 30 ? 350 : 360) : (profile.ageYears <= 30 ? 310 : 320)) : magnesium, ul: adult ? 350 : byBand(band, [65, 110, 350, 350, 350, 350, 350, 350]), ulScope: "SUPPLEMENTS_ONLY", ulComparison: "NOT_DETERMINABLE", note: "O UL abrange apenas magnésio farmacológico/suplementar; o plano não distingue essa origem." }),
    row({ nutrient: "phosphorusMg", label: "Fósforo", unit: "mg", referenceType: "RDA", referenceValue: phosphorus, ul: phosphorusUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE" }),
    row({ nutrient: "potassiumMg", label: "Potássio", unit: "mg", referenceType: "AI", referenceValue: lifeStageValue(profile, potassium, profile.ageYears <= 18 ? 2600 : 2900, profile.ageYears <= 18 ? 2500 : 2800), ulComparison: "NOT_ESTABLISHED" }),
    row({ nutrient: "sodiumMg", label: "Sódio", unit: "mg", referenceType: "AI", referenceValue: sodium, ul: profile.ageYears >= 14 ? 2300 : byBand(band, [1200, 1500, 1800, 2300, 2300, 2300, 2300, 2300]), upperType: "CDRR", ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE", note: "CDRR é a ingestão acima da qual se espera redução de risco crônico ao diminuir o consumo; não é UL." }),
    row({ nutrient: "zincMg", label: "Zinco", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, zinc, profile.ageYears <= 18 ? 12 : 11, profile.ageYears <= 18 ? 13 : 12), ul: zincUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE" }),
    row({ nutrient: "copperMg", label: "Cobre", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, copper, 1, 1.3), ul: copperUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE" }),
    row({ nutrient: "manganeseMg", label: "Manganês", unit: "mg", referenceType: "AI", referenceValue: lifeStageValue(profile, manganese, 2, 2.6), ul: manganeseUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE" }),
    row({ nutrient: "seleniumMcg", label: "Selênio", unit: "mcg", referenceType: "RDA", referenceValue: lifeStageValue(profile, selenium, 60, 70), ul: seleniumUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE" }),
    row({ nutrient: "vitaminAMcg", label: "Vitamina A", unit: "mcg RAE", referenceType: "RDA", referenceValue: lifeStageValue(profile, vitaminA, profile.ageYears <= 18 ? 750 : 770, profile.ageYears <= 18 ? 1200 : 1300), referenceRequiredForm: "RAE", ul: vitaminAUl, ulScope: "PREFORMED_VITAMIN_A", ulComparison: "NOT_DETERMINABLE", ulRequiredForm: "RETINOL", note: "A RDA usa RAE; o UL se aplica apenas à vitamina A pré-formada. RE, RAE e retinol não são convertidos sem composição suficiente.", source: vitaminSource }),
    row({ nutrient: "vitaminCMg", label: "Vitamina C", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, vitaminC, profile.ageYears <= 18 ? 80 : 85, profile.ageYears <= 18 ? 115 : 120), ul: vitaminCUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE", source: vitaminSource }),
    row({ nutrient: "vitaminDMcg", label: "Vitamina D", unit: "mcg", referenceType: "RDA", referenceValue: vitaminD, ul: vitaminDUl, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE", note: "Referência assume exposição solar mínima.", source: vitaminSource }),
    row({ nutrient: "vitaminEMg", label: "Vitamina E", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, vitaminE, 15, 19), ul: vitaminEUl, ulScope: "SUPPLEMENTS_AND_FORTIFIED_FOODS", ulComparison: "NOT_DETERMINABLE", note: "RDA em alfa-tocoferol; UL apenas para formas sintéticas de suplementos/fortificados.", source: vitaminSource }),
    row({ nutrient: "vitaminKMcg", label: "Vitamina K", unit: "mcg", referenceType: "AI", referenceValue: lifeStageValue(profile, vitaminK, profile.ageYears <= 18 ? 75 : 90, profile.ageYears <= 18 ? 75 : 90), ulComparison: "NOT_ESTABLISHED", source: vitaminSource }),
    row({ nutrient: "thiamineMg", label: "Tiamina", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, thiamine, 1.4, 1.4), ulComparison: "NOT_ESTABLISHED", source: vitaminSource }),
    row({ nutrient: "riboflavinMg", label: "Riboflavina", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, riboflavin, 1.4, 1.6), ulComparison: "NOT_ESTABLISHED", source: vitaminSource }),
    row({ nutrient: "niacinMg", label: "Niacina", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, niacin, 18, 17), ul: byBand(band, [10, 15, 20, 30, 35, 35, 35, 35]), ulScope: "SUPPLEMENTS_AND_FORTIFIED_FOODS", ulComparison: "NOT_DETERMINABLE", note: "RDA em equivalentes de niacina; UL apenas para niacina de suplementos/fortificados.", source: vitaminSource }),
    row({ nutrient: "vitaminB6Mg", label: "Vitamina B6", unit: "mg", referenceType: "RDA", referenceValue: lifeStageValue(profile, b6, 1.9, 2), ul: b6Ul, ulScope: "TOTAL_INTAKE", ulComparison: "APPLICABLE", source: vitaminSource }),
    row({ nutrient: "folateMcg", label: "Folato", unit: "mcg DFE", referenceType: "RDA", referenceValue: lifeStageValue(profile, folate, 600, 500), referenceRequiredForm: "DFE", ul: folateUl, ulScope: "SUPPLEMENTS_AND_FORTIFIED_FOODS", ulComparison: "NOT_DETERMINABLE", ulRequiredForm: "FOLIC_ACID", note: "A RDA usa DFE; o UL abrange ácido fólico sintético de suplementos/fortificados. Folato não especificado, DFE e ácido fólico não são renomeados nem convertidos sem dados suficientes.", source: vitaminSource }),
    row({ nutrient: "vitaminB12Mcg", label: "Vitamina B12", unit: "mcg", referenceType: "RDA", referenceValue: lifeStageValue(profile, b12, 2.6, 2.8), ulComparison: "NOT_ESTABLISHED", source: vitaminSource }),
  ];
}
