"use client";

import { useState } from "react";

import {
  Button,
  Card,
  Divider,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { MealPlanMeal } from "@/features/meal-plan";

interface MealEditorProps {
  meal: MealPlanMeal;
  editing: boolean;
  onChange: (meal: MealPlanMeal) => void;
  onClose: () => void;
  onSave: () => void;
}

export function MealEditor({
  meal,
  editing,
  onChange,
  onClose,
  onSave,
}: MealEditorProps) {
  const [replacementFoodId, setReplacementFoodId] = useState<string>();

  function updateFood(
    foodId: string,
    changes: Partial<MealPlanMeal["foods"][number]>,
  ) {
    onChange({
      ...meal,
      foods: meal.foods.map((food) =>
        food.id === foodId
          ? {
              ...food,
              ...changes,
            }
          : food,
      ),
    });
  }

  function removeFood(foodId: string) {
    const food = meal.foods.find((item) => item.id === foodId);

    if (!food) return;

    const confirmed = window.confirm(
      `Remover “${food.name}” desta refeição?`,
    );

    if (!confirmed) return;

    onChange({
      ...meal,
      foods: meal.foods.filter((item) => item.id !== foodId),
    });

    if (replacementFoodId === foodId) {
      setReplacementFoodId(undefined);
    }
  }

  function replaceFood(foodId: string, replacementName: string) {
    const replacement = replacementName.trim();

    if (!replacement) return;

    const currentFood = meal.foods.find((item) => item.id === foodId);

    if (!currentFood) return;

    updateFood(foodId, {
      name: replacement,
      substitutions: [
        currentFood.name,
        ...currentFood.substitutions.filter(
          (item) =>
            item.toLocaleLowerCase("pt-BR") !==
            replacement.toLocaleLowerCase("pt-BR"),
        ),
      ],
    });

    setReplacementFoodId(undefined);
  }

  return (
    <Card
      className="p-4 sm:p-5"
      variant="elevated"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
            Editor da refeição
          </p>

          <h3 className="mt-1 text-xl font-black text-[var(--text-primary)]">
            {meal.name}
          </h3>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            {meal.foods.length}{" "}
            {meal.foods.length === 1
              ? "alimento registrado"
              : "alimentos registrados"}
          </p>
        </div>

        <Button
          onClick={onClose}
          size="small"
          type="button"
          variant="ghost"
        >
          Fechar
        </Button>
      </div>

      <Divider className="my-5" />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="meal-name"
          label="Nome da refeição"
        >
          <Input
            disabled={!editing}
            id="meal-name"
            onChange={(event) =>
              onChange({
                ...meal,
                name: event.target.value,
              })
            }
            value={meal.name}
          />
        </FormField>

        <FormField
          id="meal-time"
          label="Horário"
        >
          <Input
            disabled={!editing}
            id="meal-time"
            onChange={(event) =>
              onChange({
                ...meal,
                time: event.target.value,
              })
            }
            type="time"
            value={meal.time}
          />
        </FormField>

        <FormField
          className="sm:col-span-2"
          id="meal-objective"
          label="Objetivo da refeição"
        >
          <Select
            disabled={!editing}
            id="meal-objective"
            onChange={(event) =>
              onChange({
                ...meal,
                objective: event.target.value,
              })
            }
            value={meal.objective}
          >
            <option value={meal.objective}>
              {meal.objective}
            </option>

            <option value="Objetivo a confirmar pelo nutricionista">
              Objetivo a confirmar pelo nutricionista
            </option>
          </Select>
        </FormField>
      </div>

      <Divider className="my-5" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-[var(--text-primary)]">
            Alimentos da refeição
          </h4>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            Edite quantidade, medida caseira e substituições no
            mesmo bloco.
          </p>
        </div>

        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
          Revisão do nutricionista
        </span>
      </div>

      {meal.foods.length > 0 ? (
        <div className="mt-4 space-y-3">
          {meal.foods.map((food, index) => {
            const replacementOpen =
              replacementFoodId === food.id;

            return (
              <section
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                key={food.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12664f] text-xs font-black text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {food.name}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {food.quantity || "Quantidade não informada"}
                        {food.householdMeasure
                          ? ` · ${food.householdMeasure}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {editing ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          setReplacementFoodId((current) =>
                            current === food.id
                              ? undefined
                              : food.id,
                          )
                        }
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        Substituir
                      </Button>

                      <Button
                        onClick={() => removeFood(food.id)}
                        size="small"
                        type="button"
                        variant="ghost"
                      >
                        Remover
                      </Button>
                    </div>
                  ) : null}
                </div>

                {replacementOpen ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-black text-emerald-950">
                      Substituir alimento
                    </p>

                    <p className="mt-1 text-xs font-semibold text-emerald-800">
                      Selecione uma substituição previamente
                      cadastrada. O alimento atual será preservado na
                      lista de alternativas.
                    </p>

                    {food.substitutions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {food.substitutions.map((substitution) => (
                          <button
                            className="min-h-10 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-100"
                            key={substitution}
                            onClick={() =>
                              replaceFood(
                                food.id,
                                substitution,
                              )
                            }
                            type="button"
                          >
                            {substitution}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-slate-500">
                        Nenhuma substituição foi cadastrada para este
                        alimento.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FormField
                    id={`food-name-${food.id}`}
                    label="Alimento"
                  >
                    <Input
                      disabled={!editing}
                      id={`food-name-${food.id}`}
                      onChange={(event) =>
                        updateFood(food.id, {
                          name: event.target.value,
                        })
                      }
                      value={food.name}
                    />
                  </FormField>

                  <FormField
                    id={`food-quantity-${food.id}`}
                    label="Quantidade"
                  >
                    <Input
                      disabled={!editing}
                      id={`food-quantity-${food.id}`}
                      onChange={(event) =>
                        updateFood(food.id, {
                          quantity: event.target.value,
                        })
                      }
                      value={food.quantity}
                    />
                  </FormField>

                  <FormField
                    id={`household-measure-${food.id}`}
                    label="Medida caseira"
                  >
                    <Input
                      disabled={!editing}
                      id={`household-measure-${food.id}`}
                      onChange={(event) =>
                        updateFood(food.id, {
                          householdMeasure:
                            event.target.value,
                        })
                      }
                      value={food.householdMeasure}
                    />
                  </FormField>

                  <FormField
                    help="Separe as opções por vírgula."
                    id={`substitutions-${food.id}`}
                    label="Substituições"
                  >
                    <Input
                      disabled={!editing}
                      id={`substitutions-${food.id}`}
                      onChange={(event) =>
                        updateFood(food.id, {
                          substitutions:
                            event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                        })
                      }
                      value={food.substitutions.join(", ")}
                    />
                  </FormField>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="font-black text-slate-900">
            Nenhum alimento registrado
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Esta refeição ainda não possui itens alimentares.
          </p>
        </div>
      )}

      <Divider className="my-5" />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          className="sm:col-span-2"
          id="meal-observations"
          label="Observações profissionais"
        >
          <Textarea
            disabled={!editing}
            id="meal-observations"
            onChange={(event) =>
              onChange({
                ...meal,
                observations: event.target.value,
              })
            }
            value={meal.observations}
          />
        </FormField>

        <FormField
          id="meal-supplements"
          label="Suplementos"
        >
          <Textarea
            disabled={!editing}
            id="meal-supplements"
            onChange={(event) =>
              onChange({
                ...meal,
                supplements: event.target.value,
              })
            }
            value={meal.supplements}
          />
        </FormField>

        <FormField
          id="meal-hydration"
          label="Hidratação"
        >
          <Textarea
            disabled={!editing}
            id="meal-hydration"
            onChange={(event) =>
              onChange({
                ...meal,
                hydration: event.target.value,
              })
            }
            value={meal.hydration}
          />
        </FormField>
      </div>

      {editing ? (
        <div className="mt-5 flex justify-end">
          <Button
            onClick={onSave}
            type="button"
          >
            Salvar alterações
          </Button>
        </div>
      ) : null}
    </Card>
  );
}