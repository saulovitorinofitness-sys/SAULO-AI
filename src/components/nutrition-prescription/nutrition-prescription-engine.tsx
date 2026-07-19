"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { NutritionSummary as DailyNutritionSummary } from "@/features/meal-plan";
import type {
  FoodSubstitution,
  NutritionPrescriptionView,
  PrescriptionEntryKind,
  PrescriptionMealDraft,
  PrescriptionMealEntry,
  PrescriptionMealReference,
} from "@/features/nutrition-prescription";
import type { ScientificLibraryItem } from "@/features/scientific-library";
import { MealAssemblyPanel } from "./meal-assembly-panel";
import {
  NutritionLibraryPanel,
  type QuickAddValues,
} from "./nutrition-library-panel";

const attribute = (item: ScientificLibraryItem, key: string): string => {
  const value = item.attributes[key];
  return typeof value === "string" ? value : value?.[0] ?? "";
};

const encodeMeasure = (values: QuickAddValues) =>
  [
    values.measureLabel,
    String(values.totalAmount),
    values.unit,
    values.unitEquivalence === null ? "" : String(values.unitEquivalence),
    values.estimated ? "estimated" : "manual",
    values.measureAssociationId,
    values.demonstrative ? "demonstrative" : "",
    values.officialSource ?? "",
  ].join("||");

export function NutritionPrescriptionEngine({
  view,
  dailySummary,
}: {
  view: NutritionPrescriptionView;
  dailySummary: DailyNutritionSummary;
}) {
  const [meals, setMeals] = useState<PrescriptionMealReference[]>(() => [
    ...view.meals,
  ]);
  const [activeMealId, setActiveMealId] = useState(view.meals[0]?.id ?? "");
  const [drafts, setDrafts] = useState<PrescriptionMealDraft[]>(() =>
    view.meals.map((meal) => ({
      mealId: meal.id,
      time: meal.time,
      guidance: "",
      observations: "",
      preparation: "",
      entries: [],
    })),
  );
  const [favorites, setFavorites] = useState<Set<string>>(
    () =>
      new Set(
        [...view.foods, ...view.recipes, ...view.supplements]
          .filter((item) => item.initiallyFavorite)
          .map((item) => item.id),
      ),
  );
  const [message, setMessage] = useState(
    "Motor pronto para edição manual. Nenhum alimento foi adicionado automaticamente.",
  );
  const activeDraft =
    drafts.find((draft) => draft.mealId === activeMealId) ?? drafts[0];

  function updateDraft(next: PrescriptionMealDraft) {
    setDrafts((items) =>
      items.map((item) => (item.mealId === next.mealId ? next : item)),
    );
    setMessage("Alterações locais ainda não salvas.");
  }

  function add(
    item: ScientificLibraryItem,
    kind: PrescriptionEntryKind,
    values?: QuickAddValues,
  ) {
    if (!activeDraft) return;

    const entry: PrescriptionMealEntry = {
      id: `entry-${Date.now()}-${activeDraft.entries.length}`,
      scientificLibraryItemId: item.id,
      kind,
      name: item.name,
      quantity: values?.quantity ?? "",
      householdMeasure: values
        ? encodeMeasure(values)
        : kind === "FOOD"
          ? attribute(item, "Medida caseira")
          : "",
      notes: "",
      order: activeDraft.entries.length + 1,
      group: item.category,
      substitutions: [],
    };

    updateDraft({
      ...activeDraft,
      entries: [...activeDraft.entries, entry],
    });
    setMessage(`${item.name} adicionado manualmente à refeição ativa.`);
  }

  function updateEntry(entry: PrescriptionMealEntry) {
    if (!activeDraft) return;
    updateDraft({
      ...activeDraft,
      entries: activeDraft.entries.map((item) =>
        item.id === entry.id ? entry : item,
      ),
    });
  }

  function move(id: string, direction: -1 | 1) {
    if (!activeDraft) return;
    const entries = [...activeDraft.entries];
    const index = entries.findIndex((entry) => entry.id === id);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    updateDraft({
      ...activeDraft,
      entries: entries.map((entry, order) => ({ ...entry, order: order + 1 })),
    });
  }

  function duplicate(id: string) {
    if (!activeDraft) return;
    const source = activeDraft.entries.find((entry) => entry.id === id);
    if (!source) return;
    const copy = {
      ...source,
      id: `entry-${Date.now()}-copy`,
      name: `${source.name} · cópia`,
      order: activeDraft.entries.length + 1,
      substitutions: source.substitutions.map((item) => ({
        ...item,
        id: `${item.id}-copy`,
      })),
    };
    updateDraft({ ...activeDraft, entries: [...activeDraft.entries, copy] });
  }

  function remove(id: string) {
    if (!activeDraft) return;
    updateDraft({
      ...activeDraft,
      entries: activeDraft.entries
        .filter((entry) => entry.id !== id)
        .map((entry, order) => ({ ...entry, order: order + 1 })),
    });
  }

  function addSubstitution(entryId: string, foodId: string) {
    if (!activeDraft) return;
    const food = view.foods.find((item) => item.id === foodId);
    const entry = activeDraft.entries.find((item) => item.id === entryId);
    if (!food || !entry) return;
    const substitution: FoodSubstitution = {
      id: `substitution-${Date.now()}`,
      scientificLibraryItemId: food.id,
      name: food.name,
      foodGroup: food.category,
      notes: "Equivalência não validada; requer revisão do nutricionista.",
      priority: entry.substitutions.length + 1,
    };
    updateEntry({
      ...entry,
      substitutions: [...entry.substitutions, substitution],
    });
  }

  function removeSubstitution(entryId: string, substitutionId: string) {
    if (!activeDraft) return;
    const entry = activeDraft.entries.find((item) => item.id === entryId);
    if (!entry) return;
    updateEntry({
      ...entry,
      substitutions: entry.substitutions
        .filter((item) => item.id !== substitutionId)
        .map((item, index) => ({ ...item, priority: index + 1 })),
    });
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addMeal() {
    const id = `meal-local-${Date.now()}`;
    const meal: PrescriptionMealReference = {
      id,
      name: "Nova refeição mockada",
      time: "12:00",
    };
    setMeals((current) => [...current, meal]);
    setDrafts((current) => [
      ...current,
      {
        mealId: id,
        time: meal.time,
        guidance: "",
        observations: "",
        preparation: "",
        entries: [],
      },
    ]);
    setActiveMealId(id);
    setMessage("Nova refeição demonstrativa criada no estado local.");
  }

  function duplicateMeal() {
    if (!activeDraft) return;
    const source = meals.find((meal) => meal.id === activeMealId);
    if (!source) return;
    const id = `meal-local-${Date.now()}-copy`;
    setMeals((current) => [
      ...current,
      { ...source, id, name: `${source.name} · cópia` },
    ]);
    setDrafts((current) => [
      ...current,
      {
        ...activeDraft,
        mealId: id,
        entries: activeDraft.entries.map((entry, index) => ({
          ...entry,
          id: `${entry.id}-meal-copy-${index}`,
          substitutions: entry.substitutions.map((substitution) => ({
            ...substitution,
            id: `${substitution.id}-meal-copy-${index}`,
          })),
        })),
      },
    ]);
    setActiveMealId(id);
    setMessage("Refeição duplicada no estado local demonstrativo.");
  }

  function deleteMeal() {
    if (meals.length <= 1) {
      setMessage("O mock mantém ao menos uma refeição para edição.");
      return;
    }
    const currentIndex = meals.findIndex((meal) => meal.id === activeMealId);
    const nextMeals = meals.filter((meal) => meal.id !== activeMealId);
    const nextActive = nextMeals[Math.max(0, currentIndex - 1)]?.id ?? "";
    setMeals(nextMeals);
    setDrafts((current) =>
      current.filter((draft) => draft.mealId !== activeMealId),
    );
    setActiveMealId(nextActive);
    setMessage("Refeição removida do estado local demonstrativo.");
  }

  if (!activeDraft) return null;
  const dailyEntryCount = drafts.reduce(
    (total, draft) => total + draft.entries.length,
    0,
  );

  return (
    <section aria-labelledby="nutrition-engine-title" className="space-y-3">
      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 lg:w-44 lg:shrink-0">
            <p
              className="font-black text-slate-950"
              id="nutrition-engine-title"
            >
              Montagem das refeições
            </p>
            <p aria-live="polite" className="mt-0.5 text-xs text-slate-600">
              {message}
            </p>
          </div>

          <div
            aria-label="Refeições do plano"
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1"
            role="tablist"
          >
            {meals.map((meal) => {
              const selected = meal.id === activeMealId;
              return (
                <button
                  aria-selected={selected}
                  className={`min-h-10 shrink-0 rounded-xl border px-3 text-sm font-black transition ${
                    selected
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  key={meal.id}
                  onClick={() => setActiveMealId(meal.id)}
                  role="tab"
                  type="button"
                >
                  {meal.time} {meal.name}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-wrap gap-1">
            <Button onClick={addMeal} size="small" type="button">
              Nova refeição
            </Button>
            <Button
              onClick={duplicateMeal}
              size="small"
              type="button"
              variant="outline"
            >
              Duplicar
            </Button>
            <Button
              onClick={deleteMeal}
              size="small"
              type="button"
              variant="destructive"
            >
              Excluir
            </Button>
          </div>
        </div>
      </Card>

      <NutritionLibraryPanel
        favorites={favorites}
        foods={view.foods}
        onAdd={add}
        onToggleFavorite={toggleFavorite}
        recipes={view.recipes}
        supplements={view.supplements}
      />

      <MealAssemblyPanel
        activeMealId={activeMealId}
        dailyEntryCount={dailyEntryCount}
        dailySummary={dailySummary}
        draft={activeDraft}
        foods={view.foods}
        meals={meals}
        onAddSubstitution={addSubstitution}
        onChangeDraft={updateDraft}
        onChangeEntry={updateEntry}
        onDelete={remove}
        onDuplicate={duplicate}
        onMove={move}
        onRemoveSubstitution={removeSubstitution}
        onSave={() =>
          setMessage("Alterações salvas no estado local demonstrativo.")
        }
        onSelectMeal={setActiveMealId}
      />

      <Badge tone="info">Dados demonstrativos · sem prescrição automática</Badge>
    </section>
  );
}
