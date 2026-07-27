import { Button, Card, StatusBadge } from "@/components/ui";
import type { MealPlanView } from "@/features/meal-plan";

export function NutritionSummary({
  plan,
  onSave,
  saveDisabled = false,
}: {
  plan: MealPlanView;
  onSave: () => void;
  saveDisabled?: boolean;
}) {
  const highlights = [
    ["Calorias planejadas", plan.summary.plannedCalories],
    ["Proteínas", plan.summary.protein],
    ["Carboidratos", plan.summary.carbohydrates],
    ["Gorduras", plan.summary.fats],
  ] as const;
  const details = [
    ["Objetivo principal", plan.summary.primaryObjective],
    ["Estratégia nutricional", plan.summary.strategy],
    ["Número de refeições", String(plan.summary.mealCount)],
    ["Restrições alimentares", plan.summary.restrictions.join(" · ")],
    ["Suplementação", plan.summary.supplementation],
    ["Observações", plan.summary.observations],
  ] as const;

  return (
    <section aria-label="Resumo nutricional demonstrativo">
      <Card className="p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {highlights.map(([label, value]) => (
              <div
                className="rounded-xl bg-[var(--surface-elevated)] px-3 py-2"
                key={label}
              >
                <dt className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--muted)]">
                  {label}
                </dt>
                <dd className="mt-0.5 font-black text-[var(--text-primary)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StatusBadge
              label={
                plan.strategyStatus === "APPROVED"
                  ? "Rascunho · estratégia aprovada"
                  : "Em elaboração · mock"
              }
              status="in_progress"
            />
            <Button disabled={saveDisabled} onClick={onSave} size="small" type="button">
              Salvar
            </Button>
          </div>
        </div>

        <details className="mt-3 border-t border-[var(--line)] pt-3">
          <summary className="cursor-pointer text-sm font-black text-[var(--text-primary)]">
            Resumo e estratégia nutricional
          </summary>

          <p className="mt-2 text-xs text-[var(--muted)]">
            {plan.strategyStatus === "APPROVED"
              ? "Metas herdadas da Estratégia Nutricional aprovada. O Plano Alimentar não recalcula estes valores."
              : "Dados demonstrativos sincronizados com a Estratégia Nutricional. Conversões locais não substituem revisão ou decisão profissional."}
          </p>

          <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {details.map(([label, value]) => (
              <div
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3"
                key={label}
              >
                <dt className="text-xs font-black text-[var(--muted)]">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-sm leading-5 text-[var(--text-secondary)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </Card>
    </section>
  );
}
