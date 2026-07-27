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
  nutritionStrategyDecisionService,
  resolveNutritionObjective,
  type CalorieAdjustmentPercentage,
  type MacronutrientDraftInput,
  type NutritionDecisionObjective,
  type NutritionStrategyDraft,
  type NutritionStrategyRecordView,
  type NutritionStrategySupplement,
} from "@/features/nutrition-strategy";
import type { NutritionClinicalPanelView } from "@/features/nutrition-strategy/clinical-panel-contracts";
import {
  ENERGY_PROTOCOLS,
  calculateCarbohydratesByDifference,
  calculateMacronutrient,
  validateMacroDistribution,
  type EnergyProtocol,
  type MacronutrientCalculation,
  type MacronutrientInputMode,
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

function formattedFinite(value: number | undefined, digits = 1) {
  return value !== undefined && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: digits,
      }).format(value)
    : NOT_INFORMED;
}

function energyValue(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? `${numberFormatter.format(value)} kcal/dia`
    : NOT_INFORMED;
}

function calorieValue(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? `${numberFormatter.format(value)} kcal`
    : NOT_INFORMED;
}

function macroSummary(value: MacronutrientCalculation | undefined) {
  return value
    ? `${formatted(value.grams)} g · ${formatted(value.percentage)}%`
    : NOT_INFORMED;
}

function adjustmentLabel(value: number) {
  if (value === 0) return "0% · Manutenção energética";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function equalMealDistribution(mealCount: number | undefined) {
  if (!mealCount || mealCount < 1) return [];
  const base = Math.floor((100 / mealCount) * 100) / 100;

  return Array.from({ length: mealCount }, (_, index) => {
    const percentage =
      index === mealCount - 1
        ? Number((100 - base * (mealCount - 1)).toFixed(2))
        : base;
    return {
      mealNumber: index + 1,
      energyPercentage: percentage,
      proteinPercentage: percentage,
      carbohydratesPercentage: percentage,
      fatsPercentage: percentage,
    };
  });
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-black ${value === NOT_INFORMED ? "text-slate-400" : "text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}

function macroFieldValue(
  input: MacronutrientDraftInput,
  mode: MacronutrientInputMode,
  calculated: MacronutrientCalculation | undefined,
) {
  if (input.mode === mode && input.value !== undefined) return input.value;
  if (!calculated) return "";
  if (mode === "GRAMS_PER_KG") return calculated.gramsPerKg?.toFixed(2) ?? "";
  if (mode === "PERCENTAGE") return calculated.percentage.toFixed(2);
  return calculated.grams.toFixed(1);
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
  const fields = [
    ["GRAMS_PER_KG", "g/kg"],
    ["PERCENTAGE", "Percentual (%)"],
    ["GRAMS", "Gramas"],
  ] as const;

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[var(--text-primary)]">{label}</h3>
        <span className="text-xs font-bold text-[var(--muted)]">
          {calculated ? `${formatted(calculated.kcal)} kcal` : NOT_INFORMED}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {fields.map(([mode, fieldLabel]) => (
          <FormField
            id={`macro-${label}-${mode}`}
            key={mode}
            label={fieldLabel}
          >
            <NumberInput
              disabled={disabled}
              id={`macro-${label}-${mode}`}
              min={0}
              onChange={(event) =>
                onChange({ mode, value: positive(event.target.value) })
              }
              value={macroFieldValue(input, mode, calculated)}
            />
          </FormField>
        ))}
      </div>
      <p className="mt-3 text-xs font-bold text-[var(--text-secondary)]">
        {calculated
          ? `${formatted(calculated.gramsPerKg, 2)} g/kg · ${formatted(calculated.grams)} g · ${formatted(calculated.kcal)} kcal · ${formatted(calculated.percentage)}%`
          : "Informe um valor positivo para calcular."}
      </p>
    </section>
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
  const [secondaryObjectives, setSecondaryObjectives] = useState(
    initialStrategy?.secondaryObjectives ??
      view.patient.secondaryObjectives,
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
  const [manualCalories, setManualCalories] = useState<number | undefined>(
    initialStrategy?.manualFinalCaloriesKcal,
  );
  const [totalEnergyExpenditure, setTotalEnergyExpenditure] =
    useState<number | undefined>(
      initialStrategy?.totalEnergyExpenditureKcal ??
        view.bodyComposition.totalEnergyExpenditureKcal,
    );
  const [protein, setProtein] = useState<MacronutrientDraftInput>(
    initialStrategy?.protein ?? { mode: "GRAMS_PER_KG" },
  );
  const [fats, setFats] = useState<MacronutrientDraftInput>(
    initialStrategy?.fats ?? { mode: "PERCENTAGE" },
  );
  const [carbohydrates, setCarbohydrates] = useState<MacronutrientDraftInput>(
    initialStrategy?.carbohydrates ?? { mode: "GRAMS" },
  );
  const [mealCount, setMealCount] = useState<number | undefined>(
    initialStrategy?.mealCount,
  );
  const [fiberGrams, setFiberGrams] = useState<number | undefined>(
    initialStrategy?.fiberGrams,
  );
  const [waterMl, setWaterMl] = useState<number | undefined>(
    initialStrategy?.waterMl,
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
              recordedTotalEnergyExpenditureKcal:
                totalEnergyExpenditure,
            },
            objective,
            protocol,
            calorieAdjustmentPercentage: adjustment,
            manualFinalCaloriesKcal: manualCalories,
          })
        : undefined,
    [
      adjustment,
      manualCalories,
      objective,
      protocol,
      totalEnergyExpenditure,
      view.energyDecision,
    ],
  );
  const weightKg = view.nutritionalStatus.weightKg;
  const finalCalories = decision?.finalCaloriesKcal;
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
    if (!finalCalories) return undefined;
    if (carbohydrates.value) {
      return calculateMacronutrient(
        "carbohydrates",
        carbohydrates.mode,
        carbohydrates.value,
        finalCalories,
        weightKg,
      );
    }
    if (!proteinCalculation || !fatsCalculation) return undefined;
    return calculateCarbohydratesByDifference(
      finalCalories,
      proteinCalculation.kcal,
      fatsCalculation.kcal,
      weightKg,
    );
  }, [carbohydrates, fatsCalculation, finalCalories, proteinCalculation, weightKg]);
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
  const mealDistribution = useMemo(
    () => equalMealDistribution(mealCount),
    [mealCount],
  );
  const draft: NutritionStrategyDraft = useMemo(
    () => ({
      objective,
      secondaryObjectives,
      method,
      protocol,
      calorieAdjustmentPercentage: adjustment,
      manualFinalCaloriesKcal: manualCalories,
      finalCaloriesKcal: finalCalories,
      basalMetabolicRateKcal: decision?.basalMetabolicRateKcal,
      totalEnergyExpenditureKcal:
        decision?.totalEnergyExpenditureKcal ??
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
      mealDistribution,
      supplementation,
      clinicalObservations,
      evaluationEntryId: view.evaluationEntryId,
    }),
    [
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
      mealDistribution,
      method,
      objective,
      protein,
      proteinCalculation,
      protocol,
      secondaryObjectives,
      supplementation,
      totalEnergyExpenditure,
      view.evaluationEntryId,
      waterMl,
    ],
  );
  const canApprove = canApproveNutritionStrategy(draft);
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
    router.refresh();
  }

  return (
    <div className="mb-4 space-y-4">
      <Card aria-live="polite" className="p-5" variant="elevated">
        <CardHeader>
          <CardTitle>Estratégia Atual</CardTitle>
          <CardDescription>Resumo atualizado automaticamente e persistido no Prontuário Mestre.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <SummaryItem label="Objetivo" value={decision?.objectiveLabel ?? NOT_INFORMED} />
            <SummaryItem label="Protocolo" value={decision?.protocolLabel ?? ENERGY_PROTOCOLS[protocol]} />
            <SummaryItem label="TMB" value={energyValue(decision?.basalMetabolicRateKcal)} />
            <SummaryItem label="GET" value={energyValue(draft.totalEnergyExpenditureKcal)} />
            <SummaryItem label="Déficit/Superávit" value={objective ? adjustmentLabel(adjustment) : NOT_INFORMED} />
            <SummaryItem label="Calorias finais" value={energyValue(finalCalories)} />
            <SummaryItem label="Proteínas" value={macroSummary(proteinCalculation)} />
            <SummaryItem label="Carboidratos" value={macroSummary(carbohydratesCalculation)} />
            <SummaryItem label="Lipídios" value={macroSummary(fatsCalculation)} />
            <SummaryItem label="Número de refeições" value={mealCount ? String(mealCount) : NOT_INFORMED} />
            <SummaryItem label="Fibras" value={fiberGrams ? `${formatted(fiberGrams)} g` : NOT_INFORMED} />
            <SummaryItem label="Água" value={waterMl ? `${formatted(waterMl, 0)} ml` : NOT_INFORMED} />
            <SummaryItem label="Status" value={approved ? "Aprovada" : record ? "Rascunho salvo" : "Não iniciada"} />
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
            <FormField id="energy-protocol" label="Protocolo energético" required>
              <Select disabled={approved} id="energy-protocol" onChange={(event) => setProtocol(event.target.value as EnergyProtocol)} value={protocol}>
                {energyProtocols.map((value) => <option disabled={!availableProtocols.includes(value)} key={value} value={value}>{ENERGY_PROTOCOLS[value]}{availableProtocols.includes(value) ? "" : " · estrutura preparada"}</option>)}
              </Select>
            </FormField>
            <FormField id="calorie-adjustment" label="Déficit / Superávit" required>
              <Select disabled={approved} id="calorie-adjustment" onChange={(event) => setAdjustment(Number(event.target.value) as CalorieAdjustmentPercentage)} value={adjustment}>
                {CALORIE_ADJUSTMENT_PERCENTAGES.map((value) => <option key={value} value={value}>{adjustmentLabel(value)}</option>)}
              </Select>
            </FormField>
            <FormField id="strategy-get" label="GET" help="Gasto energético total registrado ou calculado." required>
              <NumberInput disabled={approved} id="strategy-get" min={0} onChange={(event) => setTotalEnergyExpenditure(positive(event.target.value))} value={totalEnergyExpenditure ?? ""} />
            </FormField>
            <FormField id="manual-calories" label="Calorias finais manuais" help="Valor profissional opcional; quando informado, substitui a sugestão automática.">
              <NumberInput disabled={approved} id="manual-calories" min={0} onChange={(event) => setManualCalories(positive(event.target.value))} value={manualCalories ?? ""} />
            </FormField>
          </div>

          <FormField id="secondary-objectives" label="Objetivos secundários" help="Separe os objetivos por ponto e vírgula.">
            <Input disabled={approved} id="secondary-objectives" onChange={(event) => setSecondaryObjectives(event.target.value.split(";").map((item) => item.trim()).filter(Boolean))} value={secondaryObjectives.join("; ")} />
          </FormField>

          <div className="grid gap-4">
            <MacroEditor calculated={proteinCalculation} disabled={approved || !finalCalories} input={protein} label="Proteínas" onChange={setProtein} />
            <MacroEditor calculated={fatsCalculation} disabled={approved || !finalCalories} input={fats} label="Lipídios" onChange={setFats} />
            <MacroEditor calculated={carbohydratesCalculation} disabled={approved || !finalCalories} input={carbohydrates} label="Carboidratos" onChange={setCarbohydrates} />
            {carbohydrates.value && !approved ? (
              <div>
                <Button onClick={() => setCarbohydrates({ mode: "GRAMS" })} size="small" type="button" variant="outline">
                  Recalcular carboidratos por diferença
                </Button>
              </div>
            ) : null}
          </div>

          <Card className="p-4" variant="muted">
            <h3 className="text-sm font-black text-[var(--text-primary)]">Validação dos macronutrientes</h3>
            <dl className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryItem label="Calorias planejadas" value={calorieValue(macroValidation?.plannedCalories)} />
              <SummaryItem label="Calorias dos macros" value={calorieValue(macroValidation?.calculatedCalories)} />
              <SummaryItem label="Diferença" value={macroValidation ? `${formattedFinite(macroValidation.differenceKcal)} kcal` : NOT_INFORMED} />
              <SummaryItem label="Diferença percentual" value={macroValidation ? `${formattedFinite(Math.abs(macroValidation.differencePercent))}%` : NOT_INFORMED} />
              <SummaryItem label="Adequação" value={macroValidation ? macroStatusLabels[macroValidation.status] : NOT_INFORMED} />
            </dl>
            <p className="mt-3 text-xs font-bold text-[var(--text-secondary)]">
              Proteínas: {formatted(proteinCalculation?.percentage)}% · Carboidratos: {formatted(carbohydratesCalculation?.percentage)}% · Lipídios: {formatted(fatsCalculation?.percentage)}% · Total: {formatted(macroValidation?.percentageTotal)}%
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="strategy-meals" label="Número de refeições" required>
              <NumberInput disabled={approved} id="strategy-meals" min={1} onChange={(event) => {
                const value = positive(event.target.value);
                setMealCount(value && Number.isInteger(value) ? value : undefined);
              }} step={1} value={mealCount ?? ""} />
            </FormField>
            <FormField id="strategy-fiber" label="Fibras (g/dia)" required>
              <NumberInput disabled={approved} id="strategy-fiber" min={0} onChange={(event) => setFiberGrams(positive(event.target.value))} value={fiberGrams ?? ""} />
            </FormField>
            <FormField id="strategy-water" label="Água (ml/dia)" required>
              <NumberInput disabled={approved} id="strategy-water" min={0} onChange={(event) => setWaterMl(positive(event.target.value))} value={waterMl ?? ""} />
            </FormField>
          </div>

          {mealDistribution.length ? (
            <section className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <div className="border-b border-[var(--line)] bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-black text-slate-900">Distribuição automática por refeição</h3>
                <p className="mt-1 text-xs text-slate-500">Recalculada sempre que a quantidade de refeições for alterada.</p>
              </div>
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-3">Refeição</th>
                    <th className="p-3">Energia</th>
                    <th className="p-3">Proteína</th>
                    <th className="p-3">Carboidratos</th>
                    <th className="p-3">Lipídios</th>
                  </tr>
                </thead>
                <tbody>
                  {mealDistribution.map((meal) => (
                    <tr className="border-b border-slate-100 last:border-0" key={meal.mealNumber}>
                      <th className="p-3 font-black">Refeição {meal.mealNumber}</th>
                      <td className="p-3">{formatted(meal.energyPercentage, 2)}%</td>
                      <td className="p-3">{formatted(meal.proteinPercentage, 2)}%</td>
                      <td className="p-3">{formatted(meal.carbohydratesPercentage, 2)}%</td>
                      <td className="p-3">{formatted(meal.fatsPercentage, 2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="rounded-xl border border-[var(--line)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Suplementação</h3>
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
                    <FormField id={`${item.id}-name`} label="Suplemento" required>
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
          <p aria-live="polite" className={`text-xs font-bold ${saveState === "ERROR" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
            {message || (!canApprove && !approved ? "Preencha objetivo, método, GET, VET, macronutrientes, fibras, água e refeições para aprovar." : "")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
