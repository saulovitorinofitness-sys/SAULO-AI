import {
  Button,
  Card,
  FormField,
  Input,
  SectionHeader,
  Select,
  Textarea,
} from "@/components/ui";
import type { NutritionSummary as DailyNutritionSummary } from "@/features/meal-plan";
import type {
  PrescriptionMealDraft,
  PrescriptionMealEntry,
  PrescriptionMealReference,
} from "@/features/nutrition-prescription";
import type { ScientificLibraryItem } from "@/features/scientific-library";

interface MealAssemblyPanelProps {
  meals: readonly PrescriptionMealReference[];
  activeMealId: string;
  draft: PrescriptionMealDraft;
  foods: readonly ScientificLibraryItem[];
  dailyEntryCount: number;
  dailySummary: DailyNutritionSummary;
  onSelectMeal: (id: string) => void;
  onChangeDraft: (draft: PrescriptionMealDraft) => void;
  onChangeEntry: (entry: PrescriptionMealEntry) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAddSubstitution: (entryId: string, foodId: string) => void;
  onRemoveSubstitution: (entryId: string, substitutionId: string) => void;
  onSave: () => void;
}

function measureParts(value: string) {
  const [
    measure = "",
    totalAmount = "",
    rawUnit = "g",
    rawEquivalence = "",
    mode = "manual",
    associationId = "",
    demonstrativeFlag = "",
    officialSource = "",
  ] = value.split("||", 8);
  return {
    measure,
    totalAmount,
    unit: rawUnit === "ml" ? ("ml" as const) : ("g" as const),
    unitEquivalence: rawEquivalence ? Number(rawEquivalence) : null,
    estimated: mode === "estimated",
    associationId,
    demonstrative: demonstrativeFlag === "demonstrative",
    officialSource: officialSource || null,
  };
}

type StoredMeasure = ReturnType<typeof measureParts>;

function encodeStoredMeasure(value: StoredMeasure) {
  return [
    value.measure,
    value.totalAmount,
    value.unit,
    value.unitEquivalence === null ? "" : String(value.unitEquivalence),
    value.estimated ? "estimated" : "manual",
    value.associationId,
    value.demonstrative ? "demonstrative" : "",
    value.officialSource ?? "",
  ].join("||");
}

export function MealAssemblyPanel({
  meals,
  activeMealId,
  draft,
  foods,
  dailyEntryCount,
  dailySummary,
  onSelectMeal,
  onChangeDraft,
  onChangeEntry,
  onMove,
  onDuplicate,
  onDelete,
  onAddSubstitution,
  onRemoveSubstitution,
  onSave,
}: MealAssemblyPanelProps) {
  return (
    <Card className="p-3 sm:p-4">
      <SectionHeader
        action={
          <Button onClick={onSave} size="small">
            Salvar montagem mockada
          </Button>
        }
        description="Edição manual secundária com dados demonstrativos e revisão profissional."
        eyebrow="Edição manual"
        title="Itens da refeição"
      />

      <div className="mt-3 grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-2.5 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-end">
        <FormField id="prescription-meal" label="Refeição ativa">
          <Select
            id="prescription-meal"
            onChange={(event) => onSelectMeal(event.target.value)}
            value={activeMealId}
          >
            {meals.map((meal) => (
              <option key={meal.id} value={meal.id}>
                {meal.time} {meal.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="prescription-time" label="Horário">
          <Input
            id="prescription-time"
            onChange={(event) =>
              onChangeDraft({ ...draft, time: event.target.value })
            }
            type="time"
            value={draft.time}
          />
        </FormField>
      </div>

      {draft.entries.length ? (
        <div className="mt-3" role="table" aria-label="Itens da refeição">
          <div
            className="hidden gap-2 border-b border-[var(--line)] px-2 pb-2 text-[0.68rem] font-black uppercase tracking-wide text-[var(--muted)] lg:grid lg:grid-cols-[minmax(12rem,2fr)_minmax(8rem,1fr)_6rem_minmax(7rem,0.8fr)_3rem_3rem_3rem_3rem_auto]"
            role="row"
          >
            <span role="columnheader">Alimento</span>
            <span role="columnheader">Medida</span>
            <span role="columnheader">Quantidade</span>
            <span role="columnheader">g/ml</span>
            <span role="columnheader">kcal</span>
            <span role="columnheader">P</span>
            <span role="columnheader">C</span>
            <span role="columnheader">G</span>
            <span role="columnheader">Ações</span>
          </div>

          <div className="mt-2 grid gap-2" role="rowgroup">
            {draft.entries.map((entry, index) => {
              const storedMeasure = measureParts(entry.householdMeasure);

              return (
                <div
                  className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 lg:grid-cols-[minmax(12rem,2fr)_minmax(8rem,1fr)_6rem_minmax(7rem,0.8fr)_3rem_3rem_3rem_3rem_auto] lg:items-end lg:p-2"
                  key={entry.id}
                  role="row"
                >
                  <label role="cell">
                    <span className="text-xs font-bold text-[var(--muted)] lg:sr-only">
                      Alimento
                    </span>
                    <Input
                      aria-label={`Alimento ${index + 1}`}
                      className="mt-1 lg:mt-0"
                      onChange={(event) =>
                        onChangeEntry({ ...entry, name: event.target.value })
                      }
                      value={entry.name}
                    />
                  </label>

                  <div className="rounded-lg bg-white px-2 py-2 text-xs" role="cell">
                    <span className="font-bold text-[var(--muted)] lg:sr-only">
                      Medida caseira
                    </span>
                    <p className="font-black text-[var(--text-primary)]">
                      {storedMeasure.measure || "Não informada"}
                    </p>
                    {storedMeasure.unitEquivalence !== null ? (
                      <p className="mt-0.5 text-[var(--muted)]">
                        1 {storedMeasure.measure} ={" "}
                        {storedMeasure.unitEquivalence}{" "}
                        {storedMeasure.unit}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[var(--muted)]">
                        Entrada manual
                      </p>
                    )}
                  </div>

                  <label role="cell">
                    <span className="text-xs font-bold text-[var(--muted)] lg:sr-only">
                      Quantidade
                    </span>
                    <Input
                      aria-label={`Quantidade de ${entry.name}`}
                      className="mt-1 lg:mt-0"
                      disabled={storedMeasure.unitEquivalence === null}
                      onChange={(event) =>
                        onChangeEntry({
                          ...entry,
                          quantity: event.target.value,
                          householdMeasure: encodeStoredMeasure({
                            ...storedMeasure,
                            totalAmount:
                              storedMeasure.unitEquivalence !== null &&
                              Number(event.target.value.replace(",", ".")) > 0
                                ? String(
                                    storedMeasure.unitEquivalence *
                                      Number(
                                        event.target.value.replace(",", "."),
                                      ),
                                  )
                                : "",
                          }),
                        })
                      }
                      placeholder={
                        storedMeasure.unitEquivalence === null ? "—" : undefined
                      }
                      value={entry.quantity}
                    />
                  </label>

                  <label role="cell">
                    <span className="text-xs font-bold text-[var(--muted)] lg:sr-only">
                      Gramagem ou volume
                    </span>
                    <Input
                      aria-label={`Gramagem ou volume de ${entry.name}`}
                      className="mt-1 lg:mt-0"
                      disabled={storedMeasure.estimated}
                      onChange={(event) =>
                        onChangeEntry({
                          ...entry,
                          householdMeasure: encodeStoredMeasure({
                            ...storedMeasure,
                            totalAmount: event.target.value,
                          }),
                        })
                      }
                      placeholder={`Total em ${storedMeasure.unit}`}
                      value={storedMeasure.totalAmount}
                    />
                    <span className="mt-0.5 block text-[0.68rem] text-[var(--muted)]">
                      {storedMeasure.totalAmount
                        ? `${storedMeasure.totalAmount} ${storedMeasure.unit}${
                            storedMeasure.estimated ? " · estimado" : ""
                          }`
                        : "Não informado"}
                    </span>
                  </label>

                  {(["kcal", "P", "C", "G"] as const).map((label) => (
                    <div
                      className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-xs lg:block lg:bg-transparent lg:px-0 lg:py-3 lg:text-center"
                      key={label}
                      role="cell"
                    >
                      <span className="font-bold text-[var(--muted)] lg:sr-only">
                        {label}
                      </span>
                      <span
                        aria-label={`${label} não calculado`}
                        className="font-black text-[var(--text-secondary)]"
                      >
                        —
                      </span>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-1" role="cell">
                    <Button
                      aria-label={`Mover ${entry.name} para cima`}
                      disabled={index === 0}
                      onClick={() => onMove(entry.id, -1)}
                      size="small"
                      variant="ghost"
                    >
                      ↑
                    </Button>
                    <Button
                      aria-label={`Mover ${entry.name} para baixo`}
                      disabled={index === draft.entries.length - 1}
                      onClick={() => onMove(entry.id, 1)}
                      size="small"
                      variant="ghost"
                    >
                      ↓
                    </Button>
                    <Button
                      onClick={() => onDuplicate(entry.id)}
                      size="small"
                      variant="outline"
                    >
                      Duplicar
                    </Button>
                    <Button
                      onClick={() => onDelete(entry.id)}
                      size="small"
                      variant="destructive"
                    >
                      Excluir
                    </Button>

                    {entry.kind === "FOOD" ? (
                      <Select
                        aria-label={`Substituir ${entry.name}`}
                        onChange={(event) => {
                          const selectedFood = foods.find(
                            (food) => food.id === event.target.value,
                          );

                          if (!selectedFood || selectedFood.domain !== "FOOD") {
                            return;
                          }

                          onChangeEntry({
                            ...entry,
                            name: selectedFood.name,
                            scientificLibraryItemId: selectedFood.id,
                            group: selectedFood.category,
                          });

                          event.target.value = "";
                        }}
                        value=""
                      >
                        <option value="">Substituir</option>
                        {foods
                          .filter((food) => {
                            const currentFood = foods.find(
                              (item) =>
                                item.id === entry.scientificLibraryItemId,
                            );

                            return (
                              food.id !== entry.scientificLibraryItemId &&
                              food.domain === "FOOD" &&
                              currentFood?.domain === "FOOD" &&
                              food.attributes.foodGroup ===
                                currentFood.attributes.foodGroup
                            );
                          })
                          .map((food) => (
                            <option key={food.id} value={food.id}>
                              {food.name}
                            </option>
                          ))}
                      </Select>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                    <div className="px-3 py-2 text-xs font-bold">
                      Substituir alimento
                    </div>
                    <div className="grid gap-3 border-t border-[var(--line)] p-3 sm:grid-cols-2">
                      <FormField
                        id={`entry-group-${entry.id}`}
                        label="Agrupamento"
                      >
                        <Input
                          id={`entry-group-${entry.id}`}
                          onChange={(event) =>
                            onChangeEntry({
                              ...entry,
                              group: event.target.value,
                            })
                          }
                          value={entry.group}
                        />
                      </FormField>
                      <FormField
                        id={`entry-notes-${entry.id}`}
                        label="Observação"
                      >
                        <Input
                          id={`entry-notes-${entry.id}`}
                          onChange={(event) =>
                            onChangeEntry({
                              ...entry,
                              notes: event.target.value,
                            })
                          }
                          value={entry.notes}
                        />
                      </FormField>

                      {entry.kind === "FOOD" ? (
                        <div className="border-t border-[var(--line)] pt-3 sm:col-span-2">
                          <label
                            className="text-xs font-black text-[var(--text-secondary)]"
                            htmlFor={`substitution-${entry.id}`}
                          >
                            Criar substituição
                          </label>
                          <Select
                            className="mt-1"
                            defaultValue=""
                            id={`substitution-${entry.id}`}
                            onChange={(event) => {
                              if (event.target.value) {
                                onAddSubstitution(entry.id, event.target.value);
                              }
                              event.target.value = "";
                            }}
                          >
                            <option value="">
                              Selecionar alimento para revisão profissional
                            </option>
                            {foods
                              .filter((food) => {
                                const currentFood = foods.find(
                                  (item) =>
                                    item.id ===
                                    entry.scientificLibraryItemId,
                                );

                                return (
                                  food.id !==
                                    entry.scientificLibraryItemId &&
                                  food.domain === "FOOD" &&
                                  currentFood?.domain === "FOOD" &&
                                  food.attributes.foodGroup ===
                                    currentFood.attributes.foodGroup &&
                                  !entry.substitutions.some(
                                    (substitution) =>
                                      substitution.scientificLibraryItemId ===
                                      food.id,
                                  )
                                );
                              })
                              .map((food) => (
                                <option key={food.id} value={food.id}>
                                  {food.name} · {food.category}
                                </option>
                              ))}
                          </Select>

                          {entry.substitutions.length ? (
                            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                              {entry.substitutions.map((substitution) => (
                                <li
                                  className="flex items-start justify-between gap-2 rounded-lg border border-[var(--line)] p-2 text-xs"
                                  key={substitution.id}
                                >
                                  <div>
                                    <p className="font-black text-[var(--text-primary)]">
                                      {substitution.priority} ·{" "}
                                      {substitution.name}
                                    </p>
                                    <p className="mt-1 text-[var(--muted)]">
                                      {substitution.notes}
                                    </p>
                                  </div>
                                  <Button
                                    aria-label={`Remover substituição ${substitution.name}`}
                                    onClick={() =>
                                      onRemoveSubstitution(
                                        entry.id,
                                        substitution.id,
                                      )
                                    }
                                    size="small"
                                    variant="ghost"
                                  >
                                    Remover
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--line-strong)] p-4 text-center">
          <p className="font-black text-[var(--text-primary)]">
            Refeição sem itens
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Use a busca acima para adicionar alimento, receita ou suplemento.
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            Total da refeição
          </p>
          <p className="mt-1 font-black text-[var(--text-primary)]">
            {draft.entries.length} item(ns)
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            kcal, P, C e G não calculados neste mock.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            Total diário planejado · mock
          </p>
          <p className="mt-1 font-black text-[var(--text-primary)]">
            {dailySummary.plannedCalories} · P {dailySummary.protein} · C{" "}
            {dailySummary.carbohydrates} · G {dailySummary.fats}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {dailyEntryCount} item(ns) na montagem local.
          </p>
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-[var(--line)] bg-white">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-black text-[var(--text-primary)]">
          Ver análise completa
        </summary>
        <div className="border-t border-[var(--line)] p-3 text-sm text-[var(--text-secondary)]">
          Micronutrientes e composição por item não estão disponíveis nos mocks
          aprovados desta Sprint. Nenhum valor clínico foi estimado.
        </div>
      </details>

      <details className="mt-3 rounded-xl border border-[var(--line)] bg-white">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-black text-[var(--text-primary)]">
          Orientações e observações da refeição
        </summary>
        <div className="grid gap-3 border-t border-[var(--line)] p-3 sm:grid-cols-2">
          <FormField id="prescription-guidance" label="Orientações">
            <Textarea
              id="prescription-guidance"
              onChange={(event) =>
                onChangeDraft({ ...draft, guidance: event.target.value })
              }
              value={draft.guidance}
            />
          </FormField>
          <FormField id="prescription-preparation" label="Preparação">
            <Textarea
              id="prescription-preparation"
              onChange={(event) =>
                onChangeDraft({ ...draft, preparation: event.target.value })
              }
              value={draft.preparation}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            id="prescription-observations"
            label="Observações"
          >
            <Textarea
              id="prescription-observations"
              onChange={(event) =>
                onChangeDraft({ ...draft, observations: event.target.value })
              }
              value={draft.observations}
            />
          </FormField>
        </div>
      </details>
    </Card>
  );
}
