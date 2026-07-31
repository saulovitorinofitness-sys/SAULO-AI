"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  NumberInput,
  Select,
  Textarea,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import {
  CALORIE_ADJUSTMENT_PERCENTAGES,
  NUTRITION_OBJECTIVES,
  canApproveNutritionStrategy,
  nutritionStrategyApprovalIssues,
  nutritionStrategyDecisionService,
  resolveNutritionObjective,
  type CalorieAdjustmentPercentage,
  type MacronutrientDraftInput,
  type NutritionDecisionObjective,
  type NutritionStrategyDraft,
  type NutritionStrategyMealAllocation,
  type NutritionStrategyRecordView,
  type NutritionStrategySupplement,
} from "@/features/nutrition-strategy";
import type { NutritionClinicalPanelView } from "@/features/nutrition-strategy/clinical-panel-contracts";
import {
  ACTIVITY_LEVEL_FACTORS,
  ENERGY_PROTOCOLS,
  calculateMacronutrient,
  validateMacroDistribution,
  type EnergyProtocol,
  type MacronutrientCalculation,
} from "@/lib/nutrition";

const NOT_INFORMED = "NÃO INFORMADO";
const energyProtocols = Object.keys(ENERGY_PROTOCOLS) as EnergyProtocol[];
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});
const macroStatusLabels = {
  ADEQUATE: "Adequado",
  NEAR_TARGET: "Próximo da meta",
  OUTSIDE_TARGET: "Fora da meta",
} as const;
const nutritionMethods = {
  STANDARD: "Convencional",
  LOW_CARB: "Low carb",
  CARB_CYCLING: "Ciclagem de carboidratos",
} as const;
const activityFactorLabels: Readonly<Record<number, string>> = {
  1.2: "Sedentário · 1,20",
  1.375: "Levemente ativo · 1,375",
  1.55: "Moderadamente ativo · 1,55",
  1.725: "Muito ativo · 1,725",
  1.9: "Extremamente ativo · 1,90",
};
const activityFactors: readonly number[] = Object.values(
  ACTIVITY_LEVEL_FACTORS,
) as number[];

function hydrationCoefficient(ageYears: number) {
  if (ageYears > 65) return 25;
  if (ageYears > 55) return 30;
  return 35;
}

function positive(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function formatted(value: number | undefined, digits = 1) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: digits,
      }).format(value)
    : NOT_INFORMED;
}

function formattedPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function energyValue(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? `${numberFormatter.format(value)} kcal/dia`
    : NOT_INFORMED;
}

function macroSummary(value: MacronutrientCalculation | undefined) {
  return value
    ? `${formatted(value.grams)} g · ${formatted(value.gramsPerKg, 2)} g/kg · ${formatted(value.percentage)}%`
    : NOT_INFORMED;
}

function adjustmentLabel(value: number) {
  if (value === 0) return "0% · Manutenção energética";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function equalMealDistribution(mealCount: number | undefined) {
  if (!mealCount || mealCount < 1) return [];
  const base = Math.floor((100 / mealCount) * 100) / 100;

  const standardMeals = [
    ["Desjejum", "07:00"],
    ["Lanche da manhã", "10:00"],
    ["Almoço", "12:30"],
    ["Lanche da tarde", "16:00"],
    ["Jantar", "19:30"],
    ["Ceia", "22:00"],
  ] as const;

  return Array.from({ length: mealCount }, (_, index) => {
    const percentage =
      index === mealCount - 1
        ? Number((100 - base * (mealCount - 1)).toFixed(2))
        : base;
    const [name, time] =
      standardMeals[index] ?? [`Refeição ${index + 1}`, ""];
    return {
      mealNumber: index + 1,
      name,
      time,
      vetPercentage: percentage,
      plannedCaloriesKcal: 0,
    };
  });
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
      <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-black leading-5 ${value === NOT_INFORMED ? "text-slate-400" : "text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}

function editableMacroInput(
  input: MacronutrientDraftInput,
  calculated: MacronutrientCalculation | undefined,
  fallbackMode: "GRAMS_PER_KG" | "PERCENTAGE",
) {
  if (input.mode === "GRAMS_PER_KG" || input.mode === "PERCENTAGE") {
    return input;
  }
  return {
    mode: fallbackMode,
    value:
      fallbackMode === "GRAMS_PER_KG"
        ? calculated?.gramsPerKg
        : calculated?.percentage,
  } satisfies MacronutrientDraftInput;
}

function MacroEditor({
  calculated,
  disabled,
  input,
  label,
  onChange,
}: {
  calculated: MacronutrientCalculation | undefined;
  disabled: boolean;
  input: MacronutrientDraftInput;
  label: string;
  onChange: (value: MacronutrientDraftInput) => void;
}) {
  return (
    <div className="grid gap-3 border-b border-[var(--line)] py-4 last:border-b-0 md:grid-cols-[minmax(9rem,1fr)_minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)] md:items-end">
      <div className="self-center">
        <h3 className="text-sm font-black uppercase tracking-wide text-[var(--text-primary)]">
          {label}
        </h3>
      </div>
      <FormField id={`macro-${label}-mode`} label="Modo">
        <Select
          disabled={disabled}
          id={`macro-${label}-mode`}
          onChange={(event) => {
            const mode = event.target.value as
              | "GRAMS_PER_KG"
              | "PERCENTAGE";
            onChange({
              mode,
              value:
                mode === "GRAMS_PER_KG"
                  ? calculated?.gramsPerKg
                  : calculated?.percentage,
            });
          }}
          value={input.mode}
        >
          <option value="PERCENTAGE">Percentual (%)</option>
          <option value="GRAMS_PER_KG">g/kg</option>
        </Select>
      </FormField>
      <FormField
        id={`macro-${label}-value`}
        label={input.mode === "GRAMS_PER_KG" ? "g/kg" : "Percentual (%)"}
      >
        <NumberInput
          disabled={disabled}
          id={`macro-${label}-value`}
          min={0}
          onChange={(event) =>
            onChange({
              mode: input.mode,
              value: positive(event.target.value),
            })
          }
          step={input.mode === "GRAMS_PER_KG" ? "0.01" : "0.1"}
          value={input.value ?? ""}
        />
      </FormField>
      <output
        aria-live="polite"
        className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-black text-[var(--text-primary)]"
      >
        {calculated
          ? `${formatted(calculated.grams)} g calculados`
          : "Gramas calculadas automaticamente"}
      </output>
      <output className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-black text-[var(--text-primary)]">
        {calculated
          ? `${formatted(calculated.kcal)} kcal`
          : "kcal calculadas automaticamente"}
      </output>
    </div>
  );
}

export function NutritionStrategyDecisionEngine({
  view,
  initialStrategy,
}: {
  view: NutritionClinicalPanelView;
  initialStrategy: NutritionStrategyRecordView | null;
}) {
  const router = useRouter();
  const [record, setRecord] = useState(initialStrategy);
  const [objective, setObjective] = useState<NutritionDecisionObjective | undefined>(
    initialStrategy?.objective ??
      resolveNutritionObjective(view.patient.primaryObjective),
  );
  const [method, setMethod] = useState<
    keyof typeof nutritionMethods
  >(initialStrategy?.method ?? "STANDARD");
  const [protocol, setProtocol] = useState<EnergyProtocol>(
    initialStrategy?.protocol ?? nutritionStrategyDecisionService.defaultProtocol,
  );
  const [adjustment, setAdjustment] = useState<CalorieAdjustmentPercentage>(
    initialStrategy?.calorieAdjustmentPercentage ?? 0,
  );
  const [activityFactor, setActivityFactor] = useState<number | undefined>(
    initialStrategy?.activityFactor ?? view.energyDecision?.activityFactor,
  );
  const [manualCalories, setManualCalories] = useState<number | undefined>(
    initialStrategy?.manualFinalCaloriesKcal,
  );
  const [protein, setProtein] = useState<MacronutrientDraftInput>(
    initialStrategy
      ? editableMacroInput(
          initialStrategy.protein,
          initialStrategy.calculatedMacros.protein,
          "PERCENTAGE",
        )
      : { mode: "PERCENTAGE" },
  );
  const [fats, setFats] = useState<MacronutrientDraftInput>(
    initialStrategy
      ? editableMacroInput(
          initialStrategy.fats,
          initialStrategy.calculatedMacros.fats,
          "PERCENTAGE",
        )
      : { mode: "PERCENTAGE" },
  );
  const [carbohydrates, setCarbohydrates] = useState<MacronutrientDraftInput>(
    initialStrategy
      ? editableMacroInput(
          initialStrategy.carbohydrates,
          initialStrategy.calculatedMacros.carbohydrates,
          "PERCENTAGE",
        )
      : { mode: "PERCENTAGE" },
  );
  const [mealCount, setMealCount] = useState<number | undefined>(
    initialStrategy?.mealCount,
  );
  const [mealDistribution, setMealDistribution] = useState(
    initialStrategy?.mealDistribution.length
      ? initialStrategy.mealDistribution.map((meal) => ({ ...meal }))
      : equalMealDistribution(initialStrategy?.mealCount),
  );
  const [fiberGrams, setFiberGrams] = useState<number | undefined>(
    initialStrategy?.fiberGrams,
  );
  const [supplementation, setSupplementation] = useState<
    readonly NutritionStrategySupplement[]
  >(initialStrategy?.supplementation ?? []);
  const [clinicalObservations, setClinicalObservations] = useState(
    initialStrategy?.clinicalObservations ?? "",
  );
  const [saveState, setSaveState] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");
  const [message, setMessage] = useState("");
  const approved = record?.status === "APPROVED";
  const availableProtocols = useMemo(
    () =>
      view.energyDecision
        ? nutritionStrategyDecisionService.availableProtocols(view.energyDecision)
        : [],
    [view.energyDecision],
  );
  const decision = useMemo(
    () =>
      view.energyDecision
        ? nutritionStrategyDecisionService.calculate({
            energy: {
              ...view.energyDecision,
              activityFactor,
              recordedTotalEnergyExpenditureKcal: undefined,
            },
            objective,
            protocol,
            calorieAdjustmentPercentage: adjustment,
            manualFinalCaloriesKcal: manualCalories,
          })
        : undefined,
    [
      activityFactor,
      adjustment,
      manualCalories,
      objective,
      protocol,
      view.energyDecision,
    ],
  );
  const weightKg = view.nutritionalStatus.weightKg;
  const waterCoefficientMlPerKg = hydrationCoefficient(view.patient.age);
  const waterMl = weightKg
    ? Math.round(weightKg * waterCoefficientMlPerKg)
    : undefined;
  const totalEnergyExpenditure =
    decision?.totalEnergyExpenditureKcal ??
    initialStrategy?.totalEnergyExpenditureKcal;
  const finalCalories =
    manualCalories ??
    decision?.finalCaloriesKcal ??
    initialStrategy?.finalCaloriesKcal;
  const proteinCalculation = useMemo(
    () =>
      protein.value && finalCalories
        ? calculateMacronutrient("protein", protein.mode, protein.value, finalCalories, weightKg)
        : undefined,
    [finalCalories, protein, weightKg],
  );
  const fatsCalculation = useMemo(
    () =>
      fats.value && finalCalories
        ? calculateMacronutrient("fats", fats.mode, fats.value, finalCalories, weightKg)
        : undefined,
    [fats, finalCalories, weightKg],
  );
  const carbohydratesCalculation = useMemo(() => {
    if (!finalCalories || !carbohydrates.value) return undefined;
    return calculateMacronutrient(
      "carbohydrates",
      carbohydrates.mode,
      carbohydrates.value,
      finalCalories,
      weightKg,
    );
  }, [carbohydrates, finalCalories, weightKg]);
  const macroValidation = useMemo(
    () =>
      finalCalories
        ? validateMacroDistribution(finalCalories, [
            proteinCalculation,
            carbohydratesCalculation,
            fatsCalculation,
          ])
        : undefined,
    [carbohydratesCalculation, fatsCalculation, finalCalories, proteinCalculation],
  );
  const calculatedMealDistribution = useMemo<
    readonly NutritionStrategyMealAllocation[]
  >(
    () =>
      mealDistribution.map((meal) => ({
        ...meal,
        plannedCaloriesKcal: finalCalories
          ? Math.round(
              finalCalories * (meal.vetPercentage / 100) * 10,
            ) / 10
          : 0,
      })),
    [finalCalories, mealDistribution],
  );
  const distributedTotal = mealDistribution.reduce(
    (total, meal) => total + meal.vetPercentage,
    0,
  );
  const distributionDifference = distributedTotal - 100;
  const mealDistributionValid =
    Math.abs(distributionDifference) < 0.01;
  const draft: NutritionStrategyDraft = useMemo(
    () => ({
      objective,
      method,
      protocol,
      calorieAdjustmentPercentage: adjustment,
      activityFactor,
      manualFinalCaloriesKcal: manualCalories,
      finalCaloriesKcal: finalCalories,
      basalMetabolicRateKcal: decision?.basalMetabolicRateKcal,
      totalEnergyExpenditureKcal:
        totalEnergyExpenditure,
      protein,
      carbohydrates,
      fats,
      calculatedMacros: {
        protein: proteinCalculation,
        carbohydrates: carbohydratesCalculation,
        fats: fatsCalculation,
      },
      macroValidation,
      fiberGrams,
      waterMl,
      mealCount,
      mealDistribution: calculatedMealDistribution,
      supplementation,
      clinicalObservations,
      evaluationEntryId: view.evaluationEntryId,
    }),
    [
      activityFactor,
      adjustment,
      carbohydrates,
      carbohydratesCalculation,
      decision,
      fats,
      fatsCalculation,
      fiberGrams,
      finalCalories,
      clinicalObservations,
      macroValidation,
      manualCalories,
      mealCount,
      calculatedMealDistribution,
      method,
      objective,
      protein,
      proteinCalculation,
      protocol,
      supplementation,
      totalEnergyExpenditure,
      view.evaluationEntryId,
      waterMl,
    ],
  );
  const canApprove = canApproveNutritionStrategy(draft);
  const approvalIssues = nutritionStrategyApprovalIssues(draft);
  const endpoint = `/api/patients/${view.patientId}/attendances/${view.attendanceId}/nutrition-strategy`;

  async function send(method: "PUT" | "POST", body: unknown) {
    setSaveState("SAVING");
    setMessage("");
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...developmentUserRequestHeaders(),
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as {
      record?: NutritionStrategyRecordView;
      message?: string;
    };
    if (!response.ok || !result.record) {
      setSaveState("ERROR");
      setMessage(result.message ?? "Não foi possível atualizar a estratégia.");
      return;
    }
    setRecord(result.record);
    setSaveState("SAVED");
    setMessage(
      result.record.status === "APPROVED"
        ? "Estratégia aprovada e bloqueada para alterações acidentais."
        : "Estratégia salva no Prontuário Mestre.",
    );
    if (result.record.status === "APPROVED") {
      router.refresh();
    }
  }

  return (
    <div className="mb-4 space-y-4">
      <Card aria-live="polite" className="p-5" variant="elevated">
        <CardHeader>
          <CardTitle>Estratégia Atual</CardTitle>
          <CardDescription>Decisões clínicas essenciais da estratégia em elaboração.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem label="Objetivo" value={decision?.objectiveLabel ?? NOT_INFORMED} />
            <SummaryItem label="Protocolo" value={decision?.protocolLabel ?? ENERGY_PROTOCOLS[protocol]} />
            <SummaryItem label="GET" value={energyValue(draft.totalEnergyExpenditureKcal)} />
            <SummaryItem
              label="VET (Valor Energético Total)"
              value={energyValue(finalCalories)}
            />
            <SummaryItem label="Proteína" value={macroSummary(proteinCalculation)} />
            <SummaryItem label="Carboidrato" value={macroSummary(carbohydratesCalculation)} />
            <SummaryItem label="Lipídio" value={macroSummary(fatsCalculation)} />
            <SummaryItem label="Número de refeições" value={mealCount ? String(mealCount) : NOT_INFORMED} />
          </dl>
        </CardContent>
      </Card>

      <Card className="p-5" variant="outlined">
        <CardHeader>
          <CardTitle>Motor de Decisão Nutricional</CardTitle>
          <CardDescription>Definição profissional sem geração de alimentos, horários ou dieta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField id="strategy-objective" label="Objetivo nutricional" required>
              <Select disabled={approved} id="strategy-objective" onChange={(event) => setObjective((event.target.value || undefined) as NutritionDecisionObjective | undefined)} value={objective ?? ""}>
                <option value="">Selecione</option>
                {Object.entries(NUTRITION_OBJECTIVES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormField>
            <FormField id="nutrition-method" label="Método nutricional" required>
              <Select disabled={approved} id="nutrition-method" onChange={(event) => setMethod(event.target.value as keyof typeof nutritionMethods)} value={method}>
                {Object.entries(nutritionMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormField>
            <FormField id="energy-protocol" label="Protocolo utilizado" required>
              <Select disabled={approved} id="energy-protocol" onChange={(event) => setProtocol(event.target.value as EnergyProtocol)} value={protocol}>
                {energyProtocols.map((value) => <option disabled={!availableProtocols.includes(value)} key={value} value={value}>{ENERGY_PROTOCOLS[value]}{availableProtocols.includes(value) ? "" : " · estrutura preparada"}</option>)}
              </Select>
            </FormField>
            <FormField id="activity-factor" label="Fator de atividade" required>
              <Select
                disabled={approved}
                id="activity-factor"
                onChange={(event) =>
                  setActivityFactor(positive(event.target.value))
                }
                value={activityFactor ?? ""}
              >
                <option value="">Selecione</option>
                {activityFactors.map((value) => (
                  <option key={value} value={value}>
                    {activityFactorLabels[value]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="calorie-adjustment" label="Déficit / Superávit" required>
              <Select disabled={approved} id="calorie-adjustment" onChange={(event) => setAdjustment(Number(event.target.value) as CalorieAdjustmentPercentage)} value={adjustment}>
                {CALORIE_ADJUSTMENT_PERCENTAGES.map((value) => <option key={value} value={value}>{adjustmentLabel(value)}</option>)}
              </Select>
            </FormField>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--muted)]">GET calculado</p>
              <output className="mt-1 block text-sm font-black text-[var(--text-primary)]">
                {energyValue(totalEnergyExpenditure)}
              </output>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Atualizado automaticamente pelo protocolo e fator de atividade.
              </p>
            </div>
            <FormField id="manual-calories" label="VET manual (opcional)" help="Quando informado, substitui imediatamente o VET calculado pelo ajuste energético.">
              <NumberInput
                disabled={approved}
                id="manual-calories"
                min={0}
                onChange={(event) => {
                  const nextValue = event.currentTarget.valueAsNumber;
                  setManualCalories(
                    Number.isFinite(nextValue) && nextValue > 0
                      ? nextValue
                      : undefined,
                  );
                }}
                value={manualCalories ?? ""}
              />
            </FormField>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--muted)]">VET utilizado</p>
              <output className="mt-1 block text-sm font-black text-[var(--text-primary)]">
                {energyValue(finalCalories)}
              </output>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {manualCalories
                  ? "Fonte manual. Macronutrientes e refeições recalculados automaticamente."
                  : "Fonte automática: GET com o déficit ou superávit selecionado."}
              </p>
            </div>
          </div>

          <section aria-labelledby="macronutrients-title">
            <div className="mb-1">
              <h3
                className="text-base font-black text-[var(--text-primary)]"
                id="macronutrients-title"
              >
                Macronutrientes
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Escolha um único modo por macronutriente. Gramas e kcal são calculadas automaticamente.
              </p>
            </div>
            <MacroEditor calculated={proteinCalculation} disabled={approved} input={protein} label="Proteínas" onChange={setProtein} />
            <MacroEditor calculated={fatsCalculation} disabled={approved} input={fats} label="Lipídios" onChange={setFats} />
            <MacroEditor calculated={carbohydratesCalculation} disabled={approved} input={carbohydrates} label="Carboidratos" onChange={setCarbohydrates} />
            <p
              aria-live="polite"
              className={`mt-4 rounded-lg px-3 py-2 text-xs font-bold ${
                macroValidation?.status === "ADEQUATE"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {macroValidation
                ? `Soma dos macronutrientes: ${formatted(macroValidation.percentageTotal)}% · ${macroStatusLabels[macroValidation.status]}.`
                : "Preencha os macronutrientes para validar a distribuição."}
            </p>
          </section>

          <section className="rounded-xl border border-[var(--line)] p-4" aria-labelledby="meal-organization-title">
            <div className="mb-3">
              <h3 className="text-sm font-black text-slate-900" id="meal-organization-title">
                Organização alimentar
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Defina quantas refeições serão distribuídas ao longo do dia.
              </p>
            </div>
            <div className="max-w-[12rem]">
              <FormField id="strategy-meals" label="Número de refeições" required>
                <NumberInput disabled={approved} id="strategy-meals" min={1} onChange={(event) => {
                  const value = positive(event.target.value);
                  const nextMealCount =
                    value && Number.isInteger(value) ? value : undefined;
                  setMealCount(nextMealCount);
                  setMealDistribution(equalMealDistribution(nextMealCount));
                }} step={1} value={mealCount ?? ""} />
              </FormField>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--line)] p-4" aria-labelledby="hydration-goal-title">
            <div className="mb-3">
              <h3 className="text-sm font-black text-slate-900" id="hydration-goal-title">
                Meta hídrica
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Calculada automaticamente a partir do peso registrado no Prontuário Mestre.
              </p>
            </div>
            <div className="max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--muted)]">Meta hídrica automática</p>
              <output className="mt-1 block text-sm font-black text-[var(--text-primary)]">
                {waterMl
                  ? `${numberFormatter.format(waterMl)} ml/dia · ${numberFormatter.format(waterMl / 1000)} L/dia`
                  : NOT_INFORMED}
              </output>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {weightKg
                  ? `${numberFormatter.format(weightKg)} kg × ${waterCoefficientMlPerKg} ml/kg`
                  : "Peso não informado no Prontuário Mestre."}
              </p>
            </div>
          </section>

          {mealDistribution.length ? (
            <section className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <div className="border-b border-[var(--line)] bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  Distribuição das Refeições
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Defina nome, horário e participação no VET. As kcal são calculadas automaticamente.
                </p>
              </div>
              <table className="min-w-[48rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-3">Refeição</th>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Horário</th>
                    <th className="p-3">% do VET</th>
                    <th className="p-3">Meta calculada</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedMealDistribution.map((meal) => (
                    <tr className="border-b border-slate-100 last:border-0" key={meal.mealNumber}>
                      <th className="p-3 font-black">Refeição {meal.mealNumber}</th>
                      <td className="p-2">
                        <label className="sr-only" htmlFor={`meal-${meal.mealNumber}-name`}>
                          Nome da refeição {meal.mealNumber}
                        </label>
                        <Input
                          disabled={approved}
                          id={`meal-${meal.mealNumber}-name`}
                          onChange={(event) =>
                            setMealDistribution((current) =>
                              current.map((item) =>
                                item.mealNumber === meal.mealNumber
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          value={meal.name}
                        />
                      </td>
                      <td className="p-2">
                        <label className="sr-only" htmlFor={`meal-${meal.mealNumber}-time`}>
                          Horário da refeição {meal.mealNumber}
                        </label>
                        <Input
                          disabled={approved}
                          id={`meal-${meal.mealNumber}-time`}
                          onChange={(event) =>
                            setMealDistribution((current) =>
                              current.map((item) =>
                                item.mealNumber === meal.mealNumber
                                  ? { ...item, time: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          type="time"
                          value={meal.time}
                        />
                      </td>
                      <td className="p-2">
                        <label className="sr-only" htmlFor={`meal-${meal.mealNumber}-vet`}>
                          Percentual do VET da refeição {meal.mealNumber}
                        </label>
                        <div className="flex items-center gap-1">
                          <NumberInput
                            disabled={approved}
                            id={`meal-${meal.mealNumber}-vet`}
                            max={100}
                            min={0}
                            onChange={(event) => {
                              const vetPercentage =
                                Number(event.target.value) || 0;
                              setMealDistribution((current) =>
                                current.map((item) =>
                                  item.mealNumber === meal.mealNumber
                                    ? { ...item, vetPercentage }
                                    : item,
                                ),
                              );
                            }}
                            step="0.1"
                            value={meal.vetPercentage}
                          />
                          <span aria-hidden="true">%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <output className="font-black text-slate-900">
                          {finalCalories
                            ? `${formatted(meal.plannedCaloriesKcal)} kcal`
                            : NOT_INFORMED}
                        </output>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                aria-live="polite"
                className={`grid gap-2 border-t px-4 py-3 text-sm sm:grid-cols-2 ${
                  mealDistributionValid
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <p>
                  Total distribuído:{" "}
                  <strong>{formattedPercentage(distributedTotal)}%</strong>
                </p>
                <p>
                  {mealDistributionValid
                    ? "Distribuição completa."
                    : distributionDifference < 0
                      ? `Faltam: ${formattedPercentage(Math.abs(distributionDifference))}%`
                      : `Excede: ${formattedPercentage(distributionDifference)}%`}
                </p>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-[var(--line)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Suplementação (opcional)</h3>
                <p className="mt-1 text-xs text-slate-500">Itens persistidos como parte da Estratégia Nutricional.</p>
              </div>
              <Button
                disabled={approved}
                onClick={() =>
                  setSupplementation((items) => [
                    ...items,
                    {
                      id: `supplement-${Date.now()}`,
                      name: "",
                      objective: "",
                      schedule: "",
                      observations: "",
                    },
                  ])
                }
                size="small"
                type="button"
                variant="outline"
              >
                Adicionar suplemento
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {supplementation.length ? (
                supplementation.map((item) => (
                  <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2" key={item.id}>
                    <FormField id={`${item.id}-name`} label="Suplemento">
                      <Input disabled={approved} id={`${item.id}-name`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, name: event.target.value } : current))} value={item.name} />
                    </FormField>
                    <FormField id={`${item.id}-objective`} label="Objetivo">
                      <Input disabled={approved} id={`${item.id}-objective`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, objective: event.target.value } : current))} value={item.objective} />
                    </FormField>
                    <FormField id={`${item.id}-schedule`} label="Horário">
                      <Input disabled={approved} id={`${item.id}-schedule`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, schedule: event.target.value } : current))} value={item.schedule} />
                    </FormField>
                    <FormField id={`${item.id}-observations`} label="Observações">
                      <Input disabled={approved} id={`${item.id}-observations`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, observations: event.target.value } : current))} value={item.observations} />
                    </FormField>
                    <div className="md:col-span-2 md:text-right">
                      <Button disabled={approved} onClick={() => setSupplementation((items) => items.filter((current) => current.id !== item.id))} size="small" type="button" variant="ghost">
                        Excluir suplemento
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs font-semibold text-slate-500">Nenhum suplemento incluído.</p>
              )}
            </div>
          </section>

          <FormField id="clinical-observations" label="Observações clínicas">
            <Textarea disabled={approved} id="clinical-observations" onChange={(event) => setClinicalObservations(event.target.value)} value={clinicalObservations} />
          </FormField>

          <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
            {approved ? (
              <Button disabled={saveState === "SAVING"} onClick={() => send("POST", { action: "EDIT" })} type="button" variant="outline">
                Editar estratégia
              </Button>
            ) : (
              <>
                <Button disabled={saveState === "SAVING"} onClick={() => send("PUT", draft)} type="button" variant="outline">
                  Salvar estratégia
                </Button>
                <Button disabled={!canApprove || saveState === "SAVING"} onClick={() => send("POST", { action: "APPROVE", strategy: draft })} type="button">
                  Aprovar estratégia
                </Button>
              </>
            )}
          </div>
          <div aria-live="polite">
            {message ? (
              <p className={`text-xs font-bold ${saveState === "ERROR" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                {message}
              </p>
            ) : !approved && approvalIssues.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
                <p className="font-black">
                  Para aprovar a Estratégia, conclua:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 font-bold">
                  {approvalIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
