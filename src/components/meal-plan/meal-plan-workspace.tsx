"use client";

import { useEffect, useMemo, useState } from "react";

import { NutritionPrescriptionEngine } from "@/components/nutrition-prescription";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { createAssistedMealPreview, createAssistedMealReferences, mockAssistedPreviewAdapter, temporaryMealPlanDraftAdapter, type AssistedMealPreview, type MealPlanMeal, type MealPlanView } from "@/features/meal-plan";
import { mockNutritionStrategySelectionAdapter, nutritionMethodOptions, nutritionStrategySelectionFingerprint, nutritionStrategySelectionFromView, type NutritionStrategySelection, type NutritionStrategyView } from "@/features/nutrition-strategy";
import type { NutritionPrescriptionView } from "@/features/nutrition-prescription";

import { AssistedMealPreviewPanel } from "./assisted-meal-preview";
import { FinalNutritionAnalysis } from "./final-nutrition-analysis";
import { MealCard } from "./meal-card";
import { MealEditor } from "./meal-editor";
import { NutritionSummary } from "./nutrition-summary";

interface MealPlanWorkspaceProps {
  initialPlan: MealPlanView;
  prescription: NutritionPrescriptionView;
  strategy: NutritionStrategyView;
}

export function MealPlanWorkspace({
  initialPlan,
  prescription,
  strategy,
}: MealPlanWorkspaceProps) {
  const serverStrategySelection = useMemo(() => nutritionStrategySelectionFromView(strategy), [strategy]);
  const serverMealReferences = useMemo(() => createAssistedMealReferences(serverStrategySelection, initialPlan.meals), [initialPlan.meals, serverStrategySelection]);
  const serverPreview = useMemo(() => createAssistedMealPreview(serverStrategySelection, serverMealReferences, prescription.foods), [prescription.foods, serverMealReferences, serverStrategySelection]);
  const [plan, setPlan] = useState<MealPlanView>(initialPlan);
  const [browserStateLoaded, setBrowserStateLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [strategySelection, setStrategySelection] = useState<NutritionStrategySelection>(serverStrategySelection);
  const [assistedPreview, setAssistedPreview] = useState<AssistedMealPreview>(serverPreview);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(
    "Prévia assistida demonstrativa disponível para revisão profissional.",
  );

  const selected = plan.meals.find((meal) => meal.id === selectedId);
  const selectedMethod = nutritionMethodOptions.find(([value]) => value === strategySelection.method)?.[1] ?? strategySelection.method;
  const currentStrategyFingerprint =
    nutritionStrategySelectionFingerprint(strategySelection);
  const effectiveAssistedPreview: AssistedMealPreview =
    assistedPreview.status === "APPROVED" &&
    assistedPreview.strategyFingerprint !== currentStrategyFingerprint
      ? {
          ...assistedPreview,
          status: "NEEDS_UPDATE",
          approvedAt: undefined,
          approvedBy: undefined,
        }
      : assistedPreview;
  const synchronizedPlan: MealPlanView = {
    ...plan,
    status: effectiveAssistedPreview.status,
    summary: {
      ...plan.summary,
      primaryObjective: strategySelection.objectiveMain,
      strategy: `${selectedMethod}${strategySelection.complementaryStrategies.length ? ` · ${strategySelection.complementaryStrategies.join(" · ")}` : ""}`,
      plannedCalories: `${strategySelection.targetCalories} kcal`,
      protein: `${strategySelection.protein.grams} g`,
      carbohydrates: `${strategySelection.carbohydrates.grams} g`,
      fats: `${strategySelection.fats.grams} g`,
      mealCount: strategySelection.mealCount,
    },
  };

  useEffect(() => {
    const hydrationTimer = setTimeout(() => {
      const savedPlan = temporaryMealPlanDraftAdapter.read(initialPlan);

      const locallySavedStrategy = mockNutritionStrategySelectionAdapter.read(strategy.patientId, strategy.scenario);
      const savedStrategy = locallySavedStrategy?.masterRecordId === initialPlan.masterRecordId ? locallySavedStrategy : serverStrategySelection;
      const savedMealReferences = createAssistedMealReferences(savedStrategy, savedPlan.meals);
      const savedPreview = mockAssistedPreviewAdapter.read(savedStrategy) ?? createAssistedMealPreview(savedStrategy, savedMealReferences, prescription.foods);

      setPlan(savedPlan);
      setStrategySelection(savedStrategy);
      setAssistedPreview(savedPreview);
      setBrowserStateLoaded(true);
    }, 0);

    return () => clearTimeout(hydrationTimer);
  }, [initialPlan, prescription.foods, serverStrategySelection, strategy.patientId, strategy.scenario]);

  useEffect(() => {
    if (!browserStateLoaded) return;
    temporaryMealPlanDraftAdapter.store(plan);
  }, [browserStateLoaded, plan]);

  useEffect(() => {
    if (!browserStateLoaded) return;
    mockAssistedPreviewAdapter.store(strategySelection, assistedPreview);
  }, [assistedPreview, browserStateLoaded, strategySelection]);

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
    temporaryMealPlanDraftAdapter.store(synchronizedPlan);
    setMessage("Rascunho demonstrativo salvo no suporte local temporário.");
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

      <NutritionSummary onSave={savePlan} plan={synchronizedPlan} />

      <AssistedMealPreviewPanel
        foods={prescription.foods}
        key={strategySelection.updatedAt}
        onPreviewChange={setAssistedPreview}
        planMeals={plan.meals}
        preview={effectiveAssistedPreview}
        professionalName={plan.responsibleProfessional}
        strategy={strategySelection}
      />

      <NutritionPrescriptionEngine
        dailySummary={synchronizedPlan.summary}
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

      <FinalNutritionAnalysis preview={effectiveAssistedPreview} strategy={strategySelection} />
    </div>
  );
}
