import type { MealPlanView } from "@/features/meal-plan";

const summaryItems = [
  ["Valor energético total", "plannedCalories"],
  ["Proteínas", "protein"],
  ["Carboidratos", "carbohydrates"],
  ["Lipídios", "fats"],
] as const;

export function MealPlanSummary({
  plan,
}: {
  plan: MealPlanView;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {summaryItems.map(([label, field]) => (
        <div
          className="rounded-xl border border-[#dfe7e3] bg-[#f7faf8] p-3"
          key={field}
        >
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#718079]">
            {label}
          </p>
          <p className="mt-1.5 text-sm font-black text-[#17644c]">
            {plan.summary[field]}
          </p>
        </div>
      ))}

      <div className="col-span-2 rounded-xl border border-[#dfe7e3] p-3">
        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#718079]">
          Objetivo
        </p>
        <p className="mt-1.5 text-xs font-bold leading-5 text-[#31483f]">
          {plan.summary.primaryObjective}
        </p>
      </div>

      <div className="col-span-2 rounded-xl border border-[#dfe7e3] p-3">
        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#718079]">
          Estratégia nutricional ativa
        </p>
        <p className="mt-1.5 text-xs font-bold leading-5 text-[#31483f]">
          {plan.summary.strategy}
        </p>
      </div>
    </div>
  );
}
