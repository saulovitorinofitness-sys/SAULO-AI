export const NUTRITION_METHOD_OPTIONS = [
  ["BALANCED_BRAZILIAN", "Alimentação equilibrada brasileira", "Baseada em alimentos e preparações compatíveis com a cultura alimentar brasileira."],
  ["STANDARD", "Convencional individualizada", "Distribuição convencional ajustada individualmente pelo nutricionista."],
  ["MEDITERRANEAN", "Mediterrânea", "Prioriza alimentos in natura, azeite, vegetais, leguminosas e pescados."],
  ["DASH", "DASH", "Padrão alimentar com ênfase em alimentos in natura e controle de sódio."],
  ["PLANT_BASED", "Plant-based", "Predomínio de alimentos vegetais, sem determinar exclusão total de alimentos animais."],
  ["VEGETARIAN", "Vegetariana", "Exclui carnes conforme definição individual registrada pelo profissional."],
  ["OVO_LACTO_VEGETARIAN", "Ovolactovegetariana", "Inclui ovos e laticínios e exclui carnes."],
  ["VEGAN", "Vegana", "Exclui ingredientes de origem animal e exige avaliação de nutrientes críticos."],
  ["LOW_CARB", "Low carb", "Redução individualizada de carboidratos, sem percentual automático."],
  ["KETOGENIC", "Cetogênica", "Restrição configurável de carboidratos com acompanhamento profissional."],
  ["LOW_FAT", "Baixo teor de gorduras", "Redução individualizada de gorduras, preservando adequação energética."],
  ["TIME_RESTRICTED_EATING", "Jejum intermitente / restrição de tempo", "Organiza horários de alimentação e jejum sem definir energia automaticamente."],
  ["CARB_CYCLING", "Ciclagem de carboidratos", "Varia a oferta de carboidratos conforme dias e treinos configurados."],
  ["SPORTS_PERIODIZATION", "Periodização nutricional esportiva", "Organiza a estratégia conforme fase, treino, descanso e competição."],
  ["FLEXIBLE_EQUIVALENTS", "Flexível por equivalentes", "Estrutura escolhas por grupos equivalentes definidos no plano."],
  ["CUSTOM", "Personalizada pelo nutricionista", "Estratégia definida e justificada integralmente pelo profissional."],
] as const;

export type NutritionMethod = (typeof NUTRITION_METHOD_OPTIONS)[number][0];

export const NUTRITION_MODIFICATION_OPTIONS = [
  ["HIGH_PROTEIN", "Hiperproteica", "Elevação proteica somente após definição profissional das metas."],
  ["NORMAL_PROTEIN", "Normoproteica", "Distribuição proteica individualizada dentro do objetivo definido."],
  ["LOW_PROTEIN", "Hipoproteica", "Redução proteica configurada pelo nutricionista."],
  ["HIGH_FIBER", "Rica em fibras", "Aumento de fibras conforme tolerância e contexto clínico."],
  ["LOW_FIBER", "Baixa em fibras", "Redução de fibras conforme indicação e fase clínica."],
  ["LOW_SODIUM", "Hipossódica", "Controle de sódio sem meta automática."],
  ["CARBOHYDRATE_CONTROL", "Controle de carboidratos", "Distribuição e quantidade de carboidratos definidas manualmente."],
  ["LOW_GLYCEMIC_LOAD", "Baixo índice/carga glicêmica", "Orienta seleção e combinação dos carboidratos."],
  ["LOW_SATURATED_FAT", "Baixo teor de gorduras saturadas", "Orienta qualidade lipídica sem alterar metas automaticamente."],
  ["LACTOSE_RESTRICTION", "Restrição de lactose", "Redução individualizada conforme tolerância."],
  ["LACTOSE_FREE", "Isenta de lactose", "Exclusão de lactose confirmada pelo nutricionista."],
  ["GLUTEN_FREE", "Isenta de glúten", "Exclusão de glúten somente após decisão profissional."],
  ["LOW_FODMAP", "Low FODMAP", "Estratégia por fases com restrição, reintrodução ou personalização."],
  ["POTASSIUM_CONTROL", "Controle de potássio", "Meta definida conforme dados clínicos e laboratoriais disponíveis."],
  ["PHOSPHORUS_CONTROL", "Controle de fósforo", "Meta definida conforme dados clínicos e laboratoriais disponíveis."],
  ["FLUID_RESTRICTION", "Restrição hídrica", "Volume configurado pelo profissional sem valor presumido."],
  ["HIGH_ENERGY_DENSITY", "Aumento de densidade energética", "Aumenta densidade energética sem gerar plano automaticamente."],
  ["HIGH_PROTEIN_DENSITY", "Aumento de densidade proteica", "Aumenta densidade proteica conforme meta confirmada."],
] as const;

export type NutritionModification = (typeof NUTRITION_MODIFICATION_OPTIONS)[number][0];

export const CLINICAL_PROTOCOL_OPTIONS = [
  ["OBESITY_WEIGHT_LOSS", "Obesidade / emagrecimento", "Orienta análise e justificativa, sem fechar diagnóstico."],
  ["DIABETES_INSULIN_RESISTANCE", "Diabetes / resistência à insulina", "Sinaliza atenção à distribuição de carboidratos."],
  ["HYPERTENSION", "Hipertensão", "Sinaliza atenção a sódio, alimentos e contexto cardiovascular."],
  ["DYSLIPIDEMIA", "Dislipidemia", "Sinaliza atenção à qualidade lipídica e fibras."],
  ["RENAL_DISEASE", "Doença renal", "Habilita parâmetros renais configuráveis, sem metas presumidas."],
  ["LIVER_DISEASE", "Doença hepática", "Orienta alertas e justificativa profissional."],
  ["CARDIOVASCULAR_DISEASE", "Doença cardiovascular", "Orienta alertas e justificativa profissional."],
  ["GASTROINTESTINAL_HEALTH", "Saúde gastrointestinal", "Orienta tolerância, sintomas e fases alimentares."],
  ["BARIATRIC", "Bariátrica", "Orienta fase, tolerância e densidade nutricional."],
  ["ONCOLOGY", "Oncologia", "Orienta atenção à ingestão, tolerância e densidade nutricional."],
  ["PREGNANCY", "Gestação", "Orienta parâmetros específicos da fase gestacional."],
  ["LACTATION", "Lactação", "Orienta parâmetros específicos do período de lactação."],
  ["PEDIATRICS", "Pediatria", "Orienta avaliação por faixa etária e crescimento."],
  ["OLDER_ADULT", "Idoso", "Orienta atenção à massa muscular, hidratação e tolerância."],
  ["SPORTS_NUTRITION", "Nutrição esportiva", "Orienta periodização e demanda de treino."],
  ["EATING_DISORDER", "Transtorno alimentar", "Sinaliza necessidade de abordagem multiprofissional cuidadosa."],
  ["OTHER", "Outro", "Protocolo descrito e justificado pelo nutricionista."],
] as const;

export type ClinicalNutritionProtocol = (typeof CLINICAL_PROTOCOL_OPTIONS)[number][0];

export const ENERGY_GOAL_OPTIONS = [
  ["MAINTENANCE", "Manutenção / normocalórica", 0, "Mantém o VET igual ao GET."],
  ["DEFICIT_LIGHT", "Déficit leve", -10, "Sugestão inicial editável de redução de 10%."],
  ["DEFICIT_MODERATE", "Déficit moderado", -20, "Sugestão inicial editável de redução de 20%."],
  ["DEFICIT_CUSTOM", "Déficit personalizado", undefined, "Percentual negativo definido pelo nutricionista."],
  ["SURPLUS_LIGHT", "Superávit leve", 5, "Sugestão inicial editável de aumento de 5%."],
  ["SURPLUS_MODERATE", "Superávit moderado", 10, "Sugestão inicial editável de aumento de 10%."],
  ["SURPLUS_CUSTOM", "Superávit personalizado", undefined, "Percentual positivo definido pelo nutricionista."],
  ["MANUAL_VET", "VET manual", undefined, "Valor energético final definido diretamente pelo nutricionista."],
] as const;

export type NutritionEnergyGoal = (typeof ENERGY_GOAL_OPTIONS)[number][0];
export type NutritionWeekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export const FASTING_PROTOCOL_OPTIONS = [
  ["12_12", "12/12", 12, 12],
  ["14_10", "14/10", 10, 14],
  ["16_8", "16/8", 8, 16],
  ["18_6", "18/6", 6, 18],
  ["CUSTOM", "Personalizado", undefined, undefined],
] as const;

export const SPORTS_PHASE_OPTIONS = [
  ["ADAPTATION", "Adaptação"], ["PREPARATION", "Preparação"],
  ["HYPERTROPHY", "Hipertrofia"], ["STRENGTH", "Força"],
  ["FAT_LOSS", "Redução de gordura"], ["COMPETITION", "Competição"],
  ["RECOVERY", "Recuperação"], ["OTHER", "Outra"],
] as const;

export const SPORTS_OBJECTIVE_OPTIONS = [
  ["PERFORMANCE", "Desempenho"], ["MASS_GAIN", "Ganho de massa"],
  ["FAT_LOSS", "Redução de gordura"], ["MAINTENANCE", "Manutenção"],
  ["RECOVERY", "Recuperação"], ["GLYCOGEN_REPLENISHMENT", "Reposição de glicogênio"],
  ["OTHER", "Outro"],
] as const;

export type FastingProtocol = (typeof FASTING_PROTOCOL_OPTIONS)[number][0];
export type CarbohydrateDayType = "LOW" | "MODERATE" | "HIGH";
export type CarbohydrateTargetMode = "GRAMS_PER_KG" | "GRAMS";
export type SportsDayType = "TRAINING" | "REST" | "COMPETITION";
export interface CarbohydrateCyclingTarget { readonly mode: CarbohydrateTargetMode; readonly value?: number }
export interface SportsNutritionTarget {
  readonly energyKcal?: number;
  readonly protein?: { readonly mode: "GRAMS_PER_KG" | "PERCENTAGE" | "GRAMS"; readonly value?: number };
  readonly carbohydrates?: { readonly mode: "GRAMS_PER_KG" | "PERCENTAGE" | "GRAMS"; readonly value?: number };
  readonly fats?: { readonly mode: "GRAMS_PER_KG" | "PERCENTAGE" | "GRAMS"; readonly value?: number };
}
export interface SportsDayConfiguration {
  readonly weekday: NutritionWeekday;
  readonly type: SportsDayType;
  readonly trainingType?: string;
  readonly time?: string;
  readonly durationMinutes?: number;
  readonly intensity?: "LOW" | "MODERATE" | "HIGH";
}

export interface NutritionSpecificConfigurations {
  readonly fasting?: { readonly protocol?: FastingProtocol; readonly eatingWindowHours?: number; readonly fastingWindowHours?: number; readonly startTime?: string; readonly weekdays: readonly NutritionWeekday[] };
  readonly carbohydrateCycling?: {
    readonly lowDays: readonly NutritionWeekday[]; readonly moderateDays: readonly NutritionWeekday[]; readonly highDays: readonly NutritionWeekday[]; readonly linkedToTraining: boolean;
    readonly lowTarget?: CarbohydrateCyclingTarget; readonly moderateTarget?: CarbohydrateCyclingTarget; readonly highTarget?: CarbohydrateCyclingTarget;
  };
  readonly sportsPeriodization?: {
    readonly phase?: string; readonly objective?: string; readonly phaseOther?: string; readonly objectiveOther?: string;
    readonly startDate?: string; readonly endDate?: string; readonly sport?: string;
    readonly trainingDays: readonly NutritionWeekday[]; readonly restDays: readonly NutritionWeekday[]; readonly competitionDays: readonly NutritionWeekday[];
    readonly days?: readonly SportsDayConfiguration[];
    readonly nutritionTargets?: Partial<Record<SportsDayType, SportsNutritionTarget>>;
  };
  readonly ketogenic?: { readonly dailyCarbohydrateLimitGrams?: number; readonly monitoringAcknowledged: boolean };
  readonly lowFodmap?: { readonly phase?: "RESTRICTION" | "REINTRODUCTION" | "PERSONALIZATION" };
  readonly renal?: { readonly proteinGrams?: number; readonly sodiumMg?: number; readonly potassiumMg?: number; readonly phosphorusMg?: number; readonly fluidsMl?: number };
  readonly otherProtocolDescription?: string;
}

export function fastingProtocolDurations(protocol: FastingProtocol | undefined) {
  const option = FASTING_PROTOCOL_OPTIONS.find(([code]) => code === protocol);
  return option && option[2] !== undefined && option[3] !== undefined
    ? { eatingWindowHours: option[2], fastingWindowHours: option[3] }
    : undefined;
}

export function timeAfterHours(startTime: string | undefined, hours: number | undefined) {
  if (!startTime || hours === undefined || !Number.isFinite(hours)) return undefined;
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) return undefined;
  const minutes = (Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60)) % 1_440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function carbohydrateDayType(configuration: NutritionSpecificConfigurations["carbohydrateCycling"], weekday: NutritionWeekday): CarbohydrateDayType | undefined {
  if (configuration?.lowDays.includes(weekday)) return "LOW";
  if (configuration?.moderateDays.includes(weekday)) return "MODERATE";
  if (configuration?.highDays.includes(weekday)) return "HIGH";
  return undefined;
}

export function sportsDayConfiguration(configuration: NutritionSpecificConfigurations["sportsPeriodization"], weekday: NutritionWeekday): SportsDayConfiguration | undefined {
  const configured = configuration?.days?.find((day) => day.weekday === weekday);
  if (configured) return configured;
  if (configuration?.trainingDays.includes(weekday)) return { weekday, type: "TRAINING" };
  if (configuration?.restDays.includes(weekday)) return { weekday, type: "REST" };
  if (configuration?.competitionDays.includes(weekday)) return { weekday, type: "COMPETITION" };
  return undefined;
}

export function defaultAdjustmentForEnergyGoal(goal: NutritionEnergyGoal) {
  return ENERGY_GOAL_OPTIONS.find(([code]) => code === goal)?.[2];
}

export function energyGoalFromLegacyValues(
  adjustment: number | undefined,
  manualVet: number | undefined,
): NutritionEnergyGoal | undefined {
  if (manualVet !== undefined) return "MANUAL_VET";
  if (adjustment === 0) return "MAINTENANCE";
  if (adjustment === -10) return "DEFICIT_LIGHT";
  if (adjustment === -20) return "DEFICIT_MODERATE";
  if (adjustment === 5) return "SURPLUS_LIGHT";
  if (adjustment === 10) return "SURPLUS_MODERATE";
  if (adjustment !== undefined && adjustment < 0) return "DEFICIT_CUSTOM";
  if (adjustment !== undefined && adjustment > 0) return "SURPLUS_CUSTOM";
  return undefined;
}

export function specificConfigurationIssues(input: {
  readonly method?: NutritionMethod;
  readonly modifications: readonly NutritionModification[];
  readonly clinicalProtocols?: readonly ClinicalNutritionProtocol[];
  /** @deprecated Compatibilidade com chamadas e registros anteriores. */
  readonly clinicalProtocol?: ClinicalNutritionProtocol;
  readonly configurations: NutritionSpecificConfigurations;
}) {
  const issues: string[] = [];
  const clinicalProtocols =
    input.clinicalProtocols ??
    (input.clinicalProtocol ? [input.clinicalProtocol] : []);
  if (input.method === "TIME_RESTRICTED_EATING") {
    const fasting = input.configurations.fasting;
    if (!fasting?.eatingWindowHours || !fasting.fastingWindowHours || !fasting.startTime || !fasting.weekdays.length) {
      issues.push("Configuração da janela alimentar e do jejum");
    } else if (Math.abs(fasting.eatingWindowHours + fasting.fastingWindowHours - 24) > 0.001) {
      issues.push("Janela alimentar e jejum devem totalizar 24 horas");
    }
  }
  if (input.method === "CARB_CYCLING") {
    const cycling = input.configurations.carbohydrateCycling;
    if (!cycling || ![...cycling.lowDays, ...cycling.moderateDays, ...cycling.highDays].length) {
      issues.push("Configuração dos dias da ciclagem de carboidratos");
    } else {
      const allDays = [...cycling.lowDays, ...cycling.moderateDays, ...cycling.highDays];
      if (new Set(allDays).size !== allDays.length) issues.push("Cada dia deve ter somente um tipo de ciclagem de carboidratos");
      if (!cycling.lowTarget?.value || !cycling.moderateTarget?.value || !cycling.highTarget?.value) issues.push("Metas dos dias baixo, moderado e alto em carboidratos");
    }
  }
  if (input.method === "SPORTS_PERIODIZATION") {
    const sports = input.configurations.sportsPeriodization;
    if (!sports?.phase?.trim() || !sports.objective?.trim() || !sports.startDate || !sports.endDate || !sports.sport?.trim() || ![...sports.trainingDays, ...sports.restDays, ...sports.competitionDays].length) {
      issues.push("Configuração da periodização esportiva");
    } else {
      const allDays = [...sports.trainingDays, ...sports.restDays, ...sports.competitionDays];
      if (new Set(allDays).size !== allDays.length) issues.push("Cada dia deve ter somente uma classificação esportiva");
      if (sports.endDate < sports.startDate) issues.push("Data final da fase deve ser igual ou posterior à data inicial");
      if (sports.phase === "OTHER" && !sports.phaseOther?.trim()) issues.push("Descrição da outra fase esportiva");
      if (sports.objective === "OTHER" && !sports.objectiveOther?.trim()) issues.push("Descrição do outro objetivo esportivo");
      if (sports.days && new Set(sports.days.map((day) => day.weekday)).size !== sports.days.length) issues.push("Cada dia deve ter somente uma configuração esportiva");
      for (const day of sports.days ?? []) {
        if (day.type === "TRAINING" && (!day.trainingType?.trim() || !day.time || !day.durationMinutes || !day.intensity)) issues.push(`Detalhes do treino de ${day.weekday}`);
        if (day.type === "COMPETITION" && !day.time) issues.push(`Horário da competição de ${day.weekday}`);
      }
    }
  }
  if (input.method === "KETOGENIC") {
    const ketogenic = input.configurations.ketogenic;
    if (!ketogenic?.dailyCarbohydrateLimitGrams || !ketogenic.monitoringAcknowledged) issues.push("Limite de carboidratos e confirmação de acompanhamento da dieta cetogênica");
  }
  if (input.modifications.includes("LOW_FODMAP") && !input.configurations.lowFodmap?.phase) issues.push("Fase da estratégia Low FODMAP");
  if (clinicalProtocols.includes("OTHER") && !input.configurations.otherProtocolDescription?.trim()) issues.push("Descrição do protocolo clínico");
  return issues;
}
