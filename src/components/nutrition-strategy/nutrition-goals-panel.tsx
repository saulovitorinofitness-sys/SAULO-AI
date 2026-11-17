"use client";

import { useMemo } from "react";
import { Badge, Card, FormField, NumberInput, Select } from "@/components/ui";
import {
  calculateMacroTarget,
  hasValidMacroPercentageTotal,
  MACRONUTRIENT_KCAL_PER_GRAM,
  macroPercentageTotal,
} from "@/features/nutrition-strategy/calculations";
import type {
  AssembledDietNutrition,
  EnergyTargetMode,
  NutritionGoals,
  NutritionMethod,
} from "@/features/nutrition-strategy/contracts";
import {
  energyTargetModeOptions,
  nutritionMethodOptions,
} from "@/features/nutrition-strategy/mock-data";

export type MacroKey = "carbohydrates" | "protein" | "fats";

export interface NutritionGoalsDraft {
  readonly method: NutritionMethod;
  readonly energyMode: EnergyTargetMode;
  readonly directCalories: number;
  readonly percentages: Record<MacroKey, number>;
}

const macroConfig = {
  carbohydrates: { label: "Carboidratos", shortLabel: "C", color: "bg-sky-600", kcalPerGram: MACRONUTRIENT_KCAL_PER_GRAM.carbohydrates },
  protein: { label: "Proteínas", shortLabel: "P", color: "bg-emerald-600", kcalPerGram: MACRONUTRIENT_KCAL_PER_GRAM.protein },
  fats: { label: "Lipídios", shortLabel: "L", color: "bg-amber-500", kcalPerGram: MACRONUTRIENT_KCAL_PER_GRAM.fats },
} as const satisfies Record<MacroKey, { label: string; shortLabel: string; color: string; kcalPerGram: number }>;

const macroKeys: readonly MacroKey[] = ["carbohydrates", "protein", "fats"];
const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDelta(value: number, unit: string) {
  const signal = value > 0 ? "+" : "";
  return `${signal}${formatNumber(value)} ${unit}`;
}

function readNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function NutritionGoalsPanel({ goals, assembledDiet, value, onChange }: { goals: NutritionGoals; assembledDiet: AssembledDietNutrition; value: NutritionGoalsDraft; onChange: (value: NutritionGoalsDraft) => void }) {
  const { method, energyMode, directCalories, percentages } = value;

  const targetCalories = Math.max(0, energyMode === "BMR" ? (goals.basalMetabolicRateKcal ?? 0) : directCalories);
  const percentageValues = macroKeys.map((key) => percentages[key]);
  const percentageTotal = macroPercentageTotal(percentageValues);
  const validPercentageRanges = percentageValues.every((value) => value >= 0 && value <= 100);
  const validTotal = hasValidMacroPercentageTotal(percentageValues);
  const macroTargets = useMemo(() => Object.fromEntries(macroKeys.map((key) => [
    key,
    calculateMacroTarget(targetCalories, percentages[key], macroConfig[key].kcalPerGram),
  ])) as Record<MacroKey, ReturnType<typeof calculateMacroTarget>>, [percentages, targetCalories]);
  const chartDenominator = percentageTotal > 0 ? percentageTotal : 100;

  const comparisonRows = [
    { label: "Energia", planned: targetCalories, assembled: assembledDiet.calories, unit: "kcal" },
    { label: "Carboidratos", planned: macroTargets.carbohydrates.grams, assembled: assembledDiet.carbohydratesGrams, unit: "g" },
    { label: "Proteínas", planned: macroTargets.protein.grams, assembled: assembledDiet.proteinGrams, unit: "g" },
    { label: "Lipídios", planned: macroTargets.fats.grams, assembled: assembledDiet.fatsGrams, unit: "g" },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="nutrition-method" label="Método" required help="O método é independente da classificação calórica da estratégia.">
          <Select id="nutrition-method" onChange={(event) => onChange({ ...value, method: event.target.value as NutritionMethod })} value={method}>
            {nutritionMethodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>
        <FormField id="energy-mode" label="Definição da meta energética" required>
          <Select id="energy-mode" onChange={(event) => onChange({ ...value, energyMode: event.target.value as EnergyTargetMode })} value={energyMode}>
            {energyTargetModeOptions.map(([value, label]) => <option disabled={value === "BMR" && !goals.basalMetabolicRateKcal} key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>
        {energyMode === "CALORIES" ? (
          <FormField id="target-calories" label="Meta energética" required help="Valor definido diretamente pelo nutricionista." error={directCalories <= 0 ? "Informe uma meta energética maior que zero." : undefined}>
            <NumberInput aria-invalid={directCalories <= 0} id="target-calories" min={1} onChange={(event) => onChange({ ...value, directCalories: readNumber(event.target.value) })} value={directCalories} />
          </FormField>
        ) : (
          <FormField id="target-bmr" label="Meta energética pela TMB" help="TMB reutilizada da bioimpedância do mesmo Prontuário Mestre.">
            <NumberInput id="target-bmr" readOnly value={goals.basalMetabolicRateKcal ?? 0} />
          </FormField>
        )}
        <div className="rounded-[var(--radius-medium)] border border-sky-200 bg-sky-50 p-3.5">
          <p className="text-xs font-black uppercase tracking-wide text-sky-800">Meta utilizada nos cálculos</p>
          <p className="mt-1 text-2xl font-black text-sky-950">{formatNumber(targetCalories)} kcal</p>
          <p className="mt-1 text-xs text-sky-800">Método: {nutritionMethodOptions.find(([value]) => value === method)?.[1]}</p>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)]">Distribuição dos macronutrientes</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">A conversão usa 4 kcal/g para carboidratos e proteínas e 9 kcal/g para lipídios.</p>
          </div>
          <Badge tone={validTotal ? "success" : "danger"}>Soma: {formatNumber(percentageTotal)}% {validTotal ? "· válida" : "· deve ser 100%"}</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {macroKeys.map((key) => (
            <FormField id={`${key}-percentage`} key={key} label={`${macroConfig[key].label} (%)`} required help={`${formatNumber(macroTargets[key].grams)} g calculados`}>
              <NumberInput aria-invalid={!validTotal} id={`${key}-percentage`} max={100} min={0} onChange={(event) => onChange({ ...value, percentages: { ...percentages, [key]: readNumber(event.target.value) } })} value={percentages[key]} />
            </FormField>
          ))}
        </div>
        <p aria-live="polite" className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${validTotal ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`} role={validTotal ? "status" : "alert"}>
          {validTotal
            ? "Distribuição válida: os percentuais totalizam 100%."
            : !validPercentageRanges
              ? "Distribuição inválida: cada percentual deve estar entre 0% e 100%."
              : percentageTotal > 100
                ? `Distribuição inválida: reduza ${formatNumber(percentageTotal - 100)} ponto(s) percentual(is) para atingir 100%.`
                : `Distribuição inválida: acrescente ${formatNumber(100 - percentageTotal)} ponto(s) percentual(is) para atingir 100%.`}
        </p>
      </div>

      <Card className="p-4" variant="muted">
        <div aria-label={`Gráfico de macronutrientes: carboidratos ${formatNumber(percentages.carbohydrates)}%, proteínas ${formatNumber(percentages.protein)}% e lipídios ${formatNumber(percentages.fats)}%.`} role="img">
          <div className="flex h-9 overflow-hidden rounded-[var(--radius-full)] bg-slate-200">
            {macroKeys.map((key) => <span className={`${macroConfig[key].color} flex min-w-0 items-center justify-center text-xs font-black text-white transition-[width]`} key={key} style={{ width: `${(Math.max(0, percentages[key]) / chartDenominator) * 100}%` }}>{percentages[key] > 8 ? macroConfig[key].shortLabel : null}</span>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[var(--text-secondary)]">
            {macroKeys.map((key) => <span key={key}><i aria-hidden="true" className={`${macroConfig[key].color} mr-1.5 inline-block size-2.5 rounded-full`} />{macroConfig[key].label}: {formatNumber(percentages[key])}% · {formatNumber(macroTargets[key].grams)} g</span>)}
          </div>
        </div>
      </Card>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)]">Meta planejada × dieta montada</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Os totais da dieta montada são valores demonstrativos já registrados no mock do Plano Alimentar.</p>
          </div>
          <Badge tone="info">Dieta montada · mock</Badge>
        </div>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-medium)] border border-[var(--line)]">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-[var(--surface-elevated)] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-3 py-2.5" scope="col">Indicador</th><th className="px-3 py-2.5" scope="col">Meta planejada</th><th className="px-3 py-2.5" scope="col">Dieta montada</th><th className="px-3 py-2.5" scope="col">Diferença</th></tr></thead>
            <tbody className="divide-y divide-[var(--line)]">
              {comparisonRows.map((row) => {
                const delta = row.assembled - row.planned;
                return <tr key={row.label}><th className="px-3 py-3 font-black text-[var(--text-primary)]" scope="row">{row.label}</th><td className="px-3 py-3 text-[var(--text-secondary)]">{formatNumber(row.planned)} {row.unit}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{formatNumber(row.assembled)} {row.unit}</td><td className={`px-3 py-3 font-black ${Math.abs(delta) < 0.05 ? "text-emerald-700" : "text-amber-700"}`}>{formatDelta(delta, row.unit)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
