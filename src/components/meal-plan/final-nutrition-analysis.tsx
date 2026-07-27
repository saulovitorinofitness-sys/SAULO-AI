"use client";

import { useState } from "react";
import { Badge, Button, ButtonLink, Card, Textarea } from "@/components/ui";
import {
  achievedPercentage,
  classifyNutritionPercentage,
  demonstrativeFiberTargetGrams,
  demonstrativeMicronutrientReferences,
  previewNutrition,
  type AssistedMealPreview,
  type NutritionAnalysisState,
} from "@/features/meal-plan";
import type { NutritionStrategySelection } from "@/features/nutrition-strategy";

type AnalysisFilter = "ALL" | NutritionAnalysisState;

const filterLabels: Readonly<Record<AnalysisFilter, string>> = {
  ALL: "Todos",
  ADEQUATE: "Adequados",
  ATTENTION: "Atenção",
  OUT_OF_RANGE: "Fora da meta",
};

const stateStyles: Readonly<Record<NutritionAnalysisState, { badge: "success" | "warning" | "danger"; border: string; bar: string; text: string }>> = {
  ADEQUATE: { badge: "success", border: "border-emerald-200 bg-emerald-50", bar: "bg-emerald-600", text: "text-emerald-800" },
  ATTENTION: { badge: "warning", border: "border-amber-200 bg-amber-50", bar: "bg-amber-500", text: "text-amber-800" },
  OUT_OF_RANGE: { badge: "danger", border: "border-rose-200 bg-rose-50", bar: "bg-rose-600", text: "text-rose-800" },
};

const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function format(value: number) {
  return formatter.format(value);
}

export function FinalNutritionAnalysis({ preview, strategy }: { preview: AssistedMealPreview; strategy: NutritionStrategySelection }) {
  const [filter, setFilter] = useState<AnalysisFilter>("ALL");
  const [professionalObservation, setProfessionalObservation] = useState("");
  const totals = previewNutrition(preview);
  const macroRows = [
    { label: "Energia", target: strategy.targetCalories, total: totals.calories, unit: "kcal" },
    { label: "Carboidratos", target: strategy.carbohydrates.grams, total: totals.carbohydratesGrams, unit: "g" },
    { label: "Proteínas", target: strategy.protein.grams, total: totals.proteinGrams, unit: "g" },
    { label: "Lipídios", target: strategy.fats.grams, total: totals.fatsGrams, unit: "g" },
    { label: "Fibras", target: demonstrativeFiberTargetGrams, total: totals.fiberGrams, unit: "g" },
  ].map((row) => {
    const percentage = achievedPercentage(row.total, row.target);
    return { ...row, percentage, classification: classifyNutritionPercentage(percentage) };
  });
  const micronutrients = demonstrativeMicronutrientReferences.map((reference) => {
    const total = totals.micronutrients[reference.key];
    const percentage = achievedPercentage(total, reference.target);
    return { ...reference, total, percentage, classification: classifyNutritionPercentage(percentage) };
  });
  const visibleMicronutrients = filter === "ALL" ? micronutrients : micronutrients.filter((item) => item.classification.state === filter);
  const macroCalories = [totals.carbohydratesGrams * 4, totals.proteinGrams * 4, totals.fatsGrams * 9];
  const macroCalorieTotal = macroCalories.reduce((sum, value) => sum + value, 0) || 1;
  const macroChart = [
    { label: "Carboidratos", value: macroCalories[0], color: "bg-sky-600" },
    { label: "Proteínas", value: macroCalories[1], color: "bg-emerald-600" },
    { label: "Lipídios", value: macroCalories[2], color: "bg-amber-500" },
  ];

  return (
    <section aria-labelledby="final-nutrition-analysis-title" className="space-y-4">
      <Card className="p-4 md:p-6" variant="elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Fechamento do plano</p><h2 className="mt-1 text-xl font-black text-[var(--text-primary)]" id="final-nutrition-analysis-title">Análise nutricional final do plano</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Metas comparadas à prévia atualmente montada. Os cálculos são determinísticos, usam dados demonstrativos e exigem revisão do nutricionista; não representam diagnóstico ou prescrição automática.</p></div>
          <div className="flex flex-wrap gap-2"><Badge tone="info">Dados demonstrativos</Badge><Badge tone="warning">Decisão exclusiva do nutricionista</Badge></div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {macroRows.map((row) => {
            const styles = stateStyles[row.classification.state];
            const difference = row.total - row.target;
            return <article className={`rounded-xl border p-3 ${styles.border}`} key={row.label}><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-black text-[var(--text-primary)]">{row.label}</h3><Badge tone={styles.badge}>{row.classification.label}</Badge></div><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-[var(--muted)]">Meta</dt><dd className="font-black">{format(row.target)} {row.unit}</dd></div><div><dt className="text-[var(--muted)]">Dieta</dt><dd className="font-black">{format(row.total)} {row.unit}</dd></div><div><dt className="text-[var(--muted)]">Diferença</dt><dd className={`font-black ${styles.text}`}>{difference > 0 ? "+" : ""}{format(difference)} {row.unit}</dd></div><div><dt className="text-[var(--muted)]">Atingido</dt><dd className={`font-black ${styles.text}`}>{format(row.percentage)}%</dd></div></dl></article>;
          })}
        </div>

        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black text-[var(--text-primary)]">Distribuição energética dos macronutrientes</h3><p className="text-xs text-[var(--muted)]">Gráfico compacto da dieta montada</p></div>
          <div aria-label={`Distribuição: carboidratos ${format((macroChart[0].value / macroCalorieTotal) * 100)}%, proteínas ${format((macroChart[1].value / macroCalorieTotal) * 100)}% e lipídios ${format((macroChart[2].value / macroCalorieTotal) * 100)}%.`} className="mt-3" role="img"><div className="flex h-8 overflow-hidden rounded-full bg-slate-200">{macroChart.map((item) => <span className={item.color} key={item.label} style={{ width: `${(item.value / macroCalorieTotal) * 100}%` }} />)}</div><div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-[var(--text-secondary)]">{macroChart.map((item) => <span key={item.label}><i aria-hidden="true" className={`${item.color} mr-1.5 inline-block size-2.5 rounded-full`} />{item.label}: {format((item.value / macroCalorieTotal) * 100)}%</span>)}</div></div>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-black text-[var(--text-primary)]">Vitaminas e minerais</h2><p className="mt-1 text-sm text-[var(--muted)]">Referências e composição exclusivamente demonstrativas nesta Sprint.</p></div><div aria-label="Filtrar vitaminas e minerais" className="flex flex-wrap gap-2">{(Object.keys(filterLabels) as AnalysisFilter[]).map((key) => <Button key={key} onClick={() => setFilter(key)} size="small" variant={filter === key ? "primary" : "outline"}>{filterLabels[key]}</Button>)}</div></div>
        {visibleMicronutrients.length ? <div className="mt-5 grid gap-3 lg:grid-cols-2">{visibleMicronutrients.map((item) => { const styles = stateStyles[item.classification.state]; return <article className={`rounded-xl border p-3 ${styles.border}`} key={item.key}><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-[var(--text-primary)]">{item.label}</h3><p className="mt-0.5 text-xs text-[var(--muted)]">{format(item.total)} de {format(item.target)} {item.unit} · {format(item.percentage)}%</p></div><Badge tone={styles.badge}>{item.classification.label}</Badge></div><div aria-label={`${item.label}: ${format(item.percentage)}% da referência demonstrativa`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.min(item.percentage, 100)} className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80" role="progressbar"><span className={`block h-full rounded-full ${styles.bar}`} style={{ width: `${Math.min(Math.max(item.percentage, 0), 100)}%` }} /></div></article>; })}</div> : <div className="mt-5 rounded-xl border border-dashed border-[var(--line-strong)] p-5 text-center text-sm text-[var(--muted)]">Nenhum nutriente corresponde ao filtro selecionado.</div>}
      </Card>

      <Card className="p-4 md:p-6" id="professional-nutrition-conduct">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"><div><label className="text-sm font-black text-[var(--text-primary)]" htmlFor="professional-nutrition-observation">Observação profissional</label><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Registro local para revisão do nutricionista. Nenhuma conduta é criada automaticamente.</p><Textarea className="mt-2" id="professional-nutrition-observation" onChange={(event) => setProfessionalObservation(event.target.value)} placeholder="Registre pontos para revisão profissional..." value={professionalObservation} /></div><ButtonLink href={`/pacientes/${strategy.patientId}/estrategia-nutricional?scenario=${strategy.scenario}`} size="medium" variant="outline">Revisar suplementação e fitoterápicos</ButtonLink></div>
      </Card>
    </section>
  );
}
