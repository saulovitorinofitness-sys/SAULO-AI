import { anthropometryPerimetryService } from "@/features/anthropometry-perimetry";
import { clinicalAnamnesisService, objectiveOptions } from "@/features/clinical-anamnesis";
import { clinicalCollectionService, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { laboratoryExamsService } from "@/features/laboratory-exams";
import { mealPlanService } from "@/features/meal-plan";
import type { SessionUser } from "@/features/mvp";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { patientHubService } from "@/features/patient-hub";
import type { ClinicalEngineMetric, ClinicalEngineSection, ClinicalEngineView } from "./contracts";

const notAvailable = "Não disponível no mock atual";
const objectiveLabels = new Map(objectiveOptions);

function value(value: string | number | undefined, suffix = ""): string {
  return value === undefined || value === "" ? notAvailable : `${value}${suffix}`;
}

function metric(label: string, metricValue: string | number | undefined, suffix = ""): ClinicalEngineMetric {
  const formatted = value(metricValue, suffix);
  return { label, value: formatted, pending: formatted === notAvailable };
}

function listValue(items: readonly string[]): string {
  return items.length ? items.join(" · ") : notAvailable;
}

function section(input: Omit<ClinicalEngineSection, "status"> & { readonly restricted?: boolean }): ClinicalEngineSection {
  const status = input.restricted ? "RESTRICTED" : input.metrics.some((item) => item.pending) ? "PENDING" : "COMPLETE";
  return { id: input.id, title: input.title, description: input.description, status, metrics: input.metrics, items: input.items };
}

function latestDate(dates: readonly (string | undefined)[]): string {
  return dates.filter((item): item is string => Boolean(item)).sort((a, b) => b.localeCompare(a))[0] ?? new Date(0).toISOString();
}

function posturalSummary(state: "NOT_ASSESSED" | "NO_FINDING_RECORDED" | "FINDING_RECORDED"): string {
  if (state === "NOT_ASSESSED") return "Não avaliado";
  if (state === "NO_FINDING_RECORDED") return "Sem achado registrado";
  return "Achado registrado";
}

export const clinicalEngineService = {
  async get(input: { readonly patientId: string; readonly scenario: ClinicalCollectionScenarioKey; readonly user: SessionUser }): Promise<ClinicalEngineView | null> {
    const hub = await patientHubService.get({ patientId: input.patientId, scenario: input.scenario });
    const attendanceId = hub?.attendance?.attendanceId;
    if (!hub || !attendanceId) return null;

    const canViewNutrition = nutritionStrategyService.canAccess(input.user) && hub.showNutrition;
    const [anamnesis, collection, anthropometry, laboratory, strategy, mealPlan] = await Promise.all([
      clinicalAnamnesisService.get({ patientId: input.patientId, scenario: input.scenario }),
      clinicalCollectionService.getCollection({ patientId: input.patientId, attendanceId, scenario: input.scenario }),
      anthropometryPerimetryService.get({ patientId: input.patientId, attendanceId, scenario: input.scenario }),
      laboratoryExamsService.get({ patientId: input.patientId, scenario: input.scenario }),
      canViewNutrition ? nutritionStrategyService.get({ patientId: input.patientId, scenario: input.scenario, user: input.user }) : Promise.resolve(null),
      canViewNutrition ? mealPlanService.get({ patientId: input.patientId, scenario: input.scenario }) : Promise.resolve(null),
    ]);

    if (!anamnesis || !collection || !anthropometry || !laboratory) return null;

    const { data } = anamnesis;
    const anthropometryData = collection.records.anthropometry.data;
    const bioimpedance = collection.records.bioimpedance.data;
    const perimetry = collection.records.perimetry.data;
    const postural = collection.records.posturalAssessment;
    const activeExams = laboratory.records.filter((record) => record.status === "ACTIVE");
    const hypertensionRegistered = data.clinicalHistory.includes("HYPERTENSION");
    const diabetesRegistered = data.clinicalHistory.includes("DIABETES");
    const circumferenceCount = Object.entries(perimetry).filter(([key, item]) => key !== "notes" && typeof item === "number").length;
    const currentPlanIsActive = mealPlan?.status === "ACTIVE";

    const sections: ClinicalEngineSection[] = [
      section({
        id: "identification",
        title: "Identificação",
        description: "Dados cadastrais e objetivos já vinculados ao Prontuário Mestre.",
        metrics: [
          metric("Nome", hub.header.fullName),
          metric("Sexo", hub.header.sexLabel),
          metric("Idade", hub.header.age, " anos"),
          metric("Objetivo principal", data.primaryObjective ? objectiveLabels.get(data.primaryObjective) : undefined),
          metric("Objetivos secundários", listValue(data.secondaryObjectives.map((item) => objectiveLabels.get(item) ?? item))),
        ],
      }),
      section({
        id: "alerts",
        title: "Alertas clínicos",
        description: "Presença ou ausência de registros, sem classificação de risco.",
        metrics: [
          metric("Hipertensão", hypertensionRegistered ? "Cadastrada na anamnese" : "Sem registro na anamnese"),
          metric("Diabetes", diabetesRegistered ? "Cadastrada na anamnese" : "Sem registro na anamnese"),
          metric("Lesões", data.injuries.length ? `${data.injuries.length} registro(s)` : "Sem registro na anamnese"),
          metric("Medicamentos", data.medications.length ? `${data.medications.length} registro(s)` : "Sem registro na anamnese"),
          metric("Alergias", data.allergies.length ? `${data.allergies.length} registro(s)` : "Sem registro na anamnese"),
          metric("Pendências", hub.pendingItems.length ? `${hub.pendingItems.length} pendência(s) operacional(is)` : "Nenhuma pendência operacional"),
        ],
        items: [
          ...data.injuries.map((item) => `Lesão registrada: ${item.region} · ${item.situation}`),
          ...data.medications.map((item) => `Medicamento registrado: ${item.name} · ${item.dose} · ${item.frequency}`),
          ...data.allergies.map((item) => `Alergia registrada: ${item}`),
          ...hub.pendingItems.map((item) => `Pendência: ${item.title}`),
        ],
      }),
      section({
        id: "anthropometry",
        title: "Antropometria",
        description: "Medidas disponíveis na coleta e no histórico antropométrico.",
        metrics: [
          metric("Peso", anthropometryData.weightKg, " kg"),
          metric("Altura", anthropometryData.heightCm, " cm"),
          metric("IMC", anthropometryData.bmi),
          metric("Circunferências", circumferenceCount ? `${circumferenceCount} medida(s) cadastrada(s)` : undefined),
          metric("Evolução", anthropometry.assessments.length > 1 ? `${anthropometry.assessments.length} avaliações disponíveis` : "Sem histórico comparável disponível"),
        ],
        items: Object.entries(perimetry)
          .filter(([key, item]) => key !== "notes" && typeof item === "number")
          .map(([key, item]) => `${key}: ${item} cm`),
      }),
      section({
        id: "bioimpedance",
        title: "Bioimpedância",
        description: "Valores registrados no equipamento, sem interpretação automática.",
        metrics: [
          metric("Gordura corporal", bioimpedance.bodyFatPercent, "%"),
          metric("Massa magra", bioimpedance.fatFreeMassKg, " kg"),
          metric("Água corporal", bioimpedance.totalBodyWaterL, " L"),
          metric("Massa muscular", bioimpedance.skeletalMuscleMassKg, " kg"),
          metric("Evolução", undefined),
        ],
      }),
      section({
        id: "postural",
        title: "Avaliação postural",
        description: "Resumo descritivo das quatro vistas registradas.",
        metrics: [
          metric("Status", postural.status === "COMPLETED" ? "Avaliação concluída" : undefined),
          metric("Alterações identificadas", posturalSummary(postural.data.identifiedChanges)),
          metric("Limitações funcionais", posturalSummary(postural.data.functionalLimitations)),
          metric("Resumo", postural.data.notes),
        ],
        items: Object.entries(postural.data.views).map(([view, record]) => `${view}: ${posturalSummary(record.state)}${record.observation ? ` · ${record.observation}` : ""}`),
      }),
      section({
        id: "exams",
        title: "Exames",
        description: "Somente o resumo dos exames ativos cadastrados.",
        metrics: [
          metric("Exames ativos", activeExams.length || undefined),
          metric("Última coleta", activeExams.map((item) => item.collectedAt).sort().at(-1)),
          metric("Exames cadastrados", activeExams.length ? [...new Set(activeExams.map((item) => item.name))].join(" · ") : undefined),
        ],
      }),
      section({
        id: "energy",
        title: "Gasto energético",
        description: "Exibição exclusiva de valores já disponíveis; nenhum cálculo é executado.",
        metrics: [
          metric("TMB", bioimpedance.basalMetabolicRateKcal, " kcal"),
          metric("GET", undefined),
          metric("Equação utilizada", undefined),
          metric("NAF", undefined),
        ],
      }),
      canViewNutrition && strategy
        ? section({
            id: "nutrition-strategy",
            title: "Estratégia nutricional",
            description: "Resumo da estratégia cadastrada pelo profissional habilitado.",
            metrics: [
              metric("Status", strategy.summary.statusLabel),
              metric("Objetivo", strategy.summary.primaryObjective),
              metric("Estratégia", strategy.summary.strategyType),
              metric("Refeições", strategy.summary.mealCount),
              metric("Responsável", strategy.responsibleProfessional),
            ],
          })
        : section({
            id: "nutrition-strategy",
            title: "Estratégia nutricional",
            description: "Conteúdo exclusivo da Nutrição.",
            restricted: true,
            metrics: [metric("Acesso", "Restrito ao profissional habilitado")],
          }),
      canViewNutrition && mealPlan
        ? section({
            id: "meal-plan",
            title: "Plano alimentar",
            description: "Resumo do plano disponível, sem geração ou cálculo automático.",
            metrics: [
              metric("Dieta ativa", currentPlanIsActive ? "Plano ativo" : undefined),
              metric("Estado atual", mealPlan.status === "DRAFT" ? "Rascunho" : mealPlan.status === "IN_REVIEW" ? "Em revisão" : "Ativo"),
              metric("Refeições", mealPlan.meals.length),
              metric("Responsável", mealPlan.responsibleProfessional),
            ],
          })
        : section({
            id: "meal-plan",
            title: "Plano alimentar",
            description: "Conteúdo exclusivo da Nutrição.",
            restricted: true,
            metrics: [metric("Acesso", "Restrito ao profissional habilitado")],
          }),
      section({
        id: "history",
        title: "Histórico",
        description: "Linha do tempo consolidada dos registros do atendimento.",
        metrics: [metric("Eventos disponíveis", hub.timeline.length || undefined)],
      }),
    ];

    const lastUpdatedAt = latestDate([
      hub.attendance?.updatedAt,
      anamnesis.audit.updatedAt,
      collection.records.anthropometry.audit?.updatedAt,
      collection.records.bioimpedance.audit?.updatedAt,
      collection.records.perimetry.audit?.updatedAt,
      collection.records.posturalAssessment.audit?.updatedAt,
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
      timeline: hub.timeline,
      completeSectionCount: sections.filter((item) => item.status === "COMPLETE").length,
      pendingSectionCount: sections.filter((item) => item.status !== "COMPLETE").length,
      lastUpdatedAt,
      responsibleProfessional: collection.connectedProfessional.professionalName,
      masterRecordVersion: "Não informada pelo mock atual",
    };
  },
};
