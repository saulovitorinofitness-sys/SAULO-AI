import {
  CLINIC_INSTITUTIONAL_CONFIG,
  institutionalProfessionalFor,
} from "@/config/institution";
import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  parseStoredMealPlanPayload,
  type MealPlanRecordItem,
  type MealPlanRecordMeal,
} from "@/features/meal-plan/record";
import { calculateMealPlanNutritionTotals } from "@/features/meal-plan/nutrition-calculations";
import type { NutritionClinicalPanelView } from "@/features/nutrition-strategy/clinical-panel-contracts";
import {
  CLINICAL_PROTOCOL_OPTIONS,
  NUTRITION_METHOD_OPTIONS,
  NUTRITION_MODIFICATION_OPTIONS,
  resolveMealPlanObjective,
  type MealPlanStrategyInheritance,
} from "@/features/nutrition-strategy";
import { ENERGY_PROTOCOLS } from "@/lib/nutrition";
import {
  isTechnicalClinicalText,
  safeClinicalTexts,
} from "@/features/clinical-collection/clinical-text-safety";

import type {
  DeliverableExam,
  DeliverableFinding,
  DeliverableGuidance,
  DeliverableHerbalMedicine,
  DeliverableMealItem,
  DeliverablePlanRecipe,
  DeliverableSupplement,
  DeliverableSubstitution,
  NutritionDeliverableDraft,
} from "./contracts";
import { createShoppingList } from "./shopping-list";
import { persistedProfessionalReference } from "@/features/professional-responsibility/persisted-responsibility";
import { recipeContentPendings } from "@/features/recipes/recipe-content-snapshot";

const ATTENDANCE_TYPE_LABELS = {
  INITIAL: "Consulta inicial",
  FOLLOW_UP: "Retorno",
  PHYSICAL_ASSESSMENT: "Avaliação física",
  POSTURAL_ASSESSMENT: "Avaliação postural",
  TRAINING: "Treinamento",
  NUTRITION: "Consulta nutricional",
} as const;

const INSTITUTIONAL_WHATSAPP = "(88) 99999-1074";
const INSTITUTIONAL_WHATSAPP_E164 = "5588999991074";
const INSTITUTIONAL_WEBSITE = "www.saulovitorino.com.br";

async function getApprovedPlanSnapshot(
  patientId: string,
  attendanceId: string,
  source?: { readonly entryId: string; readonly versionId: string },
) {
  const { prisma } = await import("@/lib/database/prisma");
  const entry = await prisma.masterRecordEntry.findFirst({
    where: {
      type: "MEAL_PLAN",
      ...(source ? { id: source.entryId } : {}),
      attendanceId,
      status: "FINALIZED",
      deletedAt: null,
      masterRecord: { patientId, status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      attendanceId: true,
      updatedAt: true,
      updatedBy: { select: { id: true, fullName: true } },
      mealPlan: { select: { entryId: true } },
    },
  });
  if (!entry?.attendanceId || !entry.mealPlan) return null;
  const responsibleVersion = await prisma.recordVersion.findFirst({
    where: {
      entityType: "MEAL_PLAN",
      entityId: entry.id,
      ...(source ? { id: source.versionId } : {}),
      status: "FINALIZED",
    },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      responsible: { select: { id: true, fullName: true } },
      snapshot: true,
      createdAt: true,
    },
  });
  if (!responsibleVersion) return null;
  const content = parseStoredMealPlanPayload(responsibleVersion.snapshot);
  if (!content || content.status !== "APPROVED") return null;
  const responsible = persistedProfessionalReference(
    responsibleVersion?.responsible,
    entry.updatedBy,
  );
  return {
    id: entry.id,
    sourceVersionId: responsibleVersion.id,
    sourceVersion: responsibleVersion.version,
    patientId,
    attendanceId: entry.attendanceId,
    status: "APPROVED" as const,
    responsibleUserId: responsible.id,
    responsibleProfessional: responsible.fullName,
    updatedAt: responsibleVersion.createdAt.toISOString(),
    strategyEntryId: content.strategyEntryId,
    strategySnapshot: content.strategySnapshot,
    meals: content.meals,
    nutritionTotals: {
      ...calculateMealPlanNutritionTotals(content.meals),
      values: content.totals,
    },
    targetDeviationAuthorized: Boolean(content.targetDeviationAuthorization),
  };
}

async function getDraftPlanSnapshot(
  patientId: string,
  attendanceId: string,
  entryId: string,
) {
  const { prisma } = await import("@/lib/database/prisma");
  const entry = await prisma.masterRecordEntry.findFirst({
    where: {
      id: entryId,
      type: "MEAL_PLAN",
      attendanceId,
      status: "DRAFT",
      deletedAt: null,
      masterRecord: { patientId, status: "ACTIVE" },
    },
    select: {
      id: true,
      attendanceId: true,
      revision: true,
      updatedAt: true,
      updatedBy: { select: { id: true, fullName: true } },
      mealPlan: { select: { content: true } },
    },
  });
  if (!entry?.attendanceId || !entry.mealPlan) return null;
  const content = parseStoredMealPlanPayload(entry.mealPlan.content);
  if (!content || content.status !== "DRAFT") return null;
  return {
    id: entry.id,
    sourceVersion: entry.revision,
    patientId,
    attendanceId: entry.attendanceId,
    status: "DRAFT" as const,
    responsibleUserId: entry.updatedBy.id,
    responsibleProfessional: entry.updatedBy.fullName,
    updatedAt: entry.updatedAt.toISOString(),
    strategyEntryId: content.strategyEntryId,
    strategySnapshot: content.strategySnapshot,
    meals: content.meals,
    nutritionTotals: {
      ...calculateMealPlanNutritionTotals(content.meals),
      values: content.totals,
    },
    targetDeviationAuthorized: Boolean(content.targetDeviationAuthorization),
  };
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

function sentenceList(values: readonly string[]) {
  return safeClinicalTexts(values)
    .map((value) => value.replace(/[.!?]+$/g, ""))
    .join(", ");
}


function normalizeClinicalText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isAdministrativeDecisionSupportText(value: string) {
  const normalized = normalizeClinicalText(value);
  return [
    "nao pertence ao atendimento atual",
    "nao foi consolidada",
    "sem data vinculada ao atendimento atual",
    "pertence a outro prontuario mestre",
    "avaliacao antropometrica disponivel",
    "registro de bioimpedancia vinculado",
    "dados antropometricos disponiveis",
    "avaliacao disponivel no prontuario",
  ].some((fragment) => normalized.includes(fragment));
}

function clinicalDecisionSupportTexts(values: readonly string[]) {
  return safeClinicalTexts(values).filter(
    (value) =>
      !isTechnicalClinicalText(value) &&
      !isAdministrativeDecisionSupportText(value),
  );
}

function administrativeDecisionSupportTexts(panel: NutritionClinicalPanelView) {
  return safeClinicalTexts([
    ...panel.decisionSupport.positivePoints,
    ...panel.decisionSupport.attentionPoints,
  ]).filter(isAdministrativeDecisionSupportText);
}

function nutritionMethodLabel(strategy: MealPlanStrategyInheritance) {
  return (
    NUTRITION_METHOD_OPTIONS.find(([code]) => code === strategy.method)?.[1] ??
    strategy.method
  );
}

export function resolveDeliverableStrategy(
  plan:
    | {
        readonly strategyEntryId?: string;
        readonly strategySnapshot?: MealPlanStrategyInheritance;
      }
    | null,
  currentStrategy: MealPlanStrategyInheritance | null,
) {
  if (plan?.strategySnapshot) return plan.strategySnapshot;
  if (!plan) return currentStrategy ?? undefined;
  return plan.strategyEntryId === currentStrategy?.sourceStrategyId
    ? currentStrategy
    : undefined;
}

function uniqueClinicalTexts(values: readonly (string | undefined)[]) {
  const unique = new Map<string, string>();

  for (const value of values) {
    const content = value?.trim();
    if (!content || isTechnicalClinicalText(content)) continue;

    const normalized = normalizeClinicalText(content);
    if (!normalized || unique.has(normalized)) continue;

    unique.set(normalized, content);
  }

  return [...unique.values()];
}

function createInterpretiveGuidance(
  panel: NutritionClinicalPanelView,
  strategy?: MealPlanStrategyInheritance,
  plan?: {
    readonly status: "DRAFT" | "APPROVED";
    readonly meals: readonly MealPlanRecordMeal[];
    readonly nutritionTotals?: ReturnType<typeof calculateMealPlanNutritionTotals>;
    readonly targetDeviationAuthorized?: boolean;
  },
): NutritionDeliverableDraft["guidance"] {
  const guidance: DeliverableGuidance[] = [];

  const add = (category: string, paragraphs: readonly (string | undefined)[]) => {
    const content = uniqueClinicalTexts(paragraphs).join("\n\n");
    if (!content) return;

    guidance.push({
      id: `guidance:${guidance.length + 1}`,
      category,
      content,
      approved: true,
    });
  };

  const diagnoses = safeClinicalTexts(
    panel.inheritedClinicalContext.diagnoses,
  ).filter((value) => !isTechnicalClinicalText(value));
  const positivePoints = clinicalDecisionSupportTexts(
    panel.decisionSupport.positivePoints,
  );
  const attentionPoints = clinicalDecisionSupportTexts(
    panel.decisionSupport.attentionPoints,
  );
  const laboratoryExams = safeClinicalTexts(
    panel.inheritedClinicalContext.laboratoryExams,
  ).filter((value) => !isTechnicalClinicalText(value));
  const restrictions = safeClinicalTexts(
    panel.inheritedClinicalContext.restrictions,
  ).filter((value) => !isTechnicalClinicalText(value));
  const allergies = safeClinicalTexts(
    panel.inheritedClinicalContext.allergies,
  ).filter((value) => !isTechnicalClinicalText(value));

  const clinicalContext = normalizeClinicalText(
    [...diagnoses, ...attentionPoints, ...laboratoryExams].join(" "),
  );

  const has = (...terms: readonly string[]) =>
    terms.some((term) =>
      clinicalContext.includes(normalizeClinicalText(term)),
    );

  const approvedModifications = (strategy?.modifications ?? []).map(
    (code) =>
      NUTRITION_MODIFICATION_OPTIONS.find(([option]) => option === code)?.[1] ??
      code,
  );
  const approvedClinicalProtocols = (strategy?.clinicalProtocols ?? []).map(
    (code) =>
      CLINICAL_PROTOCOL_OPTIONS.find(([option]) => option === code)?.[1] ??
      code,
  );
  const resolvedObjective = strategy
    ? resolveMealPlanObjective(strategy).label
    : undefined;
  const methodLabel = strategy ? nutritionMethodLabel(strategy) : undefined;
  const hasFluidRestriction = Boolean(
    strategy?.modifications?.includes("FLUID_RESTRICTION"),
  );
  const hasPlanRecipe = Boolean(
    plan?.meals.some((meal) => meal.items.some(isMealPlanRecipeItem)),
  );
  const hasRegisteredSubstitutions = Boolean(
    plan?.meals.some((meal) =>
      meal.items.some(
        (item) =>
          isMealPlanFoodItem(item) && Boolean(item.substitutions?.length),
      ),
    ),
  );
  const planStageLabel = plan?.status === "DRAFT"
    ? "rascunho salvo e reaberto"
    : "plano concluído";
  const planStageWithPreposition = plan?.status === "DRAFT"
    ? "no rascunho salvo e reaberto"
    : "na versão concluída";

  add("Objetivo e estratégia aprovados", [
    resolvedObjective && methodLabel
      ? `O objetivo registrado para este plano é ${resolvedObjective.toLocaleLowerCase("pt-BR")}. A estratégia aprovada para organizá-lo é ${methodLabel.toLocaleLowerCase("pt-BR")}.`
      : undefined,
    strategy && plan
      ? `O ${planStageLabel} distribui os alimentos em ${plan.meals.length} refeições. Essa organização e as quantidades impressas correspondem a esse ${planStageLabel}.`
      : undefined,
  ]);

  add("Conduta nutricional registrada", [
    approvedModifications.length
      ? `Seleções técnicas registradas na Estratégia Nutricional: ${approvedModifications.join(
          "; ",
        )}. Elas documentam decisões profissionais da estratégia e não acrescentam, isoladamente, uma nova orientação à paciente.`
      : undefined,
    approvedClinicalProtocols.length
      ? `Protocolos clínicos selecionados pelo profissional: ${approvedClinicalProtocols.join(
          "; ",
        )}. Essas seleções orientam a estratégia e não constituem diagnóstico clínico.`
      : undefined,
    strategy?.secondaryObjectives.length
      ? `Objetivos complementares registrados: ${strategy.secondaryObjectives.join(
          "; ",
        )}.`
      : undefined,
  ]);

  const hasRenalCondition = has(
    "doenca renal",
    "insuficiencia renal",
    "doenca renal cronica",
    "drc",
  );

  const approvedTotals = plan?.nutritionTotals?.values;
  const strategyAndPlanSummary = strategy && approvedTotals
    ? `Referência aprovada da estratégia: ${formatNumber(strategy.caloriesKcal, 2)} kcal, com ${formatNumber(strategy.proteinGrams, 2)} g de proteínas, ${formatNumber(strategy.carbohydratesGrams, 2)} g de carboidratos e ${formatNumber(strategy.fatsGrams, 2)} g de gorduras. Valores planejados ${planStageWithPreposition}: ${formatNumber(approvedTotals.energyKcal, 2)} kcal, ${formatNumber(approvedTotals.proteinGrams, 2)} g de proteínas, ${formatNumber(approvedTotals.carbohydratesGrams, 2)} g de carboidratos e ${formatNumber(approvedTotals.fatsGrams, 2)} g de gorduras. Esses valores descrevem o planejamento do plano, não o consumo efetivamente realizado.`
    : undefined;
  const strategyDiffersFromPlan = Boolean(
    strategy &&
      approvedTotals &&
      (
        strategy.caloriesKcal !== approvedTotals.energyKcal ||
        strategy.proteinGrams !== approvedTotals.proteinGrams ||
        strategy.carbohydratesGrams !== approvedTotals.carbohydratesGrams ||
        strategy.fatsGrams !== approvedTotals.fatsGrams
      ),
  );
  const fiberSummary = strategy && approvedTotals
    ? `Fibras: a meta registrada na estratégia é ${formatNumber(strategy.fiberGrams, 2)} g por dia. O plano soma ${formatNumber(approvedTotals.fiberGrams, 2)} g conhecidos${plan?.nutritionTotals?.nutritionCompleteness === "PARTIAL" ? ", mas esse número é um subtotal parcial porque alguns alimentos não possuem composição nutricional completa; ele não permite concluir, sozinho, que houve excesso ou insuficiência" : ""}.`
    : undefined;

  add("Metas e valores planejados", [
    strategy
      ? `A meta energética de ${formatNumber(strategy.caloriesKcal, 2)} kcal foi registrada após um ajuste de ${formatNumber(strategy.calorieAdjustmentPercentage, 2)}% sobre o gasto energético total estimado de ${formatNumber(strategy.totalEnergyExpenditureKcal, 2)} kcal.`
      : undefined,
    strategyAndPlanSummary,
    strategyDiffersFromPlan && plan?.status === "APPROVED" && plan.targetDeviationAuthorized
      ? "Há diferenças entre a referência da estratégia e os valores do plano concluído. A manutenção desses valores foi uma decisão profissional registrada na finalização do plano; o relatório não os classifica automaticamente como erro ou problema."
      : strategyDiffersFromPlan
        ? `Há diferenças entre a referência da estratégia e os valores ${planStageWithPreposition}. O relatório apenas apresenta essa comparação, sem classificá-la automaticamente como erro ou problema.`
      : undefined,
  ]);

  add("Fibras e hidratação", [
    fiberSummary,
    hasFluidRestriction
      ? "Origem da expressão “Restrição hídrica”: ela foi selecionada como modificação técnica na Estratégia Nutricional aprovada. Nesse formulário, a seleção indica que qualquer volume deve ser individualizado e informado pelo profissional; por si só, ela não define um volume nem acrescenta uma orientação à paciente."
      : undefined,
    strategy?.waterMl
      ? `Origem dos ${formatNumber(strategy.waterMl, 0)} ml: o valor foi registrado no campo de meta hídrica da mesma Estratégia Nutricional aprovada${hasFluidRestriction ? ", no qual a meta individual é preenchida manualmente" : ""}. Ele representa uma meta registrada, não o consumo de água efetivamente realizado.`
      : undefined,
    strategy
      ? "O Plano Alimentar não calcula nem registra automaticamente a água consumida. Consumo efetivo só pode ser apresentado quando houver um registro específico feito pela paciente ou pelo profissional."
      : undefined,
  ]);

  add("Pontos positivos identificados", [
    positivePoints.length
      ? `Aspectos concretos registrados no atendimento: ${sentenceList(
          positivePoints,
        )}.`
      : undefined,
  ]);

  add("Pontos que necessitam correção", [
    attentionPoints.length
      ? `As prioridades de correção registradas são: ${sentenceList(
          attentionPoints,
        )}. Cada uma deve ser acompanhada no retorno para verificar adesão, tolerância e resposta clínica.`
      : undefined,
    restrictions.length
      ? `As restrições alimentares registradas — ${sentenceList(
          restrictions,
        )} — precisam ser respeitadas durante todas as substituições do plano.`
      : undefined,
    allergies.length
      ? `As alergias registradas — ${sentenceList(
          allergies,
        )} — exigem exclusão rigorosa dos respectivos alimentos e ingredientes.`
      : undefined,
  ]);

  const foodsToReduce: string[] = [];

  if (
    has(
      "diabetes",
      "resistencia insulinica",
      "hiperglicemia",
      "glicemia elevada",
      "pre diabetes",
      "prediabetes",
    )
  ) {
    foodsToReduce.push(
      "Reduzir bebidas açucaradas, doces, açúcares adicionados e excesso de carboidratos refinados, porque elevam rapidamente a carga glicêmica e dificultam o controle da glicose.",
    );
  }

  if (has("hipertensao", "pressao alta", "has")) {
    foodsToReduce.push(
      "Reduzir sal de adição, temperos prontos, embutidos, enlatados e ultraprocessados ricos em sódio, pois o excesso de sódio prejudica o controle da pressão arterial.",
    );
  }

  if (
    has(
      "esteatose",
      "figado gorduroso",
      "doenca hepatica gordurosa",
      "masld",
    )
  ) {
    foodsToReduce.push(
      "Reduzir bebidas açucaradas, excesso de açúcar, frituras, carnes muito gordurosas e alimentos ultraprocessados, porque favorecem maior aporte energético, acúmulo de gordura hepática e piora metabólica.",
      "Evitar bebidas alcoólicas durante o tratamento, pois o álcool aumenta a sobrecarga hepática e interfere na recuperação do fígado.",
    );
  }

  if (
    has(
      "dislipidemia",
      "colesterol elevado",
      "triglicerides elevados",
      "hipertrigliceridemia",
    )
  ) {
    foodsToReduce.push(
      "Reduzir frituras, embutidos, carnes com excesso de gordura, produtos com gordura trans e consumo frequente de ultraprocessados, pois essas escolhas podem agravar o perfil lipídico.",
    );
  }

  if (has("obesidade", "sobrepeso", "excesso de peso")) {
    foodsToReduce.push(
      "Reduzir alimentos ultraprocessados de alta densidade energética, porções excessivas e bebidas calóricas, porque dificultam o déficit energético necessário para a redução de gordura corporal.",
    );
  }

  if (has("intolerancia a lactose", "lactose")) {
    foodsToReduce.push(
      "Reduzir ou substituir alimentos com lactose conforme a tolerância individual e os sintomas registrados, utilizando versões sem lactose quando necessário.",
    );
  }

  if (has("doenca celiaca", "celiaca", "celiaco")) {
    foodsToReduce.push(
      "Excluir alimentos que contenham glúten e prevenir contaminação cruzada, conforme a condição clínica registrada.",
    );
  }

  if (has("diarreia")) {
    foodsToReduce.push(
      "Durante episódios de diarreia, reduzir frituras, excesso de gorduras e alimentos individualmente associados à piora dos sintomas, observando tolerância e frequência intestinal.",
    );
  }

  add("Alimentos que devem ser reduzidos ou retirados", []);

  const foodsToPrioritize: string[] = [];

  if (
    has(
      "diabetes",
      "resistencia insulinica",
      "hiperglicemia",
      "glicemia elevada",
      "pre diabetes",
      "prediabetes",
    )
  ) {
    foodsToPrioritize.push(
      "Priorizar verduras, legumes, feijões, alimentos fontes de fibras e proteínas magras nas refeições, pois essa combinação favorece maior saciedade e resposta glicêmica mais estável.",
    );
  }

  if (has("hipertensao", "pressao alta", "has")) {
    foodsToPrioritize.push(
      hasRenalCondition
        ? "Priorizar alimentos in natura e preparações com pouco sal, mantendo qualquer ajuste de minerais condicionado à avaliação da função renal."
        : "Priorizar alimentos in natura, frutas, verduras, legumes e preparações com pouco sal, contribuindo para melhor qualidade alimentar e controle do sódio.",
    );
  }

  if (
    has(
      "esteatose",
      "figado gorduroso",
      "doenca hepatica gordurosa",
      "masld",
    )
  ) {
    foodsToPrioritize.push(
      "Priorizar vegetais, frutas em porções adequadas, feijões, cereais integrais, proteínas magras e fontes de gorduras insaturadas em quantidades planejadas, favorecendo saciedade, controle energético e melhora metabólica.",
    );
  }

  if (
    has(
      "dislipidemia",
      "colesterol elevado",
      "triglicerides elevados",
      "hipertrigliceridemia",
    )
  ) {
    foodsToPrioritize.push(
      "Priorizar fibras solúveis presentes em aveia, feijões, frutas e hortaliças, além de proteínas magras e fontes de gorduras insaturadas previstas no plano, pois auxiliam no manejo do perfil lipídico.",
    );
  }

  if (has("obesidade", "sobrepeso", "excesso de peso")) {
    foodsToPrioritize.push(
      "Priorizar alimentos minimamente processados, vegetais, feijões e proteínas magras, pois aumentam saciedade e facilitam o controle das porções dentro do VET prescrito.",
    );
  }

  if (has("constipacao", "prisao de ventre", "intestino preso")) {
    foodsToPrioritize.push(
      "Priorizar fibras alimentares e água conforme a meta prescrita, aumentando a ingestão de forma progressiva para favorecer o funcionamento intestinal.",
    );
  }

  add("Alimentos que devem ser priorizados", []);

  add("Acompanhamento e reavaliação", [
    plan
      ? `No retorno, poderá ser conferido como foi a execução das ${plan.meals.length} refeições planejadas, incluindo horários e quantidades${hasPlanRecipe ? ", além do preparo da receita" : ""}${hasRegisteredSubstitutions ? " e do uso das substituições registradas" : ""}.`
      : undefined,
    "Também poderão ser registrados a facilidade ou dificuldade para seguir a organização do plano e os dados que a paciente e o profissional efetivamente trouxerem para o atendimento.",
    strategy
      ? `Se houver novo registro, poderão ser comparados o consumo de água informado e as medidas refeitas pelo profissional com a meta hídrica e o objetivo de ${resolveMealPlanObjective(strategy).label.toLocaleLowerCase("pt-BR")}. O documento não presume resultados, diagnóstico, prazo ou necessidade de ajuste.`
      : "O documento não presume resultados, diagnóstico, prazo ou necessidade de ajuste.",
  ]);

  return guidance;
}


function createClinicalDiagnosis(panel: NutritionClinicalPanelView) {
  if (
    panel.inheritedClinicalContext.diagnosisReview?.outcome ===
    "NO_DIAGNOSIS_ESTABLISHED"
  ) {
    return {
      reviewOutcome: "NO_DIAGNOSIS_ESTABLISHED" as const,
      content: "",
      sections: [],
      sourceReferences: [],
    };
  }

  const sections: {
    id: string;
    title: string;
    content: string;
    sourceReferences: string[];
    editable: boolean;
  }[] = [];

  const addSection = (input: {
    id: string;
    title: string;
    content?: string;
    sourceReferences: string[];
    editable?: boolean;
  }) => {
    const content = input.content?.trim();
    if (!content) return;

    sections.push({
      id: input.id,
      title: input.title,
      content,
      sourceReferences: input.sourceReferences,
      editable: input.editable ?? false,
    });
  };

  const diagnoses = sentenceList(panel.inheritedClinicalContext.diagnoses);
  addSection({
    id: "clinical-conditions",
    title: "Condições clínicas registradas",
    content: diagnoses,
    sourceReferences: [
      panel.inheritedClinicalContext.diagnosisReview
        ? "Revisão profissional do diagnóstico"
        : "Anamnese",
    ],
  });

  const allergies = sentenceList(panel.inheritedClinicalContext.allergies);
  addSection({
    id: "allergies",
    title: "Alergias registradas",
    content: allergies,
    sourceReferences: ["Anamnese"],
  });

  const restrictions = sentenceList(
    panel.inheritedClinicalContext.restrictions,
  );
  addSection({
    id: "restrictions",
    title: "Restrições alimentares registradas",
    content: restrictions,
    sourceReferences: ["Anamnese"],
  });

  const medications = sentenceList(
    panel.inheritedClinicalContext.medications,
  );
  addSection({
    id: "medications",
    title: "Medicamentos informados em uso",
    content: medications,
    sourceReferences: ["Anamnese"],
  });

  const supplements = sentenceList(
    panel.inheritedClinicalContext.supplements,
  );
  addSection({
    id: "supplements-in-use",
    title: "Suplementos informados em uso",
    content: supplements,
    sourceReferences: ["Anamnese"],
  });

  const laboratoryExams = sentenceList(
    panel.inheritedClinicalContext.laboratoryExams,
  );
  addSection({
    id: "laboratory-exams",
    title: "Exames laboratoriais avaliados",
    content: laboratoryExams,
    sourceReferences: ["Exames"],
  });

  const positivePoints = sentenceList(
    clinicalDecisionSupportTexts(panel.decisionSupport.positivePoints),
  );
  addSection({
    id: "positive-points",
    title: "Aspectos favoráveis identificados",
    content: positivePoints,
    sourceReferences: ["Painel Clínico"],
  });

  const attentionPoints = sentenceList(
    clinicalDecisionSupportTexts(panel.decisionSupport.attentionPoints),
  );
  addSection({
    id: "attention-points",
    title: "Prioridades de acompanhamento",
    content: attentionPoints,
    sourceReferences: ["Diagnóstico Nutricional"],
    editable: true,
  });

  const sourceReferences = Array.from(
    new Set(sections.flatMap((section) => section.sourceReferences)),
  );

  return {
    reviewOutcome: panel.inheritedClinicalContext.diagnosisReview?.outcome,
    content: sections
      .map((section) => `${section.title}\n${section.content}`)
      .join("\n\n"),
    sections,
    sourceReferences,
  };
}

function createFindings(panel: NutritionClinicalPanelView) {
  const findings: DeliverableFinding[] = [];

  const add = (
    category: DeliverableFinding["category"],
    description: string | undefined,
    sourceReference: string,
  ) => {
    if (!description?.trim() || isTechnicalClinicalText(description)) return;

    findings.push({
      id: `finding:${findings.length + 1}`,
      category,
      description,
      sourceReference,
    });
  };

  const anthropometry = [
    panel.anthropometry.weightKg != null
      ? `Peso: ${formatNumber(panel.anthropometry.weightKg)} kg`
      : undefined,
    panel.anthropometry.heightCm != null
      ? `Altura: ${formatNumber(panel.anthropometry.heightCm, 1)} cm`
      : undefined,
    panel.anthropometry.bmi != null
      ? `IMC: ${formatNumber(panel.anthropometry.bmi)}${
          panel.anthropometry.bmiClassification
            ? ` — ${panel.anthropometry.bmiClassification}`
            : ""
        }`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  add(
    "Antropometria",
    anthropometry.length ? anthropometry.join("\n") : undefined,
    "Antropometria",
  );

  const perimetryByRegion = [
    {
      region: "TRUNK",
      category: "Perimetria — Tronco",
    },
    {
      region: "UPPER_LIMBS",
      category: "Perimetria — Membros superiores",
    },
    {
      region: "LOWER_LIMBS",
      category: "Perimetria — Membros inferiores",
    },
  ] as const;

  for (const group of perimetryByRegion) {
    const measurements = panel.perimetry.measurements.flatMap((measurement) =>
      measurement.region === group.region &&
      measurement.valueCm != null &&
      !measurement.notPerformed
        ? [`${measurement.label}: ${formatNumber(measurement.valueCm, 1)} cm`]
        : [],
    );

    add(
      group.category,
      measurements.length ? measurements.join("\n") : undefined,
      "Perimetria",
    );
  }

  const bodyComposition = [
    panel.bioimpedance.bodyFatPercent != null
      ? `Gordura corporal: ${formatNumber(
          panel.bioimpedance.bodyFatPercent,
        )}%`
      : undefined,
    panel.bioimpedance.fatMassKg != null
      ? `Massa gorda: ${formatNumber(panel.bioimpedance.fatMassKg)} kg`
      : undefined,
    panel.bioimpedance.skeletalMuscleMassKg != null
      ? `Massa muscular: ${formatNumber(
          panel.bioimpedance.skeletalMuscleMassKg,
        )} kg`
      : undefined,
    panel.bioimpedance.fatFreeMassKg != null
      ? `Massa livre de gordura: ${formatNumber(
          panel.bioimpedance.fatFreeMassKg,
        )} kg`
      : undefined,
    panel.bioimpedance.totalBodyWaterL != null
      ? `Água corporal: ${formatNumber(
          panel.bioimpedance.totalBodyWaterL,
        )} L`
      : undefined,
    panel.bioimpedance.visceralFatLevel != null
      ? `Gordura visceral: ${formatNumber(
          panel.bioimpedance.visceralFatLevel,
        )}`
      : undefined,
    panel.bioimpedance.basalMetabolicRateKcal != null
      ? `Taxa metabólica basal: ${formatNumber(
          panel.bioimpedance.basalMetabolicRateKcal,
          0,
        )} kcal`
      : undefined,
    panel.bioimpedance.metabolicAgeYears != null
      ? `Idade metabólica: ${formatNumber(
          panel.bioimpedance.metabolicAgeYears,
          0,
        )} anos`
      : undefined,
    panel.bioimpedance.phaseAngleDegrees != null
      ? `Ângulo de fase: ${formatNumber(
          panel.bioimpedance.phaseAngleDegrees,
          1,
        )}°`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  add(
    "Bioimpedância",
    bodyComposition.length ? bodyComposition.join("\n") : undefined,
    "Bioimpedância",
  );

  for (const item of clinicalDecisionSupportTexts(
    panel.decisionSupport.attentionPoints,
  )) {
    add(
      "Prioridades de intervenção",
      item,
      "Painel Clínico",
    );
  }

  for (const item of panel.inheritedClinicalContext.laboratoryExams) {
    add("Exames", item, "Exames");
  }

  return findings;
}

function createSubstitutions(meals: readonly MealPlanRecordMeal[]) {
  const describeQuantity = (input: {
    readonly description: string;
    readonly amount?: number;
    readonly unit?: string;
    readonly quantity?: number;
    readonly measure?: string;
  }) => {
    const directAmount =
      input.amount !== undefined && input.unit
        ? `${formatNumber(input.amount, 2)} ${input.unit}`
        : undefined;
    const household =
      input.quantity !== undefined && input.measure
        ? `${formatNumber(input.quantity, 2)} × ${input.measure}`
        : undefined;
    const quantity = household && directAmount
      ? `${household} — ${directAmount}`
      : household ?? directAmount;
    return quantity ? `${input.description} — ${quantity}` : input.description;
  };
  const grouped = new Map<string, DeliverableSubstitution>();
  for (const meal of meals) {
    for (const food of meal.items) {
      if (!isMealPlanFoodItem(food)) continue;
      const selectedMeasure = food.selectedIbgeMeasureId
        ? food.ibgeMeasureOptions?.find(
            (option) => option.id === food.selectedIbgeMeasureId,
          )
        : undefined;
      for (const substitution of food.substitutions) {
        if (substitution.needsProfessionalReview) continue;
        const key = `${meal.id}:${substitution.replacedFoodId}`;
        const current = grouped.get(key);
        grouped.set(key, {
          id: current?.id ?? `substitution:${key}`,
          mealName: meal.name,
          prescribedFood: describeQuantity({
            description: substitution.replacedDescription,
            amount: substitution.originalPrescribedAmount,
            unit: substitution.originalPrescribedUnit,
            quantity: selectedMeasure ? food.quantity : undefined,
            measure: selectedMeasure?.label,
          }),
          approvedOptions: Array.from(
            new Set([
              ...(current?.approvedOptions ?? []),
              describeQuantity({
                description: substitution.replacementDescription,
                amount: substitution.replacementPrescribedAmount,
                unit: substitution.replacementPrescribedUnit,
                quantity: substitution.replacementQuantity,
                measure: substitution.replacementHouseholdMeasure,
              }),
            ]),
          ),
        });
      }
    }
  }
  return [...grouped.values()];
}

function createDeliverableMealItem(
  item: MealPlanRecordItem,
): DeliverableMealItem {
  if (!isMealPlanFoodItem(item)) {
    return {
      itemType: "RECIPE",
      id: item.id,
      recipeId: item.recipeId,
      recipeTitle: item.recipeTitle,
      recipeNutritionSnapshotId: item.recipeNutritionSnapshotId,
      recipeNutritionSnapshotVersion: item.recipeNutritionSnapshotVersion,
      portion: item.portion,
      nutritionCompleteness: item.nutritionCompleteness,
      snapshotNutrients: item.snapshotNutrients,
      prescribedNutrients: item.prescribedNutrients,
      missingNutrients: item.missingNutrients,
    };
  }
  const selectedMeasure = item.selectedIbgeMeasureId
    ? item.ibgeMeasureOptions?.find(
        (option) => option.id === item.selectedIbgeMeasureId,
      )
    : undefined;
  return {
    itemType: "FOOD",
    id: item.id,
    catalogFoodId: item.catalogFoodId,
    name: item.description,
    householdMeasure: item.householdMeasure,
    quantity: item.quantity,
    prescribedAmount: item.prescribedAmount ?? item.grams,
    prescribedUnit: item.prescribedUnit ?? "g",
    nutritionSourceName: item.sourceName,
    nutritionReferenceMeasure: item.primaryHouseholdMeasure,
    selectedMeasure: selectedMeasure
      ? {
          label: selectedMeasure.measureName,
          preparationName: selectedMeasure.preparationName || undefined,
          amountPerMeasure: selectedMeasure.amountPerMeasure,
          unit: selectedMeasure.unit,
        }
      : undefined,
    substitutions: item.substitutions
      .filter((substitution) => !substitution.needsProfessionalReview)
      .map((substitution) => ({
        id: substitution.id,
        name: substitution.replacementDescription,
        prescribedAmount: substitution.replacementPrescribedAmount,
        prescribedUnit: substitution.replacementPrescribedUnit,
        quantity: substitution.replacementQuantity,
        householdMeasure: substitution.replacementHouseholdMeasure,
      })),
  };
}

function createDeliverablePlanRecipes(
  meals: readonly MealPlanRecordMeal[],
): readonly DeliverablePlanRecipe[] {
  const recipes = new Map<string, DeliverablePlanRecipe>();
  for (const meal of meals) {
    for (const item of meal.items.filter(isMealPlanRecipeItem)) {
      const key = `${item.recipeId}:${item.recipeNutritionSnapshotId}`;
      if (recipes.has(key)) continue;
      recipes.set(key, {
        recipeId: item.recipeId,
        recipeTitle: item.recipeTitle,
        recipeNutritionSnapshotId: item.recipeNutritionSnapshotId,
        recipeNutritionSnapshotVersion: item.recipeNutritionSnapshotVersion,
        ...(item.recipeContentSnapshot
          ? { contentSnapshot: item.recipeContentSnapshot }
          : {}),
        contentPendings: recipeContentPendings(item.recipeContentSnapshot),
      });
    }
  }
  return [...recipes.values()];
}

function prescriptionUnitWarnings(meals: readonly MealPlanRecordMeal[]) {
  return meals.flatMap((meal) =>
    meal.items.flatMap((item) => {
      if (!isMealPlanFoodItem(item)) return [];
      const referenceUnit = item.primaryHouseholdMeasure
        .trim()
        .match(/\b(ml|g)\b/i)?.[1]
        ?.toLocaleLowerCase("pt-BR");
      const prescribedUnit = item.prescribedUnit ?? "g";
      if (!referenceUnit || referenceUnit === prescribedUnit) return [];
      return [
        `${item.description}: a prescrição salva está em ${prescribedUnit}, enquanto a referência nutricional registrada é “${item.primaryHouseholdMeasure}”. Sem uma conversão selecionada no plano, a unidade original foi mantida.`,
      ];
    }),
  );
}


function createSupplementDrafts(
  panel: NutritionClinicalPanelView,
): DeliverableSupplement[] {
  return safeClinicalTexts(
    panel.inheritedClinicalContext.supplements,
  ).map((name, index) => ({
    id: `supplement:anamnesis:${index + 1}`,
    name,
    dose: "",
    schedule: "",
    status: "DRAFT",
    approved: false,
    sourceReference: "Anamnese",
  }));
}

function createExamDrafts(
  panel: NutritionClinicalPanelView,
): DeliverableExam[] {
  return safeClinicalTexts(
    panel.inheritedClinicalContext.laboratoryExams,
  ).map((name, index) => ({
    id: `exam:clinical-context:${index + 1}`,
    name,
    kind: "EVALUATED",
    status: "NOT_CLASSIFIED",
    approved: false,
    sourceReference: "Exames",
  }));
}

export function buildNutritionDeliverableDraft(input: {
  readonly panel: NutritionClinicalPanelView;
  readonly strategy?: MealPlanStrategyInheritance;
  readonly plan?: {
    readonly id: string;
    readonly patientId: string;
    readonly attendanceId: string;
    readonly status: "DRAFT" | "APPROVED";
    readonly responsibleUserId?: string;
    readonly responsibleProfessional: string;
    readonly updatedAt: string;
    readonly strategyEntryId?: string;
    readonly strategySnapshot?: MealPlanStrategyInheritance;
    readonly meals: readonly MealPlanRecordMeal[];
    readonly nutritionTotals?: ReturnType<typeof calculateMealPlanNutritionTotals>;
    readonly targetDeviationAuthorized?: boolean;
  };
  readonly patientId?: string;
  readonly attendanceId?: string;
  readonly responsibleUserId?: string;
  readonly responsibleProfessional?: string;
  readonly attendanceType?: keyof typeof ATTENDANCE_TYPE_LABELS;
  readonly professional?: {
    readonly fullName: string;
    readonly professionalTitle?: string;
    readonly professionalRegistration?: string;
    readonly phone?: string;
    readonly instagram?: string;
  };
  readonly generatedAt?: string;
}): NutritionDeliverableDraft {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const patientId = input.plan?.patientId ?? input.patientId ?? input.panel.patientId;
  const attendanceId =
    input.plan?.attendanceId ?? input.attendanceId ?? input.panel.attendanceId;
  const professionalName =
    input.plan?.responsibleProfessional ??
    input.responsibleProfessional ??
    input.panel.responsibleProfessional;
  const responsibleUserId =
    input.plan?.responsibleUserId ?? input.responsibleUserId;
  const official = institutionalProfessionalFor(responsibleUserId);
  const qualifications = official?.qualifications ??
    (input.professional?.professionalTitle
      ? [input.professional.professionalTitle]
      : []);
  const registrations = official?.registrations ??
    (input.professional?.professionalRegistration
      ? [input.professional.professionalRegistration]
      : []);
  const whatsapp = INSTITUTIONAL_WHATSAPP;
  const socialNetworks = Array.from(
    new Set([
      ...CLINIC_INSTITUTIONAL_CONFIG.socialNetworks,
      ...(input.professional?.instagram ? [input.professional.instagram] : []),
    ]),
  );
  const diagnosis = createClinicalDiagnosis(input.panel);
  const substitutions = createSubstitutions(input.plan?.meals ?? []);
  const planRecipes = createDeliverablePlanRecipes(input.plan?.meals ?? []);
  const supplements = createSupplementDrafts(input.panel);
  const exams = createExamDrafts(input.panel);
  const herbalMedicines: DeliverableHerbalMedicine[] = [];
  const guidance = createInterpretiveGuidance(
    input.panel,
    input.strategy,
    input.plan,
  );
  const missingData = Array.from(
    new Set([
      ...input.panel.decisionSupport.pendingData,
      ...(input.panel.inheritedClinicalContext.laboratoryExams.length
        ? []
        : ["Exames laboratoriais"]),
      ...(whatsapp ? [] : ["WhatsApp institucional"]),
      ...(INSTITUTIONAL_WEBSITE ? [] : ["Site institucional"]),
      ...(input.professional ? [] : ["Cadastro do profissional responsável"]),
      ...(input.strategy ? [] : ["Estratégia Nutricional aprovada"]),
      ...(input.plan ? [] : ["Plano Alimentar aprovado"]),
    ]),
  );
  const qrCodeData = `https://wa.me/${INSTITUTIONAL_WHATSAPP_E164}`;

  return {
    deliverableId: `nutrition-deliverable:${attendanceId}:${generatedAt}`,
    patientId,
    attendanceId,
    responsibleProfessional: professionalName,
    generatedAt,
    status: "DRAFT",
    cover: {
      clinicName: CLINIC_INSTITUTIONAL_CONFIG.brand.displayName,
      clinicSubtitle: CLINIC_INSTITUTIONAL_CONFIG.documentSubtitle,
      logoPath: CLINIC_INSTITUTIONAL_CONFIG.brand.logoPath,
      patientName: input.panel.patient.name,
      documentTitle: "Relatório Nutricional Personalizado",
      date: generatedAt,
      attendanceDate: input.panel.attendanceStartedAt,
      attendanceType: input.attendanceType
        ? ATTENDANCE_TYPE_LABELS[input.attendanceType]
        : "Não informado",
      professionalName,
      registrations,
    },
    clinicalDiagnosis: {
      ...diagnosis,
      state: "GENERATED",
    },
    includeClinicalDiagnosis:
      input.panel.inheritedClinicalContext.diagnosisReview?.outcome !==
        "NO_DIAGNOSIS_ESTABLISHED" &&
      input.panel.inheritedClinicalContext.diagnoses.some((item) =>
        Boolean(item.trim()),
      ),
    findings: createFindings(input.panel),
    nutritionStrategy: input.strategy ? {
      strategyId: input.strategy.sourceStrategyId,
      objective: resolveMealPlanObjective(input.strategy).label,
      protocol: ENERGY_PROTOCOLS[input.strategy.protocol],
      method: nutritionMethodLabel(input.strategy),
      totalEnergyExpenditureKcal: input.strategy.totalEnergyExpenditureKcal,
      totalEnergyValueKcal: input.strategy.caloriesKcal,
      calorieAdjustmentPercentage:
        input.strategy.calorieAdjustmentPercentage,
      protein: {
        grams: input.strategy.proteinGrams,
        percentage: input.strategy.proteinPercentage,
      },
      carbohydrates: {
        grams: input.strategy.carbohydratesGrams,
        percentage: input.strategy.carbohydratesPercentage,
      },
      fats: {
        grams: input.strategy.fatsGrams,
        percentage: input.strategy.fatsPercentage,
      },
      fiberGrams: input.strategy.fiberGrams,
      waterMl: input.strategy.waterMl,
      mealCount: input.strategy.mealCount,
      justification: input.strategy.clinicalObservations || undefined,
      observations: input.strategy.clinicalObservations || undefined,
      approvedAt: input.strategy.approvedAt,
    } : undefined,
    mealPlan: input.plan ? {
      planId: input.plan.id,
      status: input.plan.status,
      approvedAt: input.plan.updatedAt,
      meals: input.plan.meals.map((meal) => ({
        id: meal.id,
        name: meal.name,
        time: meal.time,
        observations: meal.observations,
        items: meal.items.map(createDeliverableMealItem),
      })),
      recipes: planRecipes,
      nutritionTotals:
        input.plan.nutritionTotals ??
        calculateMealPlanNutritionTotals(input.plan.meals),
      targetDeviationAuthorized: input.plan.targetDeviationAuthorized,
    } : undefined,
    substitutions,
    shoppingList: createShoppingList({ meals: input.plan?.meals ?? [] }),
    supplements,
    herbalMedicines,
    exams,
    guidance,
    professionalNotes: {
      considerations: input.strategy?.clinicalObservations?.trim() ?? "",
      orientations: "",
    },
    goals: [],
    finalMessage: {
      content: "",
      approved: false,
      state: "PENDING_REVIEW",
    },
    signatures: [
      {
        professionalName,
        qualifications,
        registrations,
        date: generatedAt,
      },
    ],
    contacts: {
      whatsapp,
      website: INSTITUTIONAL_WEBSITE,
      socialNetworks,
    },
    qrCodeData,
    enabledSections: {
      findings: true,
      substitutions: substitutions.length > 0,
      shoppingList: true,
      supplements: supplements.length > 0,
      herbalMedicines: herbalMedicines.length > 0,
      exams: exams.length > 0,
      guidance: guidance.length > 0,
      goals: false,
      finalMessage: false,
    },
    optionalSectionOrder: [
      "findings",
      "substitutions",
      "shoppingList",
      "supplements",
      "herbalMedicines",
      "exams",
      "guidance",
      "goals",
      "finalMessage",
    ],
    warnings: [
      "Conteúdo gerado a partir dos registros do atendimento atual e sujeito à revisão do nutricionista.",
      ...administrativeDecisionSupportTexts(input.panel).map(
        (notice) => `Pendência técnica: ${notice}`,
      ),
      ...prescriptionUnitWarnings(input.plan?.meals ?? []),
      ...planRecipes
        .filter((recipe) => recipe.contentPendings.length > 0)
        .map(
          (recipe) =>
            `Pendência da receita ${recipe.recipeTitle} (snapshot v${recipe.recipeNutritionSnapshotVersion}): o conteúdo completo congelado precisa de revisão profissional.`,
        ),
      ...(substitutions.length
        ? []
        : ["Não há substituições aprovadas registradas para inclusão."]),
      ...(supplements.length
        ? [
            "Os suplementos registrados na anamnese foram incluídos como rascunho e exigem revisão profissional.",
          ]
        : []),
      ...(exams.length
        ? [
            "Os exames registrados foram incluídos como rascunho e exigem revisão profissional.",
          ]
        : []),
      ...(input.strategy ? [] : ["Estratégia Nutricional pendente nesta prévia."]),
      ...(input.plan ? [] : ["Plano Alimentar pendente nesta prévia."]),
    ],
    missingData,
  };
}

export const nutritionDeliverableService = {
  async getDraftPlanSource(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly entryId: string;
  }) {
    const plan = await getDraftPlanSnapshot(
      input.patientId,
      input.attendanceId,
      input.entryId,
    );
    return plan
      ? {
          entryId: plan.id,
          version: plan.sourceVersion,
        }
      : null;
  },

  async getFinalizedPlanSource(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly entryId?: string;
    readonly versionId?: string;
  }) {
    const plan = await getApprovedPlanSnapshot(
      input.patientId,
      input.attendanceId,
      input.entryId && input.versionId
        ? { entryId: input.entryId, versionId: input.versionId }
        : undefined,
    );
    return plan
      ? {
          entryId: plan.id,
          versionId: plan.sourceVersionId,
          version: plan.sourceVersion,
        }
      : null;
  },

  async createDraft(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly panel?: NutritionClinicalPanelView;
    readonly planSource?: {
      readonly entryId: string;
      readonly versionId?: string;
    };
    readonly allowDraftPlan?: boolean;
  }): Promise<NutritionDeliverableDraft | null> {
    const [panel, strategy, plan, attendance] = await Promise.all([
      input.panel ??
        import("@/features/nutrition-strategy/clinical-panel-repository").then(
          ({ nutritionClinicalPanelRepository }) =>
            nutritionClinicalPanelRepository.get(
              input.patientId,
              input.attendanceId,
            ),
        ),
      import("@/features/nutrition-strategy/inheritance-service").then(
        ({ nutritionStrategyInheritanceService }) =>
          nutritionStrategyInheritanceService.getForMealPlan(
            input.patientId,
            input.attendanceId,
          ),
      ),
      input.allowDraftPlan && input.planSource
        ? getDraftPlanSnapshot(
            input.patientId,
            input.attendanceId,
            input.planSource.entryId,
          )
        : getApprovedPlanSnapshot(
            input.patientId,
            input.attendanceId,
            input.planSource?.versionId
              ? {
                  entryId: input.planSource.entryId,
                  versionId: input.planSource.versionId,
                }
              : undefined,
          ),
      import("@/lib/database/prisma").then(({ prisma }) =>
        prisma.attendance.findFirst({
          where: {
            id: input.attendanceId,
            masterRecord: { patientId: input.patientId },
          },
          select: {
            consultationType: true,
            professionalUserId: true,
          },
        }),
      ),
    ]);
    if (!panel || !attendance) return null;
    const planStrategy = resolveDeliverableStrategy(plan, strategy);
    const professional =
      await import("@/features/professional-responsibility").then(
        ({ professionalResponsibilityService }) =>
          professionalResponsibilityService.getProfessional(
            plan?.responsibleUserId ?? attendance.professionalUserId,
          ),
      );
    if (!professional) return null;
    return buildNutritionDeliverableDraft({
      panel,
      strategy: planStrategy ?? undefined,
      plan: plan ?? undefined,
      patientId: input.patientId,
      attendanceId: input.attendanceId,
      responsibleUserId: attendance.professionalUserId,
      responsibleProfessional: professional.fullName,
      attendanceType: attendance?.consultationType,
      professional,
    });
  },
};
