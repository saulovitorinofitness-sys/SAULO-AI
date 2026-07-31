import type {
  MasterRecordCategory,
  MasterRecordModuleDefinition,
  MasterRecordModuleId,
  MasterRecordNavigationContext,
  ResolvedMasterRecordModule,
} from "./contracts";

export const MASTER_RECORD_CATEGORY_LABELS: Readonly<
  Record<MasterRecordCategory, string>
> = {
  GENERAL: "Geral",
  COLLECTION_HISTORY: "Coleta e histórico",
  ASSESSMENTS: "Avaliações",
  DECISION: "Decisão",
  PRESCRIPTIONS: "Prescrições",
  DOCUMENTS: "Documentos",
  ATHLETE_CONTEXT: "Contexto do atleta",
};

export const MASTER_RECORD_CATEGORY_ORDER: readonly MasterRecordCategory[] = [
  "GENERAL",
  "COLLECTION_HISTORY",
  "ASSESSMENTS",
  "DECISION",
  "PRESCRIPTIONS",
  "DOCUMENTS",
  "ATHLETE_CONTEXT",
];

export const MASTER_RECORD_MODULES: readonly MasterRecordModuleDefinition[] = [
  {
    id: "SUMMARY",
    cardId: "summary",
    label: "Resumo",
    description: "Visão central do Prontuário Mestre.",
    order: 1,
    category: "GENERAL",
    route: "PATIENT_ROOT",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "ANAMNESIS",
    cardId: "anamnesis",
    label: "Anamnese",
    description: "Histórico clínico compartilhado.",
    order: 2,
    category: "COLLECTION_HISTORY",
    route: "ANAMNESIS",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "PHYSICAL_ASSESSMENT",
    cardId: "physical",
    label: "Avaliação Física",
    description: "Avaliação física disponível na coleta integrada.",
    order: 3,
    category: "ASSESSMENTS",
    route: "PHYSICAL_STEP",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "POSTURAL_ASSESSMENT",
    cardId: "postural",
    label: "Avaliação Postural",
    description: "Módulo especializado com status independente da Nutrição.",
    order: 4,
    category: "ASSESSMENTS",
    route: "POSTURAL_STEP",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
    prerequisite: "Atendimento ativo",
  },
  {
    id: "ANTHROPOMETRY",
    cardId: "anthropometry",
    label: "Antropometria",
    description: "Medidas básicas vinculadas ao mesmo prontuário.",
    order: 5,
    category: "ASSESSMENTS",
    route: "ANTHROPOMETRY",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "PERIMETRY",
    cardId: "perimetry",
    label: "Perimetria",
    description: "Circunferências corporais separadas da composição corporal.",
    order: 6,
    category: "ASSESSMENTS",
    route: "PERIMETRY",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "BIOIMPEDANCE",
    cardId: "bioimpedance",
    label: "Bioimpedância",
    description: "Registro Avanutri separado da perimetria.",
    order: 7,
    category: "ASSESSMENTS",
    route: "BIOIMPEDANCE_STEP",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "LABORATORY_EXAMS",
    cardId: "exams",
    label: "Exames",
    description: "Exames organizados sem interpretação automática.",
    order: 8,
    category: "COLLECTION_HISTORY",
    route: "LABORATORY_EXAMS",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "CLINICAL_COLLECTION",
    cardId: "collection",
    label: "Coleta Clínica",
    description: "Fluxo integrado de coleta do atendimento.",
    order: 10,
    category: "COLLECTION_HISTORY",
    route: "COLLECTION",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
    prerequisite: "Atendimento ativo",
  },
  {
    id: "CLINICAL_ENGINE",
    cardId: "clinical-engine",
    label: "Motor Clínico",
    description: "Consolidação organizacional dos dados existentes.",
    order: 11,
    category: "DECISION",
    route: "CLINICAL_ENGINE",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "CLINICAL_PANEL",
    cardId: "panel",
    label: "Painel Clínico",
    description: "Revisão integrada dos dados coletados.",
    order: 12,
    category: "DECISION",
    route: "CLINICAL_PANEL",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
    prerequisite: "Coleta clínica concluída",
  },
  {
    id: "CLINICAL_DECISION",
    cardId: "decision",
    label: "Decisão Clínica",
    description: "Motor assistido com decisão final profissional.",
    order: 13,
    category: "DECISION",
    route: "CLINICAL_DECISION",
    audience: "AUTHORIZED_CLINICAL",
    future: false,
    hiddenWhenUnauthorized: true,
    requiredPermission: "CLINICAL_REASONING/READ",
    prerequisite: "Painel Clínico confirmado",
  },
  {
    id: "NUTRITION_STRATEGY",
    cardId: "nutrition-strategy",
    label: "Estratégia Nutricional",
    description: "Estratégia obrigatória antes do Plano Alimentar.",
    order: 14,
    category: "PRESCRIPTIONS",
    route: "NUTRITION_STRATEGY",
    audience: "NUTRITION",
    future: false,
    hiddenWhenUnauthorized: true,
    requiredPermission: "NUTRITION_STRATEGY/READ",
    prerequisite: "Decisão clínica registrada",
  },
  {
    id: "MEAL_PLAN",
    cardId: "meal-plan",
    label: "Plano Alimentar",
    description: "Estrutura exclusiva da Nutrição.",
    order: 15,
    category: "PRESCRIPTIONS",
    route: "MEAL_PLAN",
    audience: "NUTRITION",
    future: false,
    hiddenWhenUnauthorized: true,
    requiredPermission: "MEAL_PLAN/READ",
    prerequisite: "Estratégia Nutricional registrada",
  },
  {
    id: "TRAINING_PLAN",
    cardId: "training-plan",
    label: "Performance",
    description: "Prescrição profissional de treino vinculada ao atendimento.",
    order: 16,
    category: "PRESCRIPTIONS",
    route: "PERFORMANCE_ENDURANCE",
    audience: "SAULO_ATHLETE",
    future: false,
    hiddenWhenUnauthorized: true,
    prerequisite: "Atendimento ativo",
  },
  {
    id: "EVOLUTION",
    cardId: "evolution",
    label: "Evolução",
    description: "Domínio preparado; interface ainda não implementada.",
    order: 17,
    category: "GENERAL",
    route: "NONE",
    audience: "AUTHORIZED_CLINICAL",
    future: true,
    hiddenWhenUnauthorized: true,
  },
  {
    id: "DELIVERABLES",
    cardId: "deliverables",
    label: "Entregáveis",
    description: "Interface ainda não implementada.",
    order: 18,
    category: "DOCUMENTS",
    route: "NONE",
    audience: "AUTHORIZED_CLINICAL",
    future: true,
    hiddenWhenUnauthorized: true,
  },
];

export function getMasterRecordDefinition(id: MasterRecordModuleId) {
  return MASTER_RECORD_MODULES.find((module) => module.id === id);
}

function routeFor(
  module: MasterRecordModuleDefinition,
  context: MasterRecordNavigationContext,
): string | undefined {
  const patient = `/pacientes/${context.patientId}`;
  const attendanceId = context.attendance?.attendanceId;
  const scenarioQuery = `scenario=${encodeURIComponent(context.scenario)}`;

  const collection = attendanceId
    ? `${patient}/atendimentos/${attendanceId}/coleta?${scenarioQuery}`
    : undefined;

  const routes = {
    PATIENT_ROOT: `${patient}?${scenarioQuery}`,

    ANAMNESIS: `${patient}/anamnese?${scenarioQuery}`,

    PHYSICAL_STEP: collection
      ? `${collection}&step=ANTHROPOMETRY`
      : undefined,

    POSTURAL_STEP: collection
      ? `${collection}&step=POSTURAL_ASSESSMENT`
      : undefined,

    ANTHROPOMETRY: `${patient}/antropometria?${scenarioQuery}`,

    PERIMETRY: `${patient}/antropometria?${scenarioQuery}&module=perimetry#perimetry`,

    BIOIMPEDANCE_STEP: collection
      ? `${collection}&step=BIOIMPEDANCE`
      : undefined,

    LABORATORY_EXAMS: `${patient}/exames?${scenarioQuery}`,

    ATTENDANCE: `${patient}/continuar?${scenarioQuery}`,

    COLLECTION: collection
      ? `${collection}&step=SUMMARY`
      : undefined,

    CLINICAL_ENGINE: `${patient}/motor-clinico?${scenarioQuery}`,

    CLINICAL_PANEL:
      attendanceId && context.panelAccessible
        ? `${patient}/atendimentos/${attendanceId}/painel-clinico?${scenarioQuery}`
        : undefined,

    CLINICAL_DECISION:
      attendanceId && context.motorAvailable
        ? `${patient}/atendimentos/${attendanceId}/decisao-clinica?${scenarioQuery}`
        : undefined,

    NUTRITION_STRATEGY:
      context.showNutrition && context.motorAvailable
        ? `${patient}/estrategia-nutricional?${scenarioQuery}`
        : undefined,

    MEAL_PLAN:
      context.showNutrition && context.nutritionStrategyActive
        ? `${patient}/plano-alimentar?${scenarioQuery}`
        : undefined,

    PERFORMANCE_ENDURANCE:
      context.showPerformance && attendanceId
        ? `/performance-endurance?patientId=${encodeURIComponent(
            context.patientId,
          )}&attendanceId=${encodeURIComponent(
            attendanceId,
          )}&${scenarioQuery}`
        : undefined,

    NONE: undefined,
  } satisfies Record<
    MasterRecordModuleDefinition["route"],
    string | undefined
  >;

  return routes[module.route];
}

export function resolveMasterRecordModules(
  context: MasterRecordNavigationContext,
): readonly ResolvedMasterRecordModule[] {
  return MASTER_RECORD_MODULES.map((module) => {
    const authorized =
      module.audience === "AUTHORIZED_CLINICAL" ||
      (module.audience === "NUTRITION" && context.showNutrition) ||
      (module.audience === "SAULO_ATHLETE" && context.showPerformance);

    const visible = authorized || !module.hiddenWhenUnauthorized;
    const href = authorized ? routeFor(module, context) : undefined;

    let status: ResolvedMasterRecordModule["status"] = module.future
      ? "future"
      : href
        ? "available"
        : "blocked";

    let blockedReason: string | undefined;

    if (module.future) {
      blockedReason = module.description;
    } else if (!authorized) {
      status = "unavailable";
      blockedReason = "Sem permissão para este módulo.";
    } else if (!href) {
      blockedReason = module.prerequisite
        ? `Pré-condição: ${module.prerequisite}.`
        : "Rota indisponível no contexto atual.";
    }

    return {
      ...module,
      href,
      status,
      visible,
      blockedReason,
    };
  }).sort((left, right) => left.order - right.order);
}