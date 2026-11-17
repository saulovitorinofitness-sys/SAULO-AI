import { normalizeFoodSearchText } from "@/features/food-database";

import type { EligibleFood } from "./nutritional-decision-engine";
import type { PatientContext } from "./patient-context-service";
import type { SmartPlanDraft } from "./smart-plan-draft-generator";

export type ClinicalDecisionSource =
  | "MASTER_RECORD"
  | "NUTRITION_STRATEGY"
  | "NUTRITIONAL_DECISION_ENGINE"
  | "SMART_PLAN_DRAFT";

export interface ClinicalDecisionItem {
  readonly code: string;
  readonly label: string;
  readonly reason: string;
  readonly source: ClinicalDecisionSource;
}

export interface ClinicalDecisionMeal {
  readonly mealNumber: number;
  readonly name: string;
  readonly time: string;
  readonly role: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "MEAL";
  readonly source: "NUTRITION_STRATEGY";
}

export interface ClinicalDecisionPendingField {
  readonly field: string;
  readonly expectedSource: string;
  readonly reason: string;
}

export interface ClinicalDecision {
  readonly status: "READY" | "PENDING";
  readonly priorities: readonly ClinicalDecisionItem[];
  readonly restrictions: readonly ClinicalDecisionItem[];
  readonly recommendations: readonly ClinicalDecisionItem[];
  readonly meals: readonly ClinicalDecisionMeal[];
  readonly observations: readonly string[];
  readonly pending: readonly ClinicalDecisionPendingField[];
}

export interface ClinicalDecisionInput {
  readonly patientContext: PatientContext | null | undefined;
  readonly eligibleFoods?: readonly EligibleFood[];
  readonly smartPlanDraft?: SmartPlanDraft | null;
}

const decisionCache = new WeakMap<PatientContext, ClinicalDecision>();

function normalized(values: readonly string[]) {
  return normalizeFoodSearchText(values.join(" "));
}

function affirmed(values: readonly string[]) {
  return values.filter((value) => {
    const entry = normalizeFoodSearchText(value);
    return entry && !/^(nega|nenhum|nenhuma|nao|sem)(\s|$)/.test(entry);
  });
}

function includesAny(value: string, markers: readonly string[]) {
  return markers.some((marker) => value.includes(normalizeFoodSearchText(marker)));
}

function positive(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

function item(
  code: string,
  label: string,
  reason: string,
  source: ClinicalDecisionSource,
): ClinicalDecisionItem {
  return { code, label, reason, source };
}

function pending(field: string, expectedSource: string, reason: string) {
  return { field, expectedSource, reason } satisfies ClinicalDecisionPendingField;
}

export function inferMealRole(
  name: string,
  time?: string,
): ClinicalDecisionMeal["role"] {
  const value = normalizeFoodSearchText(name);
  if (includesAny(value, ["desjejum", "cafe da manha"])) return "BREAKFAST";
  if (value.includes("almoco")) return "LUNCH";
  if (value.includes("jantar")) return "DINNER";
  if (includesAny(value, ["lanche", "ceia", "colacao"])) return "SNACK";
  const hour = Number.parseInt(time?.split(":")[0] ?? "", 10);
  if (Number.isInteger(hour)) {
    if (hour <= 9) return "BREAKFAST";
    if (hour >= 11 && hour <= 14) return "LUNCH";
    if (hour >= 18 && hour <= 22) return "DINNER";
    return "SNACK";
  }
  return "MEAL";
}

function uniqueItems(items: readonly ClinicalDecisionItem[]) {
  return [...new Map(items.map((entry) => [entry.code, entry])).values()];
}

function validateContext(context: PatientContext | null | undefined) {
  if (!context) {
    return [pending("patientContext", "Prontuário Mestre", "Contexto clínico não fornecido.")];
  }
  const issues: ClinicalDecisionPendingField[] = [];
  if (!context.patient.sex || context.patient.sex === "NOT_INFORMED") issues.push(pending("sex", "Cadastro do paciente", "Sexo não informado."));
  if (!positive(context.patient.ageYears)) issues.push(pending("ageYears", "Cadastro do paciente", "Idade válida não informada."));
  if (!positive(context.patient.weightKg)) issues.push(pending("weightKg", "Antropometria", "Peso válido não informado."));
  if (!positive(context.patient.heightCm)) issues.push(pending("heightCm", "Antropometria", "Altura válida não informada."));
  if (!positive(context.patient.bmi)) issues.push(pending("bmi", "Antropometria", "IMC válido não informado."));
  if (!context.patient.objective?.trim()) issues.push(pending("objective", "Prontuário Mestre", "Objetivo clínico não informado."));

  const strategy = context.nutritionStrategy;
  if (!strategy?.sourceStrategyId || strategy.source !== "NUTRITION_STRATEGY") {
    issues.push(pending("nutritionStrategy", "Estratégia Nutricional", "Estratégia aprovada não informada."));
    return issues;
  }
  if (!positive(strategy.totalEnergyExpenditureKcal)) issues.push(pending("GET", "Estratégia Nutricional", "GET válido não informado."));
  if (!positive(strategy.caloriesKcal)) issues.push(pending("VET", "Estratégia Nutricional", "VET válido não informado."));
  if (!positive(strategy.protein.grams)) issues.push(pending("protein", "Estratégia Nutricional", "Meta de proteínas não informada."));
  if (!positive(strategy.carbohydrates.grams)) issues.push(pending("carbohydrates", "Estratégia Nutricional", "Meta de carboidratos não informada."));
  if (!positive(strategy.fats.grams)) issues.push(pending("fats", "Estratégia Nutricional", "Meta de lipídios não informada."));
  if (!strategy.dailyDistribution?.length) issues.push(pending("mealCount", "Estratégia Nutricional", "Número de refeições não informado."));
  for (const meal of strategy.dailyDistribution ?? []) {
    if (!meal.time.trim()) issues.push(pending(`mealTime:${meal.mealNumber}`, "Estratégia Nutricional", `Horário não informado para ${meal.name}.`));
  }
  for (const unavailable of context.clinical.unavailableStructuredFields) {
    issues.push(pending(unavailable.field, unavailable.expectedSource, unavailable.reason));
  }
  return issues;
}

function buildCoreDecision(context: PatientContext): ClinicalDecision {
  const priorities: ClinicalDecisionItem[] = [];
  const restrictions: ClinicalDecisionItem[] = [];
  const recommendations: ClinicalDecisionItem[] = [];
  const objective = normalizeFoodSearchText(context.patient.objective);
  const confirmedPathologies = affirmed(context.clinical.pathologies);
  const pathologies = normalized(confirmedPathologies);
  const pathologyTokens = new Set(pathologies.split(/[^a-z0-9]+/).filter(Boolean));
  const confirmedRestrictions = affirmed(context.clinical.restrictions);
  const restrictionMarkers = normalizeFoodSearchText(
    `${confirmedRestrictions.join(" ")} ${String(context.nutritionStrategy?.protocol ?? "")} ${context.nutritionStrategy?.observations ?? ""}`,
  );

  if (includesAny(objective, ["emagrec", "reduzir peso", "perda de peso"])) {
    priorities.push(item("WEIGHT_REDUCTION", "Emagrecimento", "Objetivo clínico registrado.", "MASTER_RECORD"));
    recommendations.push(item("SATIETY", "Priorizar maior saciedade", "Compatível com o objetivo de emagrecimento.", "MASTER_RECORD"));
  }
  if (includesAny(objective, ["hipertrof", "ganho de massa", "massa muscular"])) {
    priorities.push(item("MUSCLE_GAIN", "Hipertrofia", "Objetivo clínico registrado.", "MASTER_RECORD"));
    recommendations.push(item("PROTEIN_DISTRIBUTION", "Distribuir fontes proteicas", "Compatível com o objetivo de hipertrofia.", "NUTRITION_STRATEGY"));
  }
  if (includesAny(pathologies, ["diabetes", "diabetes mellitus", "resistencia a insulina"])) {
    priorities.push(item("GLYCEMIC_CONTROL", "Controle glicêmico", "Patologia registrada.", "MASTER_RECORD"));
    restrictions.push(item("LIMIT_ADDED_SUGAR", "Evitar açúcar adicionado", "Controle glicêmico necessário.", "MASTER_RECORD"));
    recommendations.push(item("WHOLE_FOODS", "Priorizar alimentos integrais", "Apoio ao controle glicêmico.", "MASTER_RECORD"));
  }
  if (pathologies.includes("hipertensao") || pathologyTokens.has("has")) {
    priorities.push(item("BLOOD_PRESSURE_CONTROL", "Controle da pressão arterial", "HAS registrada.", "MASTER_RECORD"));
    restrictions.push(item("LIMIT_SODIUM", "Limitar sódio", "HAS registrada.", "MASTER_RECORD"));
    recommendations.push(item("MINIMALLY_PROCESSED", "Priorizar alimentos in natura", "Apoio ao controle de sódio.", "MASTER_RECORD"));
  }
  if (includesAny(normalized(affirmed(context.clinical.intolerances)), ["lactose"])) {
    restrictions.push(item("EXCLUDE_LACTOSE", "Excluir lactose", "Intolerância à lactose registrada.", "MASTER_RECORD"));
    recommendations.push(item("LACTOSE_FREE", "Utilizar opções sem lactose", "Intolerância registrada.", "MASTER_RECORD"));
  }
  if (includesAny(restrictionMarkers, ["vegetarian", "vegetariana"])) {
    restrictions.push(item("VEGETARIAN_PATTERN", "Excluir carnes e pescados", "Padrão vegetariano registrado.", "MASTER_RECORD"));
    recommendations.push(item("PLANT_PROTEINS", "Priorizar fontes proteicas vegetais", "Padrão vegetariano registrado.", "MASTER_RECORD"));
  }
  for (const allergy of affirmed(context.clinical.allergies)) {
    restrictions.push(item(`ALLERGY:${normalizeFoodSearchText(allergy)}`, `Excluir alergênico: ${allergy}`, "Alergia registrada.", "MASTER_RECORD"));
  }
  for (const food of affirmed(context.clinical.refusedFoods)) {
    restrictions.push(item(`REFUSAL:${normalizeFoodSearchText(food)}`, `Não utilizar: ${food}`, "Alimento recusado.", "MASTER_RECORD"));
  }

  recommendations.push(
    item("VEGETABLES", "Priorizar verduras e legumes", "Diversidade alimentar.", "MASTER_RECORD"),
    item("FRUIT", "Priorizar frutas", "Diversidade alimentar.", "MASTER_RECORD"),
  );
  if (context.clinical.preferredFoods.length) {
    recommendations.push(item("PREFERENCES", "Considerar preferências registradas", "Apoio à adesão.", "MASTER_RECORD"));
  }

  const meals = (context.nutritionStrategy?.dailyDistribution ?? []).map((meal) => ({
    mealNumber: meal.mealNumber,
    name: meal.name,
    time: meal.time.trim() || "Não informado.",
    role: inferMealRole(meal.name, meal.time),
    source: "NUTRITION_STRATEGY" as const,
  }));
  const pendingFields = validateContext(context);
  return {
    status: pendingFields.length ? "PENDING" : "READY",
    priorities: uniqueItems(priorities),
    restrictions: uniqueItems(restrictions),
    recommendations: uniqueItems(recommendations),
    meals,
    observations: [
      `Protocolo nutricional: ${String(context.nutritionStrategy?.protocol ?? "Não informado")}.`,
      context.clinical.availableExams.length
        ? `${context.clinical.availableExams.length} exame(s) disponível(is), sem interpretação automática.`
        : "Exames não informados.",
      context.clinical.dailyRoutine.length ? "Rotina registrada considerada." : "Rotina não informada.",
    ],
    pending: pendingFields,
  };
}

function externalObservations(
  eligibleFoods: readonly EligibleFood[] | undefined,
  draft: SmartPlanDraft | null | undefined,
) {
  const observations: string[] = [];
  if (eligibleFoods) {
    let blocked = 0;
    let restricted = 0;
    for (const food of eligibleFoods) {
      if (food.status === "BLOQUEADO") blocked += 1;
      else if (food.status === "RESTRITO") restricted += 1;
    }
    observations.push(`${blocked} alimento(s) bloqueado(s) e ${restricted} restrito(s) pelo motor nutricional.`);
  }
  if (draft) {
    observations.push(
      draft.requiresProfessionalAdjustment
        ? "Prévia existente requer ajuste profissional."
        : "Prévia estruturada existente ainda não aprovada.",
    );
  }
  return observations;
}

export const assistedClinicalDecisionEngine = {
  evaluate(input: ClinicalDecisionInput): ClinicalDecision {
    if (!input.patientContext) {
      return {
        status: "PENDING",
        priorities: [],
        restrictions: [],
        recommendations: [],
        meals: [],
        observations: externalObservations(input.eligibleFoods, input.smartPlanDraft),
        pending: validateContext(input.patientContext),
      };
    }
    const cached = decisionCache.get(input.patientContext) ?? buildCoreDecision(input.patientContext);
    if (!decisionCache.has(input.patientContext)) decisionCache.set(input.patientContext, cached);
    const extra = externalObservations(input.eligibleFoods, input.smartPlanDraft);
    return extra.length ? { ...cached, observations: [...cached.observations, ...extra] } : cached;
  },
};
