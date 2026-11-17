import { anthropometryPerimetryService } from "@/features/anthropometry-perimetry";
import {
  clinicalAnamnesisService,
  clinicalHistoryOptions,
  objectiveOptions,
} from "@/features/clinical-anamnesis";
import {
  clinicalCollectionService,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { laboratoryExamsService } from "@/features/laboratory-exams";
import { mealPlanService } from "@/features/meal-plan";
import type { SessionUser } from "@/features/mvp";
import {
  nutritionStrategySelectionFromView,
  nutritionStrategyService,
} from "@/features/nutrition-strategy";
import { patientHubService } from "@/features/patient-hub";

import type {
  ClinicalEngineMetric,
  ClinicalEngineSection,
  ClinicalEngineView,
  NutritionDecisionTimelineEvent,
} from "./contracts";
import {
  analyzeNutritionDecision,
  NUTRITION_DECISION_ENGINE_VERSION,
} from "./decision-rules";

const notAvailable = "Não registrado";
const objectiveLabels = new Map(objectiveOptions);
const clinicalHistoryLabels = new Map(clinicalHistoryOptions);

function value(
  metricValue: string | number | undefined,
  suffix = "",
): string {
  return metricValue === undefined || metricValue === ""
    ? notAvailable
    : `${metricValue}${suffix}`;
}

function metric(
  label: string,
  metricValue: string | number | undefined,
  suffix = "",
): ClinicalEngineMetric {
  const formatted = value(metricValue, suffix);
  return {
    label,
    value: formatted,
    pending: formatted === notAvailable,
  };
}

function listValue(items: readonly string[]): string {
  return items.length ? items.join(" · ") : notAvailable;
}

function section(
  input: Omit<ClinicalEngineSection, "status"> & {
    readonly restricted?: boolean;
  },
): ClinicalEngineSection {
  const status = input.restricted
    ? "RESTRICTED"
    : input.metrics.some((item) => item.pending)
      ? "PENDING"
      : "COMPLETE";
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    status,
    metrics: input.metrics,
    items: input.items,
  };
}

function latestDate(dates: readonly (string | undefined)[]): string {
  return (
    dates
      .filter((item): item is string => Boolean(item))
      .sort((left, right) => right.localeCompare(left))[0] ??
    new Date(0).toISOString()
  );
}

function numericValue(input: string | undefined) {
  if (!input) return undefined;
  const match = input.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function splitRegisteredText(input: string) {
  return input
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMedication(input: {
  readonly name: string;
  readonly dose: string;
  readonly frequency: string;
  readonly reason: string;
}) {
  return [input.name, input.dose, input.frequency, input.reason]
    .filter(Boolean)
    .join(" · ");
}

function timeline(
  view: Awaited<ReturnType<typeof patientHubService.get>>,
  mealPlan: Awaited<ReturnType<typeof mealPlanService.get>>,
): readonly NutritionDecisionTimelineEvent[] {
  if (!view) return [];
  const existing = view.timeline.map(
    (event): NutritionDecisionTimelineEvent => ({
      id: event.id,
      occurredAt: event.occurredAt,
      title: event.title,
      description: event.description,
      professionalName: event.professionalName,
      source: event.module,
    }),
  );

  const mealPlanEvent: NutritionDecisionTimelineEvent[] = mealPlan
    ? [
        {
          id: `decision-timeline-${mealPlan.id}`,
          occurredAt: mealPlan.updatedAt,
          title: "Plano Alimentar registrado",
          description: `Estado existente: ${mealPlan.status}.`,
          professionalName: mealPlan.responsibleProfessional,
          source: "Plano Alimentar",
        },
      ]
    : [];

  return [...existing, ...mealPlanEvent]
    .filter(
      (event, index, all) =>
        all.findIndex((candidate) => candidate.id === event.id) === index,
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export const clinicalEngineService = {
  async get(input: {
    readonly patientId: string;
    readonly scenario: ClinicalCollectionScenarioKey;
    readonly user: SessionUser;
  }): Promise<ClinicalEngineView | null> {
    const hub = await patientHubService.get({
      patientId: input.patientId,
      scenario: input.scenario,
    });
    const attendanceId = hub?.attendance?.attendanceId;
    if (!hub || !attendanceId) return null;

    const canViewNutrition =
      nutritionStrategyService.canAccess(input.user) && hub.showNutrition;
    const [anamnesis, collection, anthropometry, laboratory, strategy, mealPlan] =
      await Promise.all([
        clinicalAnamnesisService.get({
          patientId: input.patientId,
          scenario: input.scenario,
        }),
        clinicalCollectionService.getCollection({
          patientId: input.patientId,
          attendanceId,
          scenario: input.scenario,
        }),
        anthropometryPerimetryService.get({
          patientId: input.patientId,
          attendanceId,
          scenario: input.scenario,
        }),
        laboratoryExamsService.get({
          patientId: input.patientId,
          scenario: input.scenario,
        }),
        canViewNutrition
          ? nutritionStrategyService.get({
              patientId: input.patientId,
              scenario: input.scenario,
              user: input.user,
            })
          : Promise.resolve(null),
        canViewNutrition
          ? mealPlanService.get({
              patientId: input.patientId,
              scenario: input.scenario,
            })
          : Promise.resolve(null),
      ]);

    if (!anamnesis || !collection || !anthropometry || !laboratory) {
      return null;
    }
    if (
      collection.masterRecordId !== anamnesis.masterRecordId ||
      collection.masterRecordId !== anthropometry.masterRecordId ||
      collection.masterRecordId !== laboratory.masterRecordId
    ) {
      return null;
    }
    if (
      (strategy && strategy.masterRecordId !== collection.masterRecordId) ||
      (mealPlan && mealPlan.masterRecordId !== collection.masterRecordId)
    ) {
      return null;
    }

    const { data } = anamnesis;
    const anthropometryData = collection.records.anthropometry.data;
    const bioimpedance = collection.records.bioimpedance.data;
    const perimetry = collection.records.perimetry.data;
    const activeExams = laboratory.records.filter(
      (record) => record.status === "ACTIVE",
    );
    const restrictions = splitRegisteredText(data.nutrition.restrictions);
    const pathologies = data.clinicalHistory.map(
      (item) => clinicalHistoryLabels.get(item) ?? item,
    );
    const secondaryObjectives = data.secondaryObjectives.map(
      (item) => objectiveLabels.get(item) ?? item,
    );
    const objective = data.primaryObjective
      ? objectiveLabels.get(data.primaryObjective)
      : undefined;
    const circumferenceCount = Object.entries(perimetry).filter(
      ([key, item]) => key !== "notes" && typeof item === "number",
    ).length;
    const planMeals = mealPlan?.meals.map((meal) => ({
      id: meal.id,
      name: meal.name,
      time: meal.time,
      foodCount: meal.foods.length,
    }));
    const supplementCount = new Set([
      ...data.supplements.map((item) => item.name),
      ...(strategy?.supplementation.map((item) => item.name) ?? []),
    ]).size;
    const analyzedAt = new Date().toISOString();
    const analysis = analyzeNutritionDecision({
      objective,
      strategy: strategy
        ? {
            status: strategy.status,
            objective: strategy.objectiveMain,
            calories: strategy.nutritionGoals.targetCalories,
            proteinGrams: strategy.nutritionGoals.protein.grams,
            carbohydratesGrams:
              strategy.nutritionGoals.carbohydrates.grams,
            fatsGrams: strategy.nutritionGoals.fats.grams,
          }
        : undefined,
      mealPlan: mealPlan
        ? {
            status: mealPlan.status,
            objective: mealPlan.summary.primaryObjective,
            calories: numericValue(mealPlan.summary.plannedCalories),
            proteinGrams: numericValue(mealPlan.summary.protein),
            carbohydratesGrams: numericValue(
              mealPlan.summary.carbohydrates,
            ),
            fatsGrams: numericValue(mealPlan.summary.fats),
            meals: planMeals ?? [],
          }
        : undefined,
      anthropometry: {
        weightKg: anthropometryData.weightKg,
        bioimpedanceWeightKg: bioimpedance.weightKg,
        heightCm: anthropometryData.heightCm,
        assessedAt: collection.records.anthropometry.audit?.updatedAt,
      },
      supplementCount,
      analyzedAt,
    });

    const sections: ClinicalEngineSection[] = [
      section({
        id: "clinical-summary",
        title: "Resumo Clínico",
        description:
          "Informações existentes organizadas sem diagnóstico automático.",
        metrics: [
          metric("Idade", hub.header.age, " anos"),
          metric("Sexo", hub.header.sexLabel),
          metric("Peso", anthropometryData.weightKg, " kg"),
          metric("Altura", anthropometryData.heightCm, " cm"),
          metric("IMC", anthropometryData.bmi),
          metric("Objetivo principal", objective),
        ],
        items: [
          ...pathologies.map((item) => `Patologia cadastrada: ${item}`),
          ...data.allergies.map((item) => `Alergia cadastrada: ${item}`),
          ...restrictions.map(
            (item) => `Restrição ou intolerância cadastrada: ${item}`,
          ),
        ],
      }),
      section({
        id: "objectives",
        title: "Objetivos",
        description: "Objetivos recuperados da Anamnese do mesmo prontuário.",
        metrics: [
          metric("Principal", objective),
          metric("Secundários", listValue(secondaryObjectives)),
          metric("Queixa principal", data.chiefComplaint || undefined),
        ],
      }),
      canViewNutrition
        ? section({
            id: "current-strategy",
            title: "Estratégia Atual",
            description:
              "Metas registradas na Estratégia Nutricional, sem alteração automática.",
            metrics: [
              metric("Estado", strategy?.summary.statusLabel),
              metric("Método", strategy?.strategyType),
              metric(
                "Energia",
                strategy?.nutritionGoals.targetCalories,
                " kcal",
              ),
              metric(
                "Proteína",
                strategy?.nutritionGoals.protein.grams,
                " g",
              ),
              metric(
                "Carboidratos",
                strategy?.nutritionGoals.carbohydrates.grams,
                " g",
              ),
              metric(
                "Lipídios",
                strategy?.nutritionGoals.fats.grams,
                " g",
              ),
            ],
          })
        : section({
            id: "current-strategy",
            title: "Estratégia Atual",
            description: "Conteúdo exclusivo da Nutrição.",
            restricted: true,
            metrics: [metric("Acesso", "Restrito ao nutricionista")],
          }),
      canViewNutrition
        ? section({
            id: "meal-plan",
            title: "Plano Alimentar",
            description:
              "Totais já registrados no Plano Alimentar; nenhuma fórmula é recalculada aqui.",
            metrics: [
              metric("Estado", mealPlan?.status),
              metric("Refeições", mealPlan?.meals.length),
              metric("Energia", mealPlan?.summary.plannedCalories),
              metric("Proteína", mealPlan?.summary.protein),
              metric("Carboidratos", mealPlan?.summary.carbohydrates),
              metric("Lipídios", mealPlan?.summary.fats),
            ],
            items: mealPlan?.meals.map(
              (meal) =>
                `${meal.time} · ${meal.name} · ${meal.foods.length} alimento(s)`,
            ),
          })
        : section({
            id: "meal-plan",
            title: "Plano Alimentar",
            description: "Conteúdo exclusivo da Nutrição.",
            restricted: true,
            metrics: [metric("Acesso", "Restrito ao nutricionista")],
          }),
      section({
        id: "anthropometry",
        title: "Antropometria",
        description:
          "Medidas atuais e disponibilidade de histórico no Prontuário Mestre.",
        metrics: [
          metric("Peso", anthropometryData.weightKg, " kg"),
          metric("Altura", anthropometryData.heightCm, " cm"),
          metric("IMC", anthropometryData.bmi),
          metric("Gordura corporal", bioimpedance.bodyFatPercent, "%"),
          metric("Massa magra", bioimpedance.fatFreeMassKg, " kg"),
          metric(
            "Circunferências",
            circumferenceCount || undefined,
            " cadastradas",
          ),
        ],
      }),
      section({
        id: "exams",
        title: "Exames",
        description:
          "Resultados ativos exibidos como registrados, sem interpretação laboratorial.",
        metrics: [
          metric("Exames ativos", activeExams.length || undefined),
          metric(
            "Última coleta",
            activeExams
              .map((item) => item.collectedAt)
              .sort()
              .at(-1),
          ),
        ],
        items: activeExams.map(
          (item) =>
            `${item.name}: ${item.result}${item.unit ? ` ${item.unit}` : ""} · coleta ${item.collectedAt}`,
        ),
      }),
      section({
        id: "medications",
        title: "Medicamentos",
        description: "Registros existentes na Anamnese, sem recomendação.",
        metrics: [
          metric(
            "Medicamentos cadastrados",
            data.medications.length || undefined,
          ),
        ],
        items: data.medications.map(formatMedication),
      }),
      section({
        id: "supplementation",
        title: "Suplementação",
        description:
          "Itens registrados na Anamnese e na Estratégia, sem prescrição automática.",
        metrics: [
          metric(
            "Anamnese",
            data.supplements.length || undefined,
            " item(ns)",
          ),
          metric(
            "Estratégia",
            canViewNutrition
              ? strategy?.supplementation.length || undefined
              : undefined,
            " item(ns)",
          ),
        ],
        items: [
          ...data.supplements.map(
            (item) =>
              `${item.name}${item.dose ? ` · ${item.dose}` : ""}${item.frequency ? ` · ${item.frequency}` : ""}`,
          ),
          ...(canViewNutrition
            ? (strategy?.supplementation.map(
                (item) =>
                  `${item.name} · ${item.schedule}${item.objective ? ` · ${item.objective}` : ""}`,
              ) ?? [])
            : []),
        ],
      }),
      section({
        id: "alerts",
        title: "Alertas",
        description:
          "Inconsistências e pendências objetivas para revisão profissional.",
        metrics: [
          metric("Alta prioridade", analysis.alerts.filter((item) => item.priority === "HIGH").length),
          metric("Média prioridade", analysis.alerts.filter((item) => item.priority === "MEDIUM").length),
          metric("Baixa prioridade", analysis.alerts.filter((item) => item.priority === "LOW").length),
        ],
      }),
      section({
        id: "assisted-suggestions",
        title: "Sugestões Assistidas",
        description:
          "Apoios explicáveis do SAULO AI; nenhuma alteração é aplicada automaticamente.",
        metrics: [
          metric("Sugestões disponíveis", analysis.suggestions.length),
          metric("Decisão final", "Exclusiva do nutricionista"),
        ],
      }),
    ];

    const lastUpdatedAt = latestDate([
      hub.attendance?.updatedAt,
      anamnesis.audit.updatedAt,
      collection.records.anthropometry.audit?.updatedAt,
      collection.records.bioimpedance.audit?.updatedAt,
      collection.records.perimetry.audit?.updatedAt,
      ...activeExams.map((item) => item.updatedAt),
      strategy?.updatedAt,
      mealPlan?.updatedAt,
    ]);

    return {
      patientId: input.patientId,
      masterRecordId: collection.masterRecordId,
      scenario: input.scenario,
      hub,
      sections,
      comparisons: analysis.comparisons,
      alerts: analysis.alerts,
      priorities: analysis.priorities,
      suggestions: analysis.suggestions,
      timeline: timeline(hub, mealPlan),
      analysisAudit: {
        analyzedAt,
        engineVersion: NUTRITION_DECISION_ENGINE_VERSION,
        strategyReference: strategy
          ? `Atualizada em ${strategy.updatedAt}`
          : undefined,
        mealPlanReference: mealPlan
          ? `Atualizado em ${mealPlan.updatedAt}`
          : undefined,
      },
      runtimeContext: {
        objective,
        initialStrategy: strategy
          ? nutritionStrategySelectionFromView(strategy)
          : undefined,
        initialStrategyStatus: strategy?.status,
        initialPlan: mealPlan ?? undefined,
        anthropometry: {
          weightKg: anthropometryData.weightKg,
          bioimpedanceWeightKg: bioimpedance.weightKg,
          heightCm: anthropometryData.heightCm,
          assessedAt: collection.records.anthropometry.audit?.updatedAt,
        },
        supplementCount,
      },
      demonstrative: true,
      completeSectionCount: sections.filter(
        (item) => item.status === "COMPLETE",
      ).length,
      pendingSectionCount: sections.filter(
        (item) => item.status !== "COMPLETE",
      ).length,
      lastUpdatedAt,
      responsibleProfessional:
        collection.connectedProfessional.professionalName,
      masterRecordVersion: String(anamnesis.version),
    };
  },
};
