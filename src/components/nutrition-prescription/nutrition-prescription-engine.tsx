"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import type { FoodSubstitution, NutritionPrescriptionView, PrescriptionEntryKind, PrescriptionMealDraft, PrescriptionMealEntry } from "@/features/nutrition-prescription";
import type { ScientificLibraryItem } from "@/features/scientific-library";
import { MealAssemblyPanel } from "./meal-assembly-panel";
import { NutritionLibraryPanel } from "./nutrition-library-panel";

const attribute = (item: ScientificLibraryItem, key: string): string => { const value = item.attributes[key]; return typeof value === "string" ? value : value?.[0] ?? ""; };

export function NutritionPrescriptionEngine({ view }: { view: NutritionPrescriptionView }) {
  const [activeMealId, setActiveMealId] = useState(view.meals[0]?.id ?? "");
  const [drafts, setDrafts] = useState<PrescriptionMealDraft[]>(() => view.meals.map((meal) => ({ mealId: meal.id, time: meal.time, guidance: "", observations: "", preparation: "", entries: [] })));
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(view.foods.filter((item) => item.initiallyFavorite).map((item) => item.id)));
  const [message, setMessage] = useState("Motor pronto para edição manual. Nenhum alimento foi adicionado automaticamente.");
  const activeDraft = drafts.find((draft) => draft.mealId === activeMealId) ?? drafts[0];
  function updateDraft(next: PrescriptionMealDraft) { setDrafts((items) => items.map((item) => item.mealId === next.mealId ? next : item)); setMessage("Alterações locais ainda não salvas."); }
  function add(item: ScientificLibraryItem, kind: PrescriptionEntryKind) {
    if (!activeDraft) return;
    const entry: PrescriptionMealEntry = { id: `entry-${Date.now()}-${activeDraft.entries.length}`, scientificLibraryItemId: item.id, kind, name: item.name, quantity: "", householdMeasure: kind === "FOOD" ? attribute(item, "Medida caseira") : "", notes: "", order: activeDraft.entries.length + 1, group: item.category, substitutions: [] };
    updateDraft({ ...activeDraft, entries: [...activeDraft.entries, entry] });
    setMessage(`${item.name} adicionado manualmente à refeição ativa.`);
  }
  function updateEntry(entry: PrescriptionMealEntry) { if (!activeDraft) return; updateDraft({ ...activeDraft, entries: activeDraft.entries.map((item) => item.id === entry.id ? entry : item) }); }
  function move(id: string, direction: -1 | 1) { if (!activeDraft) return; const entries = [...activeDraft.entries]; const index = entries.findIndex((entry) => entry.id === id); const target = index + direction; if (index < 0 || target < 0 || target >= entries.length) return; [entries[index], entries[target]] = [entries[target], entries[index]]; updateDraft({ ...activeDraft, entries: entries.map((entry, order) => ({ ...entry, order: order + 1 })) }); }
  function duplicate(id: string) { if (!activeDraft) return; const source = activeDraft.entries.find((entry) => entry.id === id); if (!source) return; const copy = { ...source, id: `entry-${Date.now()}-copy`, name: `${source.name} · cópia`, order: activeDraft.entries.length + 1, substitutions: source.substitutions.map((item) => ({ ...item, id: `${item.id}-copy` })) }; updateDraft({ ...activeDraft, entries: [...activeDraft.entries, copy] }); }
  function remove(id: string) { if (!activeDraft) return; updateDraft({ ...activeDraft, entries: activeDraft.entries.filter((entry) => entry.id !== id).map((entry, order) => ({ ...entry, order: order + 1 })) }); }
  function addSubstitution(entryId: string, foodId: string) { if (!activeDraft) return; const food = view.foods.find((item) => item.id === foodId); const entry = activeDraft.entries.find((item) => item.id === entryId); if (!food || !entry) return; const substitution: FoodSubstitution = { id: `substitution-${Date.now()}`, scientificLibraryItemId: food.id, name: food.name, foodGroup: food.category, notes: "Equivalência não validada; requer revisão do nutricionista.", priority: entry.substitutions.length + 1 }; updateEntry({ ...entry, substitutions: [...entry.substitutions, substitution] }); }
  function removeSubstitution(entryId: string, substitutionId: string) { if (!activeDraft) return; const entry = activeDraft.entries.find((item) => item.id === entryId); if (!entry) return; updateEntry({ ...entry, substitutions: entry.substitutions.filter((item) => item.id !== substitutionId).map((item, index) => ({ ...item, priority: index + 1 })) }); }
  function toggleFavorite(id: string) { setFavorites((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  if (!activeDraft) return null;
   return (
    <section
      aria-labelledby="nutrition-engine-title"
      className="space-y-4"
    >
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            id="nutrition-engine-title"
            className="text-lg font-black text-slate-950"
          >
            Plano Alimentar
          </p>

          <p
            aria-live="polite"
            className="mt-1 text-sm text-slate-600"
          >
            {message}
          </p>
        </div>

        <Badge tone="warning">
          Em elaboração
        </Badge>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <Card className="p-3">
          <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">
            Refeições
          </p>

          <div className="space-y-2">
            {view.meals.map((meal) => {
              const selected = meal.id === activeMealId;

              return (
                <button
                  key={meal.id}
                  type="button"
                  onClick={() => setActiveMealId(meal.id)}
                  className={[
                    "w-full rounded-xl border px-3 py-3 text-left transition",
                    selected
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  ].join(" ")}
                >
                  <span className="block text-xs font-bold text-slate-500">
                    {meal.time}
                  </span>

                  <span className="mt-1 block text-sm font-black text-slate-900">
                    {meal.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <MealAssemblyPanel
            activeMealId={activeMealId}
            draft={activeDraft}
            foods={view.foods}
            meals={view.meals}
            onAddSubstitution={addSubstitution}
            onChangeDraft={updateDraft}
            onChangeEntry={updateEntry}
            onDelete={remove}
            onDuplicate={duplicate}
            onMove={move}
            onRemoveSubstitution={removeSubstitution}
            onSave={() =>
              setMessage(
                "Alterações salvas no estado local demonstrativo."
              )
            }
            onSelectMeal={setActiveMealId}
          />

          <details className="rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-4 py-4 text-sm font-black text-slate-900">
              Adicionar alimento, receita ou suplemento
            </summary>

            <div className="border-t border-slate-200 p-4">
              <NutritionLibraryPanel
                favorites={favorites}
                foods={view.foods}
                onAdd={add}
                onToggleFavorite={toggleFavorite}
                recipes={view.recipes}
                supplements={view.supplements}
              />
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
