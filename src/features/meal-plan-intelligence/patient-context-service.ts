import type { ProfessionalFood } from "@/features/food-database";
import { foodRepository } from "@/features/food-database/repository";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { safeClinicalTexts } from "@/features/clinical-collection/clinical-text-safety";
import type { FoodAllergyStatus } from "@/features/clinical-anamnesis";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import { resolveMealPlanObjective } from "@/features/nutrition-strategy/inheritance";
import { nutritionStrategyInheritanceService } from "@/features/nutrition-strategy/inheritance-service";
import { resolveMealScheduleName } from "@/features/nutrition-strategy/meal-schedule";
import { nutritionReturnAnamnesisRepository } from "@/features/nutrition-return-anamnesis";
import { prisma } from "@/lib/database/prisma";

export interface PatientContextPendingField {
  readonly field: string;
  readonly expectedSource: string;
  readonly reason: string;
  readonly message: string;
}

export type PatientContextOptionalField = PatientContextPendingField;
export type HabitualIntakeBasis =
  | "CONFIRMED_REPRESENTATIVE"
  | "UNCONFIRMED_OR_TEST"
  | "NOT_INFORMED";

export type PatientContextRegion = "Ceará" | "Nordeste" | "Cariri";

export interface PatientContextLocation {
  readonly city: string;
  readonly state: string;
  readonly recognizedRegions: readonly PatientContextRegion[];
  readonly source: "MASTER_RECORD";
}

export interface PatientContextSourceSnapshot {
  readonly patientId: string;
  readonly masterRecordId?: string;
  readonly attendanceId: string;
  readonly sex?: "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
  readonly ageYears?: number;
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly bmi?: number;
  readonly objective?: string;
  readonly secondaryObjectives: readonly string[];
  readonly pathologies: readonly string[];
  readonly availableExams?: readonly string[];
  readonly allergyStatus: FoodAllergyStatus;
  readonly allergies: readonly string[];
  readonly restrictions: readonly string[];
  readonly preferredFoods: readonly string[];
  readonly habitualFoods?: readonly string[];
  readonly habitualIntakeBasis?: HabitualIntakeBasis;
  readonly dailyRoutine: readonly string[];
  readonly financialAccessibility?: string;
  readonly location?: {
    readonly city?: string;
    readonly state?: string;
  };
  readonly exercise: {
    readonly frequency?: string;
    readonly duration?: string;
    readonly modality?: string;
  };
  readonly clinicalObservations: readonly string[];
  readonly strategy?: MealPlanStrategyInheritance;
}

export interface PatientContext {
  readonly patient: {
    readonly patientId: string;
    readonly masterRecordId: string;
    readonly attendanceId: string;
    readonly sex: Exclude<PatientContextSourceSnapshot["sex"], undefined>;
    readonly ageYears: number;
    readonly weightKg: number;
    readonly heightCm: number;
    readonly bmi: number;
    readonly objective: string;
    readonly secondaryObjectives: readonly string[];
    readonly location?: PatientContextLocation;
    readonly source: "MASTER_RECORD";
  };
  readonly clinical: {
    readonly pathologies: readonly string[];
    readonly availableExams: readonly string[];
    readonly allergyStatus: FoodAllergyStatus;
    readonly allergies: readonly string[];
    readonly intolerances: readonly string[];
    readonly restrictions: readonly string[];
    readonly refusedFoods: readonly string[];
    readonly preferredFoods: readonly string[];
    readonly habitualFoods?: readonly string[];
    readonly habitualIntakeBasis?: HabitualIntakeBasis;
    readonly dailyRoutine: readonly string[];
    readonly financialAccessibility?: string;
    readonly mealSchedules: readonly {
      readonly mealNumber: number;
      readonly name: string;
      readonly time: string;
    }[];
    readonly exercise: PatientContextSourceSnapshot["exercise"];
    readonly relevantObservations: readonly string[];
    readonly unavailableStructuredFields: readonly {
      readonly field: "intolerances" | "refusedFoods";
      readonly expectedSource: "ANAMNESIS";
      readonly reason: string;
    }[];
    readonly source: "MASTER_RECORD";
  };
  readonly nutritionStrategy: {
    readonly sourceStrategyId: string;
    readonly objective?: string;
    readonly protocol: MealPlanStrategyInheritance["protocol"];
    readonly totalEnergyExpenditureKcal: number;
    readonly caloriesKcal: number;
    readonly protein: { readonly grams: number; readonly percentage: number };
    readonly carbohydrates: { readonly grams: number; readonly percentage: number };
    readonly fats: { readonly grams: number; readonly percentage: number };
    readonly dailyDistribution: MealPlanStrategyInheritance["mealDistribution"];
    readonly supplementation: MealPlanStrategyInheritance["supplementation"];
    readonly observations: string;
    readonly source: "NUTRITION_STRATEGY";
  };
  readonly foodCatalog: {
    readonly source: "MASTER_FOOD_DATABASE";
    readonly activeFoodCount: number;
    readonly availableSources: readonly string[];
    readonly foods: readonly ProfessionalFood[];
  };
}

export type PatientContextResult =
  | {
      readonly success: true;
      readonly patientContext: PatientContext;
      readonly optionalMissing: readonly PatientContextOptionalField[];
    }
  | {
      readonly success: false;
      readonly pending: readonly PatientContextPendingField[];
      readonly optionalMissing: readonly PatientContextOptionalField[];
    };

export interface PatientContextValidationOptions {
  readonly allowMissingMealSchedules?: boolean;
}

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

const NORTHEASTERN_STATES = new Map<string, string>([
  ["AL", "AL"],
  ["ALAGOAS", "AL"],
  ["BA", "BA"],
  ["BAHIA", "BA"],
  ["CE", "CE"],
  ["CEARA", "CE"],
  ["MA", "MA"],
  ["MARANHAO", "MA"],
  ["PB", "PB"],
  ["PARAIBA", "PB"],
  ["PE", "PE"],
  ["PERNAMBUCO", "PE"],
  ["PI", "PI"],
  ["PIAUI", "PI"],
  ["RN", "RN"],
  ["RIO GRANDE DO NORTE", "RN"],
  ["SE", "SE"],
  ["SERGIPE", "SE"],
]);

function normalizeLocationForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");
}

export function patientContextLocation(
  city: string | undefined,
  state: string | undefined,
): PatientContextLocation | undefined {
  if (!city?.trim() || !state?.trim()) return undefined;

  const normalizedCity = normalizeLocationForComparison(city);
  const stateCode = NORTHEASTERN_STATES.get(
    normalizeLocationForComparison(state),
  );
  const recognizedRegions: PatientContextRegion[] = [];
  if (stateCode === "CE") recognizedRegions.push("Ceará");
  if (stateCode) recognizedRegions.push("Nordeste");
  if (stateCode === "CE" && normalizedCity === "JUAZEIRO DO NORTE") {
    recognizedRegions.push("Cariri");
  }

  return {
    city,
    state,
    recognizedRegions,
    source: "MASTER_RECORD",
  };
}

function pending(
  field: string,
  expectedSource: string,
  reason: string,
  message: string,
): PatientContextPendingField {
  return { field, expectedSource, reason, message };
}

export function optionalPatientContextFields(
  source: Pick<
    PatientContextSourceSnapshot,
    | "preferredFoods"
    | "habitualFoods"
    | "habitualIntakeBasis"
    | "dailyRoutine"
    | "financialAccessibility"
  >,
): readonly PatientContextOptionalField[] {
  return [
    ...(!source.preferredFoods.length
      ? [pending("foodPreferences", "Anamnese", "Preferências não registradas; nenhum alimento será presumido como preferido.", "Alimentos preferidos não informados.")]
      : []),
    ...(source.habitualIntakeBasis !== "CONFIRMED_REPRESENTATIVE"
      ? [pending(
          "habitualIntake",
          "Recordatório alimentar",
          source.habitualIntakeBasis === "UNCONFIRMED_OR_TEST"
            ? "O recordatório existente não foi confirmado como representativo pelo nutricionista e foi preservado apenas no histórico."
            : "Nenhum recordatório representativo foi informado; ele é opcional.",
          source.habitualIntakeBasis === "UNCONFIRMED_OR_TEST"
            ? "Recordatório existente não confirmado como representativo."
            : "Recordatório alimentar não informado.",
        )]
      : []),
    ...(!source.dailyRoutine.length
      ? [pending("dailyRoutine", "Anamnese", "A proposta usará somente os horários aprovados na Estratégia.", "Rotina detalhada não informada.")]
      : []),
    ...(!source.financialAccessibility?.trim()
      ? [pending("financialAccessibility", "Anamnese", "Será usado o padrão regional simples e de baixo custo, sem presumir orçamento.", "Orçamento ou faixa financeira não informado.")]
      : []),
  ];
}

export function validatePatientContextSources(
  source: PatientContextSourceSnapshot,
  options: PatientContextValidationOptions = {},
): readonly PatientContextPendingField[] {
  const issues: PatientContextPendingField[] = [];
  if (!source.masterRecordId) {
    issues.push(pending("masterRecordId", "Prontuário Mestre", "Vínculo principal ausente.", "Prontuário Mestre não encontrado para o paciente."));
  }
  if (!source.sex || source.sex === "NOT_INFORMED") {
    issues.push(pending("sex", "Cadastro do paciente", "Sexo necessário para o contexto clínico não foi informado.", "Sexo não encontrado no Cadastro do paciente."));
  }
  if (!positive(source.ageYears)) {
    issues.push(pending("ageYears", "Cadastro do paciente", "Data de nascimento ou idade válida ausente.", "Idade não encontrada no Cadastro do paciente."));
  }
  if (!positive(source.weightKg)) {
    issues.push(pending("weightKg", "Antropometria", "Peso válido não registrado no atendimento.", "Peso não encontrado na Antropometria."));
  }
  if (!positive(source.heightCm)) {
    issues.push(pending("heightCm", "Antropometria", "Altura válida não registrada no atendimento.", "Altura não encontrada na Antropometria."));
  }
  if (!positive(source.bmi)) {
    issues.push(pending("bmi", "Antropometria", "IMC válido não registrado no atendimento.", "IMC não encontrado na Antropometria."));
  }
  if (!source.objective?.trim()) {
    issues.push(pending("objective", "Prontuário Mestre", "Objetivo clínico principal ausente.", "Objetivo não encontrado no Prontuário Mestre."));
  }
  if (source.allergyStatus === "NOT_INFORMED") {
    issues.push(pending("allergies", "Anamnese", "O estado de alergias alimentares ainda não foi informado.", "Alergias não informadas: confirme a ausência de alergias ou registre os alérgenos na Anamnese."));
  } else if (source.allergyStatus === "CONFIRMED" && !source.allergies.length) {
    issues.push(pending("allergies", "Anamnese", "O estado está confirmado, mas nenhum alérgeno foi registrado.", "Informe os alérgenos confirmados na Anamnese."));
  }
  if (!source.strategy) {
    issues.push(pending("strategy", "Estratégia Nutricional", "Estratégia aprovada não encontrada para o atendimento.", "Estratégia Nutricional aprovada não encontrada."));
  } else {
    const mealsWithoutTime = source.strategy.mealDistribution.filter(
      (meal) => !meal.time.trim(),
    );
    if (
      !options.allowMissingMealSchedules &&
      (!source.strategy.mealDistribution.length || mealsWithoutTime.length)
    ) {
      const detail = mealsWithoutTime.length
        ? ` Horários ausentes em: ${mealsWithoutTime
            .map(
              (meal) =>
                resolveMealScheduleName(
                  source.strategy!.mealDistribution.length,
                  meal.mealNumber,
                  meal.name,
                ),
            )
            .join(", ")}.`
        : " Nenhuma distribuição diária foi registrada.";
      issues.push(pending("mealSchedules", "Estratégia Nutricional — distribuição diária", "Horários necessários para organizar a rotina alimentar estão ausentes.", `Horários não encontrados na Estratégia Nutricional.${detail}`));
    }
  }
  return issues;
}

export function assemblePatientContext(
  source: PatientContextSourceSnapshot,
  foods: readonly ProfessionalFood[],
  options: PatientContextValidationOptions = {},
): PatientContextResult {
  const issues = [...validatePatientContextSources(source, options)];
  const optionalMissing = optionalPatientContextFields(source);
  if (!foods.length) {
    issues.push(pending("foodCatalog", "Banco Mestre de Alimentos", "Nenhum alimento ativo real foi localizado.", "Alimentos não encontrados no Banco Mestre."));
  }
  if (issues.length) return { success: false, pending: issues, optionalMissing };

  const strategy = source.strategy!;
  return {
    success: true,
    optionalMissing,
    patientContext: {
      patient: {
        patientId: source.patientId,
        masterRecordId: source.masterRecordId!,
        attendanceId: source.attendanceId,
        sex: source.sex!,
        ageYears: source.ageYears!,
        weightKg: source.weightKg!,
        heightCm: source.heightCm!,
        bmi: source.bmi!,
        objective: source.objective!,
        secondaryObjectives: source.secondaryObjectives,
        location: patientContextLocation(
          source.location?.city,
          source.location?.state,
        ),
        source: "MASTER_RECORD",
      },
      clinical: {
        pathologies: source.pathologies,
        availableExams: source.availableExams ?? [],
        allergyStatus: source.allergyStatus,
        allergies: source.allergies,
        intolerances: [],
        restrictions: source.restrictions,
        refusedFoods: [],
        preferredFoods: source.preferredFoods,
        habitualFoods: source.habitualFoods ?? [],
        habitualIntakeBasis: source.habitualIntakeBasis ?? "NOT_INFORMED",
        dailyRoutine: source.dailyRoutine,
        financialAccessibility: source.financialAccessibility,
        mealSchedules: strategy.mealDistribution.map((meal) => ({
          mealNumber: meal.mealNumber,
          name: meal.name,
          time: meal.time,
        })),
        exercise: source.exercise,
        relevantObservations: source.clinicalObservations,
        unavailableStructuredFields: [
          { field: "intolerances", expectedSource: "ANAMNESIS", reason: "O modelo aprovado da Anamnese não possui campo estruturado de intolerâncias." },
          { field: "refusedFoods", expectedSource: "ANAMNESIS", reason: "O modelo aprovado da Anamnese não possui campo estruturado de alimentos recusados." },
        ],
        source: "MASTER_RECORD",
      },
      nutritionStrategy: {
        sourceStrategyId: strategy.sourceStrategyId,
        objective: resolveMealPlanObjective(strategy).label,
        protocol: strategy.protocol,
        totalEnergyExpenditureKcal: strategy.totalEnergyExpenditureKcal,
        caloriesKcal: strategy.caloriesKcal,
        protein: { grams: strategy.proteinGrams, percentage: strategy.proteinPercentage },
        carbohydrates: { grams: strategy.carbohydratesGrams, percentage: strategy.carbohydratesPercentage },
        fats: { grams: strategy.fatsGrams, percentage: strategy.fatsPercentage },
        dailyDistribution: strategy.mealDistribution,
        supplementation: strategy.supplementation,
        observations: strategy.clinicalObservations,
        source: "NUTRITION_STRATEGY",
      },
      foodCatalog: {
        source: "MASTER_FOOD_DATABASE",
        activeFoodCount: foods.length,
        availableSources: [...new Set(foods.map((food) => food.source.kind))].sort(),
        foods,
      },
    },
  };
}

function splitRegisteredText(value: string | undefined) {
  return (value ?? "")
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compact(values: readonly (string | undefined)[]) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

async function readAllActiveFoods() {
  const first = await foodRepository.search({ page: 1, pageSize: 50, status: "ACTIVE" });
  const foods = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const result = await foodRepository.search({
      page,
      pageSize: 50,
      status: "ACTIVE",
    });
    foods.push(...result.items);
  }
  return foods
    .filter((food) => food.source.origin !== "DEMONSTRATIVE");
}

async function readMasterRecordLocation(
  patientId: string,
  attendanceId: string,
) {
  const masterRecord = await prisma.masterRecord.findFirst({
    where: {
      patientId,
      status: "ACTIVE",
      patient: { deletedAt: null },
      attendances: { some: { id: attendanceId, deletedAt: null } },
    },
    select: {
      patient: {
        select: {
          address: {
            select: { city: true, state: true, status: true },
          },
        },
      },
    },
  });
  const address = masterRecord?.patient.address;
  if (address?.status !== "ACTIVE") return undefined;
  return patientContextLocation(
    address.city ?? undefined,
    address.state ?? undefined,
  );
}

export const patientContextService = {
  async get(
    patientId: string,
    attendanceId: string,
    options: PatientContextValidationOptions = {},
  ): Promise<PatientContextResult> {
    const [collection, clinicalPanel, strategy, returnAnamnesis, location] = await Promise.all([
      clinicalCollectionRepository.getCollection(patientId, attendanceId),
      nutritionClinicalPanelRepository.get(patientId, attendanceId),
      nutritionStrategyInheritanceService.getForMealPlan(patientId, attendanceId),
      nutritionReturnAnamnesisRepository.getView(patientId, attendanceId),
      readMasterRecordLocation(patientId, attendanceId),
    ]);
    const anamnesis = collection?.anamnesis?.data;
    const source: PatientContextSourceSnapshot = {
      patientId,
      masterRecordId: collection?.masterRecordId,
      attendanceId,
      sex: collection?.patientSex,
      ageYears: collection?.patientAge,
      weightKg: clinicalPanel?.nutritionalStatus.weightKg,
      heightCm: clinicalPanel?.nutritionalStatus.heightM
        ? clinicalPanel.nutritionalStatus.heightM * 100
        : undefined,
      bmi: clinicalPanel?.nutritionalStatus.bmi,
      objective: clinicalPanel?.patient.primaryObjective,
      secondaryObjectives: clinicalPanel?.patient.secondaryObjectives ?? [],
      pathologies: clinicalPanel?.inheritedClinicalContext.diagnoses ?? [],
      availableExams: clinicalPanel?.inheritedClinicalContext.laboratoryExams ?? [],
      allergyStatus:
        clinicalPanel?.inheritedClinicalContext.allergyStatus ??
        "NOT_INFORMED",
      allergies: clinicalPanel?.inheritedClinicalContext.allergies ?? [],
      restrictions: splitRegisteredText(anamnesis?.nutrition.restrictions),
      preferredFoods: splitRegisteredText(anamnesis?.nutrition.preferences),
      habitualFoods:
        returnAnamnesis?.status === "COMPLETED" &&
        returnAnamnesis.data.recall24h?.dayType === "HABITUAL" &&
        returnAnamnesis.data.recall24h.representativeConfirmed === true
          ? returnAnamnesis.data.recall24h.meals.flatMap((meal) =>
          meal.foods.map((food) => food.name.trim()).filter(Boolean),
            )
          : [],
      habitualIntakeBasis:
        returnAnamnesis?.status === "COMPLETED" &&
        returnAnamnesis.data.recall24h?.dayType === "HABITUAL" &&
        returnAnamnesis.data.recall24h.representativeConfirmed === true
          ? "CONFIRMED_REPRESENTATIVE"
          : returnAnamnesis?.data.recall24h
            ? "UNCONFIRMED_OR_TEST"
            : "NOT_INFORMED",
      financialAccessibility:
        returnAnamnesis?.data.quickReturn.mainDifficulty === "COST_ACCESS"
          ? "Custo ou acesso aos alimentos registrado como dificuldade principal no retorno."
          : undefined,
      location,
      dailyRoutine: compact([
        anamnesis?.nutrition.mealsPerDay ? `Refeições por dia: ${anamnesis.nutrition.mealsPerDay}` : undefined,
        anamnesis?.nutrition.water ? `Água: ${anamnesis.nutrition.water}` : undefined,
        anamnesis?.sleep.hours ? `Sono: ${anamnesis.sleep.hours}` : undefined,
        anamnesis?.sleep.quality ? `Qualidade do sono: ${anamnesis.sleep.quality}` : undefined,
        anamnesis?.habits.others,
        returnAnamnesis?.data.legacy?.followUp.routineChanges,
      ]),
      exercise: {
        frequency: anamnesis?.physicalActivity.frequency || undefined,
        duration: anamnesis?.physicalActivity.duration || undefined,
        modality: anamnesis?.physicalActivity.modality || undefined,
      },
      clinicalObservations: safeClinicalTexts([
        anamnesis?.chiefComplaint,
        anamnesis?.clinicalHistoryNotes,
        anamnesis?.generalNotes,
        collection?.records.anthropometry.data.notes,
        collection?.records.posturalAssessment.data.notes,
        strategy?.clinicalObservations,
      ]),
      strategy: strategy ?? undefined,
    };
    const sourceIssues = validatePatientContextSources(source, options);
    if (sourceIssues.length) {
      return {
        success: false,
        pending: sourceIssues,
        optionalMissing: optionalPatientContextFields(source),
      };
    }
    return assemblePatientContext(source, await readAllActiveFoods(), options);
  },
};
