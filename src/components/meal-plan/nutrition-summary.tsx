import { Card, CardContent, CardDescription, CardTitle, SectionHeader, StatusBadge } from "@/components/ui";
import type { MealPlanView } from "@/features/meal-plan";

export function NutritionSummary({ plan }: { plan: MealPlanView }) {
  const items = [
    ["Objetivo principal", plan.summary.primaryObjective], ["Estratégia nutricional", plan.summary.strategy], ["Calorias planejadas", plan.summary.plannedCalories], ["Proteínas", plan.summary.protein], ["Carboidratos", plan.summary.carbohydrates], ["Gorduras", plan.summary.fats], ["Número de refeições", String(plan.summary.mealCount)], ["Restrições alimentares", plan.summary.restrictions.join(" · ")], ["Suplementação", plan.summary.supplementation], ["Observações", plan.summary.observations],
  ] as const;
  return <section className="space-y-4" aria-labelledby="nutrition-summary-title"><SectionHeader action={<StatusBadge label="Rascunho mockado" status="in_progress" />} description="Valores transcritos no mock, sem cálculo ou interpretação automática." eyebrow="Dados nutricionais" title="Resumo nutricional" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(([label, value]) => <Card className="p-4" key={label} variant="muted"><CardTitle className="text-sm">{label}</CardTitle><CardContent><CardDescription className="mt-2 break-words text-sm text-[var(--text-secondary)]">{value}</CardDescription></CardContent></Card>)}</div></section>;
}
