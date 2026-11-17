"use client";

import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { analyzeMealPlanNutrition, type NutrientCoverageState } from "@/features/meal-plan/plan-nutrition-analysis";
import type { MealPlanRecordMeal } from "@/features/meal-plan/record";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const coverage = { COMPLETE: "Completo", PARTIAL: "Parcial", ABSENT: "Ausente" } as const;
const tone = { COMPLETE: "success", PARTIAL: "warning", ABSENT: "neutral" } as const;

function KnownBar({ value, maximum, state, label }: { value: number | null; maximum: number; state: NutrientCoverageState; label: string }) {
  if (value === null) return <div className="rounded-lg border border-dashed p-3 text-xs text-[var(--muted)]">{label}: dado ausente; nenhum zero foi fabricado.</div>;
  const width = maximum > 0 ? Math.min(100, (value / maximum) * 100) : 0;
  return <div><div className="mb-1 flex justify-between gap-3 text-xs"><span>{label}</span><span className="font-bold">{nf.format(value)}{state === "PARTIAL" ? " · subtotal conhecido" : ""}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${nf.format(value)}${state === "PARTIAL" ? ", subtotal conhecido" : ""}`}><span className={state === "COMPLETE" ? "block h-full rounded-full bg-emerald-700" : "block h-full rounded-full bg-amber-500"} style={{ width: `${width}%` }} /></div></div>;
}

export function MealPlanAnalysisTab({ meals, strategy, weightKg }: { meals: readonly MealPlanRecordMeal[]; strategy?: MealPlanStrategyInheritance; weightKg?: number }) {
  const result = useMemo(() => analyzeMealPlanNutrition(meals), [meals]);
  const [nutrient, setNutrient] = useState<"energyKcal" | "proteinGrams" | "carbohydratesGrams" | "fatsGrams" | "fiberGrams" | "sodiumMg" | "calciumMg" | "ironMg">("energyKcal");
  if (!result.prescribedItemCount) return <Card className="border-dashed p-8 text-center"><h2 className="font-black">Análise ainda sem conteúdo</h2><p className="mt-2 text-sm text-[var(--muted)]">Adicione alimentos ou receitas na Elaboração. Gráficos não serão criados a partir de zeros presumidos.</p></Card>;

  const energy = result.nutrients.energyKcal;
  const macros = [
    ["Carboidratos", "carbohydratesGrams", 4, strategy?.carbohydratesGrams],
    ["Proteínas", "proteinGrams", 4, strategy?.proteinGrams],
    ["Gorduras", "fatsGrams", 9, strategy?.fatsGrams],
  ] as const;
  const macroEnergyKnown = macros.reduce((sum, [, key, kcal]) => sum + (result.nutrients[key].knownAmount ?? 0) * kcal, 0);
  const mealMax = Math.max(...result.meals.map((meal) => meal.energyKcal ?? 0), 1);
  const fatRows = [
    ["Saturadas", "saturatedFatsGrams"],
    ["Monoinsaturadas", "monounsaturatedFatsGrams"],
    ["Poli-insaturadas", "polyunsaturatedFatsGrams"],
    ["Trans", "transFatsGrams"],
  ] as const;
  const selected = result.nutrients[nutrient];

  return <div className="space-y-4">
    <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <Card className="p-4 md:p-5"><h2 className="text-lg font-black">Energia planejada × meta da estratégia</h2>{strategy ? <><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-[var(--muted)]">Planejado</p><p className="text-2xl font-black">{energy.knownAmount === null ? "—" : `${nf.format(energy.knownAmount)} kcal`}</p></div><div><p className="text-xs text-[var(--muted)]">Meta vinculada</p><p className="text-2xl font-black">{nf.format(strategy.caloriesKcal)} kcal</p></div><div><p className="text-xs text-[var(--muted)]">Diferença</p><p className="text-2xl font-black">{energy.knownAmount === null ? "—" : `${energy.knownAmount - strategy.caloriesKcal > 0 ? "+" : ""}${nf.format(energy.knownAmount - strategy.caloriesKcal)} kcal`}</p></div></div><div className="mt-4"><KnownBar label="Energia" maximum={Math.max(strategy.caloriesKcal, energy.knownAmount ?? 0)} state={energy.coverage} value={energy.knownAmount} /></div></> : <p className="mt-3 text-sm text-[var(--muted)]">Estratégia não realizada neste atendimento; não há meta energética presumida.</p>}</Card>
      <Card className="p-4 md:p-5"><h2 className="text-lg font-black">Participação energética dos macros</h2><div className="mt-4 space-y-3">{macros.map(([label, key, kcal]) => { const total = result.nutrients[key]; const percent = total.knownAmount === null || !macroEnergyKnown ? null : total.knownAmount * kcal / macroEnergyKnown * 100; return <div key={key}><div className="flex justify-between gap-2 text-sm"><span className="font-bold">{label}</span><span>{total.knownAmount === null ? "Ausente" : `${nf.format(total.knownAmount)} g · ${percent === null ? "—" : `${nf.format(percent)}%`} · ${weightKg && weightKg > 0 ? `${nf.format(total.knownAmount / weightKg)} g/kg` : "g/kg indisponível (sem peso válido)"}`}</span></div><KnownBar label={`${label}${total.coverage === "PARTIAL" ? " (parcial)" : ""}`} maximum={100} state={total.coverage} value={percent} /></div>; })}</div><p className="mt-3 text-xs text-[var(--muted)]">Denominador: energia calculada dos três macronutrientes conhecidos (4/4/9 kcal por g), não a energia total do banco.</p></Card>
    </div>

    <Card className="p-4 md:p-5"><h2 className="text-lg font-black">Energia e macros por refeição</h2><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]"> <div className="space-y-3">{result.meals.map((meal) => <KnownBar key={meal.mealId} label={meal.mealName} maximum={mealMax} state={meal.coverage} value={meal.energyKcal} />)}</div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Refeição</th><th className="p-2 text-right">kcal</th><th className="p-2 text-right">P (g)</th><th className="p-2 text-right">C (g)</th><th className="p-2 text-right">G (g)</th><th className="p-2">Cobertura</th></tr></thead><tbody>{result.meals.map((meal) => <tr className="border-b" key={meal.mealId}><th className="p-2 text-left">{meal.mealName}</th>{[meal.energyKcal, meal.proteinGrams, meal.carbohydratesGrams, meal.fatsGrams].map((value, index) => <td className="p-2 text-right tabular-nums" key={index}>{value === null ? "—" : nf.format(value)}</td>)}<td className="p-2"><Badge tone={tone[meal.coverage]}>{coverage[meal.coverage]}</Badge></td></tr>)}</tbody></table></div></div></Card>

    <div className="grid gap-4 xl:grid-cols-2"><Card className="p-4 md:p-5"><h2 className="text-lg font-black">Tipos de gordura</h2><p className="mt-1 text-xs text-[var(--muted)]">Categorias podem se sobrepor ao total; não são somadas como partições quando a fonte não garante exclusividade. Quando uma fonte não informa um tipo, o dado aparece como parcial ou ausente — nunca como zero presumido.</p><div className="mt-4 space-y-3">{fatRows.map(([label, key]) => { const item = result.nutrients[key]; return <KnownBar key={label} label={label} maximum={Math.max(result.nutrients.fatsGrams.knownAmount ?? 0, item.knownAmount ?? 0, 1)} state={item.coverage} value={item.knownAmount} />; })}</div></Card>
    <Card className="p-4 md:p-5"><h2 className="text-lg font-black">Principais contribuintes</h2><label className="mt-3 block text-sm font-bold">Nutriente<select className="ml-2 rounded-lg border px-2 py-1" onChange={(event) => setNutrient(event.target.value as typeof nutrient)} value={nutrient}><option value="energyKcal">Energia</option><option value="proteinGrams">Proteínas</option><option value="carbohydratesGrams">Carboidratos</option><option value="fatsGrams">Gorduras</option><option value="fiberGrams">Fibras</option><option value="sodiumMg">Sódio</option><option value="calciumMg">Cálcio</option><option value="ironMg">Ferro</option></select></label><ol className="mt-4 space-y-2">{selected.contributors.slice(0, 8).map((item) => <li className="flex justify-between gap-3 border-b pb-2 text-sm" key={item.itemId}><span><strong>{item.itemName}</strong><span className="block text-xs text-[var(--muted)]">{item.mealName} · {item.itemType === "RECIPE" ? "receita" : "alimento"} · {coverage[item.coverage]}</span></span><span className="text-right font-bold">{item.knownAmount === null ? "Ausente" : `${nf.format(item.knownAmount)}${item.shareOfKnownTotalPercent === null ? "" : ` · ${nf.format(item.shareOfKnownTotalPercent)}% do subtotal`}`}</span></li>)}</ol></Card></div>

    <Card className="p-4 md:p-5"><h2 className="text-lg font-black">Grupos alimentares</h2><p className="mt-1 text-xs text-[var(--muted)]">Denominador: {result.prescribedItemCount} itens prescritos (alimentos + receitas). É uma distribuição por contagem, sem somar g e ml. Somente equivalências com mapeamento explícito são consolidadas.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{result.foodGroups.map((group) => <div className="rounded-xl border p-3" key={group.groupId}><div className="flex justify-between gap-2 text-sm"><strong>{group.group}</strong><span>{group.prescribedItemCount}/{group.denominatorItemCount}</span></div>{group.originalGroups.length > 1 ? <p className="mt-1 text-xs text-[var(--muted)]">Classificações preservadas: {group.originalGroups.join(" · ")}</p> : null}<KnownBar label="Participação por itens" maximum={100} state="COMPLETE" value={group.percentageOfPrescribedItems} /></div>)}</div></Card>
  </div>;
}
