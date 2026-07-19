"use client";

import { useEffect, useState } from "react";

import { NutritionPrescriptionEngine } from "@/components/nutrition-prescription";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import type { MealPlanMeal, MealPlanView } from "@/features/meal-plan";
import type { NutritionPrescriptionView } from "@/features/nutrition-prescription";

import { MealCard } from "./meal-card";
import { MealEditor } from "./meal-editor";
import { NutritionSummary } from "./nutrition-summary";

interface MealPlanWorkspaceProps {
  initialPlan: MealPlanView;
  prescription: NutritionPrescriptionView;
}

export function MealPlanWorkspace({
  initialPlan,
  prescription,
}: MealPlanWorkspaceProps) {
  const [plan, setPlan] = useState<MealPlanView>(() => {
    if (typeof window === "undefined") return initialPlan;

    const savedPlan = localStorage.getItem("saulo-ai-meal-plan");

    return savedPlan ? JSON.parse(savedPlan) : initialPlan;
  });

  useEffect(() => {
    localStorage.setItem(
      "saulo-ai-meal-plan",
      JSON.stringify(plan),
    );
  }, [plan]);
  const [selectedId, setSelectedId] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(
    "Dados demonstrativos. Nenhuma dieta foi gerada automaticamente.",
  );

  const selected = plan.meals.find((meal) => meal.id === selectedId);

  function select(meal: MealPlanMeal, shouldEdit: boolean) {
    setSelectedId(meal.id);
    setEditing(shouldEdit);

    setMessage(
      shouldEdit
        ? "Edição local ativada."
        : "Visualização da refeição selecionada.",
    );
  }

  function update(meal: MealPlanMeal) {
    setPlan({
      ...plan,
      meals: plan.meals.map((item) =>
        item.id === meal.id ? meal : item,
      ),
    });
  }

  function duplicate(meal: MealPlanMeal) {
    const copyNumber =
      plan.meals.filter((item) =>
        item.id.startsWith(`${meal.id}-copy-`),
      ).length + 1;

    const copy: MealPlanMeal = {
      ...meal,
      id: `${meal.id}-copy-${copyNumber}`,
      name: `${meal.name} — cópia`,
    };

    setPlan({
      ...plan,
      meals: [...plan.meals, copy],
    });

    setSelectedId(copy.id);
    setEditing(true);
    setMessage("Refeição duplicada no plano local.");
  }

  function remove(meal: MealPlanMeal) {
    const confirmed = window.confirm(
      `Excluir a refeição “${meal.name}” deste plano local?`,
    );

    if (!confirmed) return;

    setPlan({
      ...plan,
      meals: plan.meals.filter((item) => item.id !== meal.id),
    });

    if (selectedId === meal.id) {
      setSelectedId(undefined);
      setEditing(false);
    }

    setMessage("Refeição removida do plano local.");
  }

  function handleNewMeal() {
    setMessage(
      "A inclusão de uma nova refeição será conectada à persistência na próxima etapa.",
    );
  }

  function savePlan() {
    localStorage.setItem("saulo-ai-meal-plan", JSON.stringify(plan));
    setMessage("Plano demonstrativo salvo localmente.");
  }

  return (
    <div className="space-y-4">
      <Card
        className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
        variant="info"
      >
        <div>
          <p className="text-sm font-black text-sky-950">
            Plano Alimentar Inteligente
          </p>

          <p
            aria-live="polite"
            className="mt-1 text-sm text-sky-800"
          >
            {message}
          </p>
        </div>

        <Badge tone="warning">
          Decisão exclusiva do nutricionista
        </Badge>
      </Card>

      <NutritionSummary onSave={savePlan} plan={plan} />

      <NutritionPrescriptionEngine
        dailySummary={plan.summary}
        view={prescription}
      />

      <details className="rounded-2xl border border-[var(--line)] bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-black text-[var(--text-primary)]">
          Gerenciar estrutura do plano
        </summary>

        <section
          aria-labelledby="meal-plan-structure"
          className="min-w-0 space-y-5 border-t border-[var(--line)] p-4"
        >
          <SectionHeader
            action={
              <Button
                onClick={handleNewMeal}
                size="small"
                type="button"
              >
                Nova refeição
              </Button>
            }
            description="Organize, visualize, edite, duplique ou remova as refeições do plano."
            eyebrow="Plano atual"
            title="Estrutura do plano"
          />

          <span className="sr-only" id="meal-plan-structure">
            Estrutura do plano alimentar
          </span>

          {plan.meals.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {plan.meals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onDelete={() => remove(meal)}
                  onDuplicate={() => duplicate(meal)}
                  onEdit={() => select(meal, true)}
                  onView={() => select(meal, false)}
                  selected={selectedId === meal.id}
                />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="font-bold text-slate-900">
                Nenhuma refeição cadastrada
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Use o botão “Nova refeição” para iniciar a estrutura do plano.
              </p>
            </Card>
          )}

          {selected ? (
            <MealEditor
              editing={editing}
              meal={selected}
              onChange={update}
              onClose={() => {
                setSelectedId(undefined);
                setEditing(false);
              }}
              onSave={() => {
                setEditing(false);
                setMessage("Alteração salva no plano local.");
              }}
            />
          ) : null}
        </section>
      </details>
    </div>
  );
}
