"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ClinicalField,
  clinicalInputClass,
} from "@/components/clinical-collection/clinical-field";
import { SectionCard } from "@/components/clinical-collection/section-card";
import { Button } from "@/components/ui/button";
import type {
  FoodSearchResult,
  FoodSearchSourceOption,
  ProfessionalFood,
} from "@/features/food-database";
import {
  emptyDetailedReturnAdherence,
  emptyReturnRecall24Hours,
  QUICK_RETURN_ADHERENCE_OPTIONS,
  QUICK_RETURN_CONDUCT_OPTIONS,
  QUICK_RETURN_DIFFICULTY_OPTIONS,
  RETURN_RECALL_PREPARATION_OPTIONS,
  type DetailedReturnAdherence,
  type LocalDatabaseRecallFood,
  type ManualRecallFood,
  type NutritionReturnAnamnesisData,
  type NutritionReturnAnamnesisView,
  type PreviousPlanConsumptionStatus,
  type ReturnRecallFood,
  type ReturnRecallItem,
  type ReturnRecallMeal,
  type ReturnRecallMeasureOption,
  type ReturnRecallRecipe,
} from "@/features/nutrition-return-anamnesis/contracts";
import {
  calculateReturnRecall,
  calculateReturnRecallFood,
} from "@/features/nutrition-return-anamnesis/recall-calculation";
import {
  createLocalRecallFoodFromCatalog,
  createRecallFromPreviousPlan,
  createUnselectedRecallFood,
  officialNameAlreadyDefinesPreparation,
  recallMeasureOptions,
  selectRecallMeasure,
} from "@/features/nutrition-return-anamnesis/recall-food-selection";
import type {
  ReturnFoodSafetyAllergen,
  ReturnFoodSafetyUpdate,
} from "@/features/nutrition-return-anamnesis/food-safety-update";

import { PreviousClinicalReferenceCard } from "./previous-clinical-reference";

const compactAreaClass = `${clinicalInputClass} min-h-16 resize-y py-2`;

type FoodSearchState = {
  readonly query: string;
  readonly sourceName: string;
  readonly loading: boolean;
  readonly error?: string;
  readonly items: readonly ProfessionalFood[];
};

type ConfirmedMeasureOption = {
  readonly id: string;
  readonly label: string;
  readonly measureName: string;
  readonly amountPerMeasure: number;
  readonly unit: "g" | "ml";
  readonly source: string;
};

function newId() {
  return crypto.randomUUID();
}

function emptyMeal(): ReturnRecallMeal {
  return {
    id: newId(),
    time: "",
    name: "",
    observations: "",
    items: [],
  };
}

function recallMealItems(meal: ReturnRecallMeal): readonly ReturnRecallItem[] {
  return meal.items ?? meal.foods;
}

function previousPlanConsumptionStatus(
  value: string,
): PreviousPlanConsumptionStatus {
  switch (value) {
    case "AS_PRESCRIBED":
    case "DIFFERENT_QUANTITY":
    case "SUBSTITUTED":
    case "NOT_CONSUMED":
    case "ADDED":
      return value;
    default:
      return "";
  }
}

function emptyManualFood(id = newId()): ManualRecallFood {
  return {
    id,
    source: "MANUAL",
    name: "",
    quantity: undefined,
    unit: "",
    preparation: "",
    brand: "",
    observations: "",
    compositionStatus: "MANUAL",
    consumedWeightUnit: "g",
    nutritionBasis: "NONE",
  };
}

function emptyUnselectedFood(sourcePlanEntryId?: string): ReturnRecallFood {
  const food = createUnselectedRecallFood(newId());
  return sourcePlanEntryId
    ? {
        ...food,
        previousPlanComparison: {
          sourcePlanEntryId,
          status: "ADDED",
        },
      }
    : food;
}

function emptyManualNutrients() {
  return {
    energyKcal: null,
    proteinGrams: null,
    carbohydratesGrams: null,
    fatsGrams: null,
    fiberGrams: null,
    sodiumMg: null,
  };
}

function positiveNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function catalogFoodIsCalculable(food: ProfessionalFood) {
  return Boolean(
    food.nutrients &&
      [
        food.nutrients.energyKcal,
        food.nutrients.proteinGrams,
        food.nutrients.carbohydratesGrams,
        food.nutrients.fatsGrams,
      ].every((value) => typeof value === "number" && Number.isFinite(value)),
  );
}

function nutritionNumber(value: number | null | undefined, unit: string) {
  return value === null || value === undefined
    ? "—"
    : `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 1,
      }).format(value)} ${unit}`;
}

function apiEndpoint(view: NutritionReturnAnamnesisView) {
  return (
    `/api/patients/${encodeURIComponent(view.patientId)}` +
    `/attendances/${encodeURIComponent(view.attendanceId)}` +
    "/return-anamnesis"
  );
}

function QuickChoice<T extends string>({
  disabled,
  label,
  name,
  onChange,
  options,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly name: string;
  readonly onChange: (value: T) => void;
  readonly options: readonly (readonly [T, string])[];
  readonly value: T | "";
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-slate-700">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map(([option, optionLabel]) => (
          <label
            className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-black transition focus-within:outline-2 focus-within:outline-emerald-700 ${
              value === option
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : "border-slate-200 bg-white text-slate-700"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            key={option}
          >
            <input
              checked={value === option}
              className="sr-only"
              disabled={disabled}
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            {optionLabel}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function OptionalCard({
  active,
  activationLabel,
  children,
  description,
  disabled,
  open,
  onActivate,
  onOpenChange,
  onRemove,
  removeLabel,
  title,
  id,
}: {
  readonly id?: string;
  readonly active: boolean;
  readonly activationLabel: string;
  readonly children: React.ReactNode;
  readonly description: string;
  readonly disabled: boolean;
  readonly open: boolean;
  readonly onActivate: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRemove: () => void;
  readonly removeLabel: string;
  readonly title: string;
}) {
  return (
    <section className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white shadow-sm" id={id}>
      <header className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black text-slate-900">{title}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
              {active ? "Incluído" : "Opcional"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!active ? (
            <Button
              disabled={disabled}
              onClick={onActivate}
              size="small"
              type="button"
              variant="secondary"
            >
              {activationLabel}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => onOpenChange(!open)}
                size="small"
                type="button"
                variant="outline"
              >
                {open ? "Recolher" : "Abrir"}
              </Button>
              <Button
                disabled={disabled}
                onClick={onRemove}
                size="small"
                type="button"
                variant="ghost"
              >
                {removeLabel}
              </Button>
            </>
          )}
        </div>
      </header>
      {active && open ? (
        <div className="border-t border-slate-100 p-3 sm:p-4">{children}</div>
      ) : null}
    </section>
  );
}

export function ReturnAnamnesis({
  canUpdateFoodSafety,
  initialFoodSafetyUpdate,
  initialView,
}: {
  readonly canUpdateFoodSafety: boolean;
  readonly initialFoodSafetyUpdate: ReturnFoodSafetyUpdate | null;
  readonly initialView: NutritionReturnAnamnesisView;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [data, setData] = useState<NutritionReturnAnamnesisData>(
    initialView.data,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"DRAFT" | "COMPLETE" | null>(null);
  const [foodSafetyUpdate, setFoodSafetyUpdate] = useState(
    initialFoodSafetyUpdate,
  );
  const [allergyStatus, setAllergyStatus] = useState<
    "NOT_INFORMED" | "DENIED" | "CONFIRMED"
  >(initialFoodSafetyUpdate?.status ?? "NOT_INFORMED");
  const [allergens, setAllergens] = useState<readonly ReturnFoodSafetyAllergen[]>(
    initialFoodSafetyUpdate?.allergens ?? [],
  );
  const [foodSafetyConfirmed, setFoodSafetyConfirmed] = useState(false);
  const [foodSafetySaving, setFoodSafetySaving] = useState(false);
  const [foodSafetyMessage, setFoodSafetyMessage] = useState("");
  const [showRecall, setShowRecall] = useState(false);
  const [showDetailedAdherence, setShowDetailedAdherence] = useState(false);
  const [notice, setNotice] = useState<{
    readonly tone: "SUCCESS" | "ERROR";
    readonly message: string;
  }>();
  const [foodSearch, setFoodSearch] = useState<
    Readonly<Record<string, FoodSearchState>>
  >({});
  const [foodSourceOptions, setFoodSourceOptions] = useState<
    readonly FoodSearchSourceOption[]
  >([]);
  const [measureOptionsByFood, setMeasureOptionsByFood] = useState<
    Readonly<Record<string, readonly ConfirmedMeasureOption[]>>
  >({});
  const searchTimers = useRef<
    Record<string, ReturnType<typeof setTimeout> | undefined>
  >({});
  const measuresLoading = useRef(new Set<string>());
  const measureCatalogByFood = useRef<Record<string, string | undefined>>({});
  const editable = view.canEdit && view.status !== "COMPLETED";
  const calculation = useMemo(
    () =>
      data.recall24h ? calculateReturnRecall(data.recall24h) : undefined,
    [data.recall24h],
  );
  const previousMealPlan = view.previousReference.mealPlan;
  const hasPreviousPlan = Boolean(
    previousMealPlan.entryId &&
      previousMealPlan.prescriptionMeals.some(
        (meal) => (meal.items ?? meal.foods).length > 0,
      ),
  );
  const recallUsesPreviousPlan = Boolean(
    data.recall24h?.meals.some((meal) =>
      recallMealItems(meal).some(
        (item) =>
          item.previousPlanComparison?.sourcePlanEntryId ===
          previousMealPlan.entryId,
      ),
    ),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(
    () => () => {
      for (const timer of Object.values(searchTimers.current)) {
        if (timer) clearTimeout(timer);
      }
    },
    [],
  );

  useEffect(() => {
    if (!data.recall24h || foodSourceOptions.length) return;
    let active = true;
    void fetch("/api/foods?pageSize=1", { cache: "no-store" })
      .then((response) =>
        response.ok ? (response.json() as Promise<FoodSearchResult>) : null,
      )
      .then((payload) => {
        if (active && payload?.sourceOptions) {
          setFoodSourceOptions(payload.sourceOptions);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [data.recall24h, foodSourceOptions.length]);

  useEffect(() => {
    const localFoods = data.recall24h?.meals.flatMap((meal) =>
      recallMealItems(meal).filter(
        (food): food is LocalDatabaseRecallFood =>
          food.source === "LOCAL_DATABASE",
      ),
    ) ?? [];
    for (const food of localFoods) {
      if (
        (measureOptionsByFood[food.id] !== undefined &&
          measureCatalogByFood.current[food.id] === food.catalogFoodId) ||
        measuresLoading.current.has(food.id)
      ) {
        continue;
      }
      measuresLoading.current.add(food.id);
      measureCatalogByFood.current[food.id] = food.catalogFoodId;
      void fetch(`/api/foods/${food.catalogFoodId}/household-measures`, {
        cache: "no-store",
      })
        .then((response) =>
          response.ok
            ? (response.json() as Promise<{
                readonly options?: readonly ConfirmedMeasureOption[];
              }>)
            : null,
        )
        .then((payload) => {
          if (
            measureCatalogByFood.current[food.id] !== food.catalogFoodId
          ) {
            return;
          }
          setMeasureOptionsByFood((current) => ({
            ...current,
            [food.id]: payload?.options ?? [],
          }));
        })
        .catch(() => {
          if (
            measureCatalogByFood.current[food.id] !== food.catalogFoodId
          ) {
            return;
          }
          setMeasureOptionsByFood((current) => ({
            ...current,
            [food.id]: [],
          }));
        })
        .finally(() => {
          if (
            measureCatalogByFood.current[food.id] === food.catalogFoodId
          ) {
            measuresLoading.current.delete(food.id);
          }
        });
    }
  }, [data.recall24h, measureOptionsByFood]);

  function change(
    update: (
      current: NutritionReturnAnamnesisData,
    ) => NutritionReturnAnamnesisData,
  ) {
    setData(update);
    setDirty(true);
    setNotice(undefined);
  }

  function updateRecall(
    update: (
      recall: NonNullable<NutritionReturnAnamnesisData["recall24h"]>,
    ) => NonNullable<NutritionReturnAnamnesisData["recall24h"]>,
  ) {
    change((current) => ({
      ...current,
      recall24h: update(current.recall24h ?? emptyReturnRecall24Hours()),
    }));
  }

  function updateMeal(
    mealId: string,
    update: (meal: ReturnRecallMeal) => ReturnRecallMeal,
  ) {
    updateRecall((recall) => ({
      ...recall,
      meals: recall.meals.map((meal) =>
        meal.id === mealId ? update(meal) : meal,
      ),
    }));
  }

  function updateFood(
    mealId: string,
    foodId: string,
    update: (food: ReturnRecallFood) => ReturnRecallFood,
  ) {
    updateMeal(mealId, (meal) => {
      if (meal.items) {
        return {
          ...meal,
          items: meal.items.map((item) =>
            item.source !== "RECIPE" && item.id === foodId
              ? update(item)
              : item,
          ),
        };
      }
      return {
        ...meal,
        foods: meal.foods.map((food) =>
          food.id === foodId ? update(food) : food,
        ),
      };
    });
  }

  function updateRecipe(
    mealId: string,
    recipeId: string,
    update: (recipe: ReturnRecallRecipe) => ReturnRecallRecipe,
  ) {
    updateMeal(mealId, (meal) => {
      if (!meal.items) return meal;
      return {
        ...meal,
        items: meal.items.map((item) =>
          item.source === "RECIPE" && item.id === recipeId
            ? update(item)
            : item,
        ),
      };
    });
  }

  function removeRecallItem(mealId: string, itemId: string) {
    updateMeal(mealId, (meal) => {
      if (meal.items) {
        return {
          ...meal,
          items: meal.items.filter((item) => item.id !== itemId),
        };
      }
      return {
        ...meal,
        foods: meal.foods.filter((food) => food.id !== itemId),
      };
    });
  }

  function appendRecallFood(mealId: string, food: ReturnRecallFood) {
    updateMeal(mealId, (meal) => {
      if (meal.items) {
        return { ...meal, items: [...meal.items, food] };
      }
      return { ...meal, foods: [...meal.foods, food] };
    });
  }

  function updateDetailed(
    update: (detailed: DetailedReturnAdherence) => DetailedReturnAdherence,
  ) {
    change((current) => ({
      ...current,
      detailedAdherence: update(
        current.detailedAdherence ?? emptyDetailedReturnAdherence(),
      ),
    }));
  }

  function searchState(food: ReturnRecallFood): FoodSearchState {
    return (
      foodSearch[food.id] ?? {
        query: food.name,
        sourceName: "ALL",
        loading: false,
        items: [],
      }
    );
  }

  function updateSearch(foodId: string, update: Partial<FoodSearchState>) {
    setFoodSearch((current) => ({
      ...current,
      [foodId]: {
        ...(current[foodId] ?? {
          query: "",
          sourceName: "ALL",
          loading: false,
          items: [],
        }),
        ...update,
      },
    }));
  }

  async function searchLocalFood(
    foodId: string,
    rawQuery: string,
    sourceName: string,
  ) {
    const query = rawQuery.trim();
    if (query.length < 2) {
      updateSearch(foodId, {
        error: undefined,
        items: [],
      });
      return;
    }
    updateSearch(foodId, { loading: true, error: undefined });
    const parameters = new URLSearchParams({ query, pageSize: "10" });
    if (sourceName !== "ALL") parameters.set("sourceName", sourceName);
    const response = await fetch(`/api/foods?${parameters}`, {
      cache: "no-store",
    }).catch(() => null);
    const payload = (await response?.json().catch(() => null)) as
      | FoodSearchResult
      | { readonly message?: string }
      | null;
    if (!response?.ok || !payload || !("items" in payload)) {
      updateSearch(foodId, {
        loading: false,
        items: [],
        error:
          (payload && "message" in payload && payload.message) ||
          "Não foi possível consultar a base local.",
      });
      return;
    }
    if (payload.sourceOptions) setFoodSourceOptions(payload.sourceOptions);
    setFoodSearch((current) => {
      const latest = current[foodId];
      if (
        latest &&
        (latest.query.trim() !== query || latest.sourceName !== sourceName)
      ) {
        return current;
      }
      return {
        ...current,
        [foodId]: {
          query: rawQuery,
          sourceName,
          loading: false,
          error: undefined,
          items: payload.items,
        },
      };
    });
  }

  function scheduleFoodSearch(
    foodId: string,
    query: string,
    sourceName: string,
  ) {
    const currentTimer = searchTimers.current[foodId];
    if (currentTimer) clearTimeout(currentTimer);
    updateSearch(foodId, {
      query,
      sourceName,
      loading: query.trim().length >= 2,
      error: undefined,
      ...(query.trim().length < 2 ? { items: [] } : {}),
    });
    if (query.trim().length < 2) return;
    searchTimers.current[foodId] = setTimeout(() => {
      void searchLocalFood(foodId, query, sourceName);
    }, 300);
  }

  function selectLocalFood(
    mealId: string,
    currentFood: ReturnRecallFood,
    selected: ProfessionalFood,
  ) {
    setMeasureOptionsByFood((current) => {
      const next = { ...current };
      delete next[currentFood.id];
      return next;
    });
    measuresLoading.current.delete(currentFood.id);
    measureCatalogByFood.current[currentFood.id] = undefined;
    updateFood(mealId, currentFood.id, (food) =>
      {
        const selectedFood = createLocalRecallFoodFromCatalog(selected, food);
        return selectedFood.previousPlanComparison?.sourceFoodId
          ? {
              ...selectedFood,
              previousPlanComparison: {
                ...selectedFood.previousPlanComparison,
                status: "SUBSTITUTED" as const,
              },
            }
          : selectedFood;
      },
    );
    updateSearch(currentFood.id, {
      query: selected.officialName,
      items: [selected],
      loading: false,
      error: undefined,
    });
  }

  function makeFoodManual(mealId: string, food: ReturnRecallFood) {
    const query = searchState(food).query.trim();
    updateFood(mealId, food.id, (current) => ({
      ...emptyManualFood(current.id),
      name: query || current.name,
      observations: current.observations,
      previousPlanComparison: current.previousPlanComparison?.sourceFoodId
        ? { ...current.previousPlanComparison, status: "SUBSTITUTED" }
        : current.previousPlanComparison,
    }));
    updateSearch(food.id, { items: [], error: undefined });
  }

  function changeSelectedFood(mealId: string, food: ReturnRecallFood) {
    setMeasureOptionsByFood((current) => {
      const next = { ...current };
      delete next[food.id];
      return next;
    });
    measuresLoading.current.delete(food.id);
    measureCatalogByFood.current[food.id] = undefined;
    updateFood(mealId, food.id, (current) => ({
      ...createUnselectedRecallFood(current.id),
      preparation: current.preparation,
      brand: current.brand,
      observations: current.observations,
      previousPlanComparison: current.previousPlanComparison?.sourceFoodId
        ? { ...current.previousPlanComparison, status: "SUBSTITUTED" }
        : current.previousPlanComparison,
    }));
    updateSearch(food.id, {
      query: "",
      sourceName: "ALL",
      loading: false,
      items: [],
      error: undefined,
    });
  }

  function removeRecall() {
    if (
      !window.confirm(
        "Remover o Recordatório apenas deste rascunho de retorno? Recordatórios históricos permanecerão preservados.",
      )
    ) {
      return;
    }
    change((current) => ({ ...current, recall24h: undefined }));
    setShowRecall(false);
  }

  function clearCurrentAttendanceRecall() {
    if (
      !window.confirm(
        "Limpar todo o Recordatório deste atendimento? Os demais dados da Anamnese, planos, avaliações e atendimentos anteriores permanecerão inalterados.",
      )
    ) {
      return;
    }
    change((current) => ({
      ...current,
      recall24h: emptyReturnRecall24Hours(),
    }));
  }

  function loadPreviousPlanReference() {
    if (!hasPreviousPlan) return;
    if (
      data.recall24h?.meals.length &&
      !window.confirm(
        "Substituir as refeições já digitadas pela cópia do plano alimentar anterior? O plano original permanecerá inalterado.",
      )
    ) {
      return;
    }
    const copied = createRecallFromPreviousPlan(previousMealPlan, newId);
    change((current) => ({
      ...current,
      recall24h: current.recall24h
        ? {
            ...copied,
            dayType: current.recall24h.dayType,
            referenceDate: current.recall24h.referenceDate,
            water: current.recall24h.water,
            beverages: current.recall24h.beverages,
            alcohol: current.recall24h.alcohol,
            supplements: current.recall24h.supplements,
          }
        : copied,
    }));
    setShowRecall(true);
  }

  function removeDetailedAdherence() {
    if (
      !window.confirm(
        "Remover a análise detalhada apenas deste rascunho de retorno?",
      )
    ) {
      return;
    }
    change((current) => ({ ...current, detailedAdherence: undefined }));
    setShowDetailedAdherence(false);
  }

  async function save(mode: "DRAFT" | "COMPLETE") {
    if (!editable || saving) return;
    if (
      mode === "COMPLETE" &&
      !window.confirm(
        "Concluir a Anamnese deste retorno? Esta ação concluirá somente a etapa do atendimento atual e não alterará o histórico permanente.",
      )
    ) {
      return;
    }

    setSaving(mode);
    setNotice(undefined);
    const response = await fetch(apiEndpoint(view), {
      method: mode === "COMPLETE" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "COMPLETE" ? { action: "COMPLETE", data } : { data },
      ),
    }).catch(() => null);
    const payload = (await response?.json().catch(() => null)) as {
      readonly view?: NutritionReturnAnamnesisView;
      readonly message?: string;
    } | null;

    if (!response?.ok || !payload?.view) {
      setSaving(null);
      setNotice({
        tone: "ERROR",
        message:
          payload?.message ??
          "Não foi possível salvar a Anamnese de retorno.",
      });
      return;
    }

    setView(payload.view);
    setData(payload.view.data);
    setDirty(false);
    setSaving(null);
    setShowRecall((current) => current && Boolean(payload.view?.data.recall24h));
    setShowDetailedAdherence(
      (current) => current && Boolean(payload.view?.data.detailedAdherence),
    );
    setNotice({
      tone: "SUCCESS",
      message:
        mode === "COMPLETE"
          ? "Anamnese do retorno concluída somente neste atendimento."
          : "Rascunho salvo sem concluir a etapa.",
    });
    router.refresh();
  }

  async function saveFoodSafetyUpdate() {
    if (
      !canUpdateFoodSafety ||
      foodSafetySaving ||
      allergyStatus === "NOT_INFORMED" ||
      !foodSafetyConfirmed ||
      (allergyStatus === "CONFIRMED" &&
        (!allergens.length || allergens.some((item) => !item.name.trim())))
    ) {
      setFoodSafetyMessage(
        "Selecione uma opção, preencha os alérgenos quando aplicável e confirme a revisão profissional.",
      );
      return;
    }
    setFoodSafetySaving(true);
    setFoodSafetyMessage("");
    const response = await fetch(
      `${apiEndpoint(view)}/food-safety`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: allergyStatus,
          allergens: allergyStatus === "DENIED" ? [] : allergens,
          professionalConfirmation: true,
        }),
      },
    ).catch(() => null);
    const result = (await response?.json().catch(() => null)) as {
      readonly update?: ReturnFoodSafetyUpdate;
      readonly message?: string;
    } | null;
    setFoodSafetySaving(false);
    if (!response?.ok || !result?.update) {
      setFoodSafetyMessage(
        result?.message ?? "Não foi possível salvar a atualização.",
      );
      return;
    }
    setFoodSafetyUpdate(result.update);
    setAllergyStatus(result.update.status);
    setAllergens(result.update.allergens);
    setFoodSafetyConfirmed(false);
    setFoodSafetyMessage("Atualização de segurança alimentar salva neste retorno.");
    router.refresh();
  }

  const recall = data.recall24h;
  const detailed = data.detailedAdherence;

  return (
    <div className="space-y-3">
      <PreviousClinicalReferenceCard reference={view.previousReference} />

      <SectionCard
        description="Registro complementar deste atendimento. A referência anterior permanece preservada e somente leitura."
        title="Atualização de segurança alimentar"
      >
        <fieldset disabled={!canUpdateFoodSafety || foodSafetySaving}>
          <legend className="text-sm font-bold text-slate-800">
            Situação atual das alergias alimentares
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([
              ["DENIED", "Paciente nega alergias alimentares"],
              ["CONFIRMED", "Paciente possui alergias alimentares"],
            ] as const).map(([value, label]) => (
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-bold" key={value}>
                <input
                  checked={allergyStatus === value}
                  name="return-food-allergy-status"
                  onChange={() => {
                    setAllergyStatus(value);
                    if (value === "DENIED") setAllergens([]);
                    if (value === "CONFIRMED" && !allergens.length) {
                      setAllergens([{ id: newId(), name: "", reaction: "" }]);
                    }
                    setFoodSafetyConfirmed(false);
                  }}
                  type="radio"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {allergyStatus === "CONFIRMED" ? (
          <div className="mt-3 space-y-2">
            {allergens.map((allergen, index) => (
              <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1.5fr_auto]" key={allergen.id}>
                <ClinicalField id={`return-allergen-${allergen.id}`} label={`Alérgeno ${index + 1}`}>
                  <input className={clinicalInputClass} disabled={!canUpdateFoodSafety || foodSafetySaving} id={`return-allergen-${allergen.id}`} onChange={(event) => setAllergens((items) => items.map((item) => item.id === allergen.id ? { ...item, name: event.target.value } : item))} value={allergen.name} />
                </ClinicalField>
                <ClinicalField id={`return-allergen-reaction-${allergen.id}`} label="Observações / reação">
                  <input className={clinicalInputClass} disabled={!canUpdateFoodSafety || foodSafetySaving} id={`return-allergen-reaction-${allergen.id}`} onChange={(event) => setAllergens((items) => items.map((item) => item.id === allergen.id ? { ...item, reaction: event.target.value } : item))} value={allergen.reaction} />
                </ClinicalField>
                <Button disabled={!canUpdateFoodSafety || foodSafetySaving} onClick={() => setAllergens((items) => items.filter((item) => item.id !== allergen.id))} size="small" type="button" variant="ghost">Remover</Button>
              </div>
            ))}
            <Button disabled={!canUpdateFoodSafety || foodSafetySaving} onClick={() => setAllergens((items) => [...items, { id: newId(), name: "", reaction: "" }])} size="small" type="button" variant="secondary">Adicionar alérgeno</Button>
          </div>
        ) : null}

        <label className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">
          <input checked={foodSafetyConfirmed} disabled={!canUpdateFoodSafety || foodSafetySaving || allergyStatus === "NOT_INFORMED"} onChange={(event) => setFoodSafetyConfirmed(event.target.checked)} type="checkbox" />
          Confirmo que revisei esta informação com o paciente neste atendimento de retorno.
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={!canUpdateFoodSafety || foodSafetySaving || !foodSafetyConfirmed} loading={foodSafetySaving} onClick={() => void saveFoodSafetyUpdate()} type="button">Salvar atualização</Button>
          {foodSafetyUpdate ? (
            <Button onClick={() => router.push(`/pacientes/${encodeURIComponent(view.patientId)}/plano-alimentar?attendanceId=${encodeURIComponent(view.attendanceId)}`)} type="button" variant="secondary">Voltar ao Plano Alimentar</Button>
          ) : null}
        </div>
        {foodSafetyUpdate ? (
          <p className="mt-3 text-xs font-bold text-emerald-800" role="status">
            Informação atualizada neste retorno em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(foodSafetyUpdate.confirmedAt))} por {foodSafetyUpdate.responsibleName}. Atendimento: {foodSafetyUpdate.attendanceId}.
          </p>
        ) : null}
        {foodSafetyMessage ? <p className="mt-2 text-xs font-bold text-slate-700" role="status">{foodSafetyMessage}</p> : null}
      </SectionCard>

      <SectionCard
        description="Registre apenas as decisões e mudanças relevantes deste atendimento."
        title="Retorno rápido"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <ClinicalField
              id="quick-evolution"
              hint="O que melhorou, piorou ou permaneceu igual."
              label="Evolução desde a última consulta"
            >
              <input
                className={clinicalInputClass}
                disabled={!editable}
                id="quick-evolution"
                onChange={(event) =>
                  change((current) => ({
                    ...current,
                    quickReturn: {
                      ...current.quickReturn,
                      evolutionSinceLastVisit: event.target.value,
                    },
                  }))
                }
                value={data.quickReturn.evolutionSinceLastVisit}
              />
            </ClinicalField>
          </div>

          <QuickChoice
            disabled={!editable}
            label="Adesão ao plano"
            name="quick-adherence"
            onChange={(adherence) =>
              change((current) => ({
                ...current,
                quickReturn: { ...current.quickReturn, adherence },
              }))
            }
            options={QUICK_RETURN_ADHERENCE_OPTIONS}
            value={data.quickReturn.adherence}
          />

          <ClinicalField id="quick-difficulty" label="Principal dificuldade">
            <select
              className={clinicalInputClass}
              disabled={!editable}
              id="quick-difficulty"
              onChange={(event) =>
                change((current) => ({
                  ...current,
                  quickReturn: {
                    ...current.quickReturn,
                    mainDifficulty: event.target.value as NutritionReturnAnamnesisData["quickReturn"]["mainDifficulty"],
                    otherDifficulty:
                      event.target.value === "OTHER"
                        ? current.quickReturn.otherDifficulty
                        : "",
                  },
                }))
              }
              value={data.quickReturn.mainDifficulty}
            >
              <option value="">Selecione</option>
              {QUICK_RETURN_DIFFICULTY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </ClinicalField>

          {data.quickReturn.mainDifficulty === "OTHER" ? (
            <div className="lg:col-span-2">
              <ClinicalField id="quick-other-difficulty" label="Outra dificuldade">
                <input
                  autoFocus
                  className={clinicalInputClass}
                  disabled={!editable}
                  id="quick-other-difficulty"
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      quickReturn: {
                        ...current.quickReturn,
                        otherDifficulty: event.target.value,
                      },
                    }))
                  }
                  value={data.quickReturn.otherDifficulty}
                />
              </ClinicalField>
            </div>
          ) : null}

          <div className="lg:col-span-2">
            <QuickChoice
              disabled={!editable}
              label="Houve alguma intercorrência desde a última consulta?"
              name="quick-intercurrence"
              onChange={(hadIntercurrence) =>
                change((current) => ({
                  ...current,
                  quickReturn: {
                    ...current.quickReturn,
                    hadIntercurrence,
                    intercurrenceDetails:
                      hadIntercurrence === "YES"
                        ? current.quickReturn.intercurrenceDetails
                        : "",
                  },
                }))
              }
              options={[
                ["NO", "Não"],
                ["YES", "Sim"],
              ] as const}
              value={data.quickReturn.hadIntercurrence}
            />
          </div>

          {data.quickReturn.hadIntercurrence === "YES" ? (
            <div className="lg:col-span-2">
              <ClinicalField
                id="quick-intercurrence-details"
                hint="Medicamentos, sintomas, exames, diagnóstico ou mudança importante da rotina."
                label="Detalhes da intercorrência"
              >
                <textarea
                  className={compactAreaClass}
                  disabled={!editable}
                  id="quick-intercurrence-details"
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      quickReturn: {
                        ...current.quickReturn,
                        intercurrenceDetails: event.target.value,
                      },
                    }))
                  }
                  value={data.quickReturn.intercurrenceDetails}
                />
              </ClinicalField>
            </div>
          ) : null}

          <ClinicalField id="quick-conduct" label="Conduta deste retorno">
            <select
              className={clinicalInputClass}
              disabled={!editable}
              id="quick-conduct"
              onChange={(event) =>
                change((current) => ({
                  ...current,
                  quickReturn: {
                    ...current.quickReturn,
                    conduct: event.target.value as NutritionReturnAnamnesisData["quickReturn"]["conduct"],
                  },
                }))
              }
              value={data.quickReturn.conduct}
            >
              <option value="">Selecione</option>
              {QUICK_RETURN_CONDUCT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </ClinicalField>

          <ClinicalField
            id="quick-professional-observation"
            label="Observação complementar da conduta"
          >
            <input
              className={clinicalInputClass}
              disabled={!editable}
              id="quick-professional-observation"
              onChange={(event) =>
                change((current) => ({
                  ...current,
                  quickReturn: {
                    ...current.quickReturn,
                    professionalObservation: event.target.value,
                  },
                }))
              }
              value={data.quickReturn.professionalObservation}
            />
          </ClinicalField>
        </div>

        {data.legacy ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Informações detalhadas registradas na versão anterior permanecem preservadas no prontuário.
          </p>
        ) : null}
      </SectionCard>

      <OptionalCard
        id="recordatorio-24h"
        activationLabel={
          hasPreviousPlan
            ? "Usar plano anterior como referência"
            : "Preencher recordatório manualmente"
        }
        active={Boolean(recall)}
        description={
          hasPreviousPlan
            ? "Existe um plano alimentar concluído. Use-o como referência editável, sem presumir o consumo e sem alterar o original."
            : "Nenhum plano alimentar anterior concluído foi encontrado para esta paciente. O preenchimento permanece manual."
        }
        disabled={!editable}
        onActivate={() => {
          if (hasPreviousPlan) {
            loadPreviousPlanReference();
          } else {
            change((current) => ({
              ...current,
              recall24h: current.recall24h ?? emptyReturnRecall24Hours(),
            }));
            setShowRecall(true);
          }
        }}
        onOpenChange={setShowRecall}
        onRemove={removeRecall}
        open={showRecall}
        removeLabel="Remover recordatório deste retorno"
        title="Recordatório alimentar de 24 horas"
      >
        {recall ? (
          <div className="space-y-3">
            {editable ? (
              <div className="flex justify-end">
                <Button
                  onClick={clearCurrentAttendanceRecall}
                  size="small"
                  type="button"
                  variant="destructive"
                >
                  Limpar recordatório deste atendimento
                </Button>
              </div>
            ) : null}
            {hasPreviousPlan && !recallUsesPreviousPlan ? (
              <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-sky-950">
                  O plano anterior está disponível, mas ainda não foi copiado para este retorno.
                </p>
                <Button
                  disabled={!editable}
                  onClick={loadPreviousPlanReference}
                  size="small"
                  type="button"
                >
                  Usar plano anterior como referência
                </Button>
              </div>
            ) : null}
            {!hasPreviousPlan ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                Nenhum plano alimentar anterior concluído foi encontrado. Adicione as refeições manualmente.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <ClinicalField id="recall-day-type" label="Tipo de dia">
                <select
                  className={clinicalInputClass}
                  disabled={!editable}
                  id="recall-day-type"
                  onChange={(event) =>
                    updateRecall((current) => ({
                      ...current,
                      dayType: event.target.value as typeof current.dayType,
                      representativeConfirmed:
                        event.target.value === "HABITUAL"
                          ? current.representativeConfirmed
                          : false,
                    }))
                  }
                  value={recall.dayType}
                >
                  <option value="NOT_INFORMED">Não informado</option>
                  <option value="HABITUAL">Habitual</option>
                  <option value="ATYPICAL">Atípico</option>
                </select>
              </ClinicalField>
              <ClinicalField id="recall-date" label="Data de referência">
                <input
                  className={clinicalInputClass}
                  disabled={!editable}
                  id="recall-date"
                  onChange={(event) =>
                    updateRecall((current) => ({
                      ...current,
                      referenceDate: event.target.value,
                    }))
                  }
                  type="date"
                  value={recall.referenceDate}
                />
              </ClinicalField>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
              <input
                checked={Boolean(recall.representativeConfirmed)}
                className="mt-1 size-4"
                disabled={!editable || recall.dayType !== "HABITUAL"}
                onChange={(event) =>
                  updateRecall((current) => ({
                    ...current,
                    representativeConfirmed: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                <strong className="block">Confirmo que este recordatório representa a alimentação habitual.</strong>
                Somente recordatórios habituais explicitamente confirmados serão usados como base pelo Plano Inteligente.
              </span>
            </label>

            {recall.meals.length ? (
              recall.meals.map((meal, mealIndex) => (
                <article
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  key={meal.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Refeição {mealIndex + 1}
                    </h3>
                    {editable &&
                    !recallMealItems(meal).some(
                      (item) =>
                        item.source === "RECIPE" ||
                        Boolean(item.previousPlanComparison?.sourceFoodId),
                    ) ? (
                      <Button
                        onClick={() =>
                          updateRecall((current) => ({
                            ...current,
                            meals: current.meals.filter(
                              (candidate) => candidate.id !== meal.id,
                            ),
                          }))
                        }
                        size="small"
                        type="button"
                        variant="destructive"
                      >
                        Excluir refeição
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <ClinicalField id={`meal-time-${meal.id}`} label="Horário">
                      <input
                        className={`${clinicalInputClass} bg-white`}
                        disabled={!editable}
                        id={`meal-time-${meal.id}`}
                        onChange={(event) =>
                          updateMeal(meal.id, (current) => ({
                            ...current,
                            time: event.target.value,
                          }))
                        }
                        type="time"
                        value={meal.time}
                      />
                    </ClinicalField>
                    <ClinicalField
                      id={`meal-name-${meal.id}`}
                      label="Nome da refeição"
                    >
                      <input
                        className={`${clinicalInputClass} bg-white`}
                        disabled={!editable}
                        id={`meal-name-${meal.id}`}
                        onChange={(event) =>
                          updateMeal(meal.id, (current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Ex.: Café da manhã, almoço ou jantar"
                        value={meal.name}
                      />
                    </ClinicalField>
                  </div>
                  <ClinicalField
                    id={`meal-notes-${meal.id}`}
                    label="Observação da refeição"
                  >
                    <input
                      className={`${clinicalInputClass} bg-white`}
                      disabled={!editable}
                      id={`meal-notes-${meal.id}`}
                      onChange={(event) =>
                        updateMeal(meal.id, (current) => ({
                          ...current,
                          observations: event.target.value,
                        }))
                      }
                      value={meal.observations}
                    />
                  </ClinicalField>

                  <div className="mt-3 space-y-2">
                    {recallMealItems(meal).map((item, foodIndex) => {
                      if (item.source === "RECIPE") {
                        const recipe = item;
                        const recipeStatus =
                          recipe.previousPlanComparison.status;
                        return (
                          <section
                            className="rounded-xl border border-violet-200 bg-white p-3"
                            key={recipe.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">
                                  Receita {foodIndex + 1}
                                </p>
                                <h4 className="text-sm font-black text-slate-950">
                                  {recipe.recipeTitle}
                                </h4>
                                <p className="text-xs text-slate-600">
                                  Prescrição anterior: {recipe.prescribedPortion.prescribedServings}{" "}
                                  porção(ões) · {recipe.prescribedPortion.description}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  Snapshot nutricional v{recipe.recipeNutritionSnapshotVersion}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                  recipe.nutritionCompleteness === "COMPLETE"
                                    ? "bg-emerald-100 text-emerald-900"
                                    : "bg-amber-100 text-amber-900"
                                }`}
                              >
                                {recipe.nutritionCompleteness === "COMPLETE"
                                  ? "Nutrição disponível"
                                  : "Nutrição parcial"}
                              </span>
                            </div>

                            <label
                              className="mt-3 block text-xs font-bold text-slate-700"
                              htmlFor={`previous-plan-recipe-status-${recipe.id}`}
                            >
                              Confirmação do consumo
                            </label>
                            <select
                              className={`${clinicalInputClass} mt-1 bg-white`}
                              disabled={!editable}
                              id={`previous-plan-recipe-status-${recipe.id}`}
                              onChange={(event) => {
                                const status = previousPlanConsumptionStatus(
                                  event.target.value,
                                );
                                updateRecipe(meal.id, recipe.id, (current) => ({
                                  ...current,
                                  consumedServings:
                                    status === "AS_PRESCRIBED"
                                      ? current.prescribedPortion.prescribedServings
                                      : status === "NOT_CONSUMED"
                                        ? 0
                                        : status === "DIFFERENT_QUANTITY"
                                          ? current.consumedServings
                                          : null,
                                  previousPlanComparison: {
                                    ...current.previousPlanComparison,
                                    status,
                                  },
                                }));
                              }}
                              value={recipeStatus}
                            >
                              <option value="">Confirmar…</option>
                              <option value="AS_PRESCRIBED">Consumiu conforme prescrito</option>
                              <option value="DIFFERENT_QUANTITY">Consumiu quantidade diferente</option>
                              <option value="SUBSTITUTED">Substituiu</option>
                              <option value="NOT_CONSUMED">Não consumiu</option>
                            </select>

                            {recipeStatus === "DIFFERENT_QUANTITY" ? (
                              <ClinicalField
                                id={`recipe-consumed-servings-${recipe.id}`}
                                label="Porções efetivamente consumidas"
                              >
                                <input
                                  className={clinicalInputClass}
                                  disabled={!editable}
                                  id={`recipe-consumed-servings-${recipe.id}`}
                                  min="0"
                                  onChange={(event) =>
                                    updateRecipe(
                                      meal.id,
                                      recipe.id,
                                      (current) => ({
                                        ...current,
                                        consumedServings: nonNegativeNumber(
                                          event.target.value,
                                        ),
                                      }),
                                    )
                                  }
                                  step="0.1"
                                  type="number"
                                  value={recipe.consumedServings ?? ""}
                                />
                              </ClinicalField>
                            ) : null}

                            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                              {(
                                [
                                  ["energyKcal", "Energia", "kcal"],
                                  ["carbohydratesGrams", "Carboidratos", "g"],
                                  ["proteinGrams", "Proteínas", "g"],
                                  ["fatsGrams", "Gorduras", "g"],
                                  ["fiberGrams", "Fibras", "g"],
                                  ["sodiumMg", "Sódio", "mg"],
                                ] as const
                              ).map(([key, label, unit]) => (
                                <div className="rounded-lg bg-slate-50 p-2" key={key}>
                                  <dt className="text-[10px] font-bold text-slate-500">
                                    {label}
                                  </dt>
                                  <dd className="text-xs font-black text-slate-900">
                                    {nutritionNumber(
                                      recipe.prescribedNutrients[key],
                                      unit,
                                    )}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                            {recipe.missingNutrients.length ? (
                              <p className="mt-2 text-xs font-bold text-amber-800">
                                Nutrientes indisponíveis no snapshot: {recipe.missingNutrients.join(", ")}.
                              </p>
                            ) : null}
                          </section>
                        );
                      }
                      const food = item;
                      const search = searchState(food);
                      const confirmedMeasures =
                        measureOptionsByFood[food.id] ?? [];
                      const measuresLoaded =
                        food.source === "LOCAL_DATABASE" &&
                        measureOptionsByFood[food.id] !== undefined;
                      const baseMeasures =
                        food.source === "LOCAL_DATABASE"
                          ? recallMeasureOptions(food, confirmedMeasures)
                          : [];
                      const currentMeasureMissing =
                        food.source === "LOCAL_DATABASE" &&
                        food.householdMeasureId &&
                        !baseMeasures.some(
                          (option) => option.id === food.householdMeasureId,
                        );
                      const measures =
                        food.source === "LOCAL_DATABASE" &&
                        currentMeasureMissing &&
                        food.measureAmountPerUnit &&
                        food.measureUnit
                          ? [
                              ...baseMeasures,
                              {
                                id: food.householdMeasureId!,
                                label: food.unit,
                                measureName: food.unit,
                                amountPerMeasure: food.measureAmountPerUnit,
                                unit: food.measureUnit,
                                source: food.measureSource ?? "Base alimentar",
                                technical: false,
                              } satisfies ReturnRecallMeasureOption,
                            ]
                          : baseMeasures;
                      const calculatedFood = calculateReturnRecallFood(food);
                      const consumedAmount =
                        food.source === "LOCAL_DATABASE" &&
                        food.quantity !== undefined
                          ? food.quantity *
                            (food.measureAmountPerUnit ??
                              food.gramsPerUnit ??
                              0)
                          : undefined;
                      const preparationDefined =
                        food.source === "LOCAL_DATABASE"
                          ? food.officialPreparation ||
                            (officialNameAlreadyDefinesPreparation(food.name)
                              ? "Definido no nome oficial"
                              : undefined)
                          : undefined;
                      const badgeClass =
                        "rounded-full px-2 py-0.5 text-[10px] font-black " +
                        (food.source === "UNSELECTED"
                          ? "bg-slate-100 text-slate-700"
                          : food.source === "MANUAL"
                            ? "bg-amber-100 text-amber-900"
                            : food.compositionStatus === "AVAILABLE"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-rose-100 text-rose-900");
                      const badgeLabel =
                        food.source === "UNSELECTED"
                          ? "Seleção obrigatória"
                          : food.source === "MANUAL"
                            ? "Dado informado manualmente"
                            : food.compositionStatus === "AVAILABLE"
                              ? "Composição calculável"
                              : "Composição não encontrada";

                      return (
                        <section
                          className="rounded-xl border border-slate-200 bg-white p-2.5"
                          key={food.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-black text-slate-600">
                                Alimento {foodIndex + 1}
                              </p>
                              <span className={badgeClass}>{badgeLabel}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {editable && food.source !== "UNSELECTED" ? (
                                <Button
                                  onClick={() =>
                                    changeSelectedFood(meal.id, food)
                                  }
                                  size="small"
                                  type="button"
                                  variant="outline"
                                >
                                  {food.source === "MANUAL"
                                    ? "Voltar à busca"
                                    : "Trocar alimento"}
                                </Button>
                              ) : null}
                              {editable &&
                              !food.previousPlanComparison?.sourceFoodId ? (
                                <Button
                                  onClick={() =>
                                    removeRecallItem(meal.id, food.id)
                                  }
                                  size="small"
                                  type="button"
                                  variant="ghost"
                                >
                                  Remover
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          {food.previousPlanComparison ? (
                            <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 p-2">
                              <p className="text-xs font-bold text-sky-950">
                                {food.previousPlanComparison.status === "ADDED"
                                  ? "Alimento acrescentado ao consumo relatado"
                                  : `Prescrito anteriormente: ${food.previousPlanComparison.prescribedFoodName ?? "alimento"} · ${food.previousPlanComparison.prescribedQuantity ?? "—"} ${food.previousPlanComparison.prescribedMeasure ?? ""}`}
                              </p>
                              <label className="mt-2 block text-xs font-bold text-slate-700" htmlFor={`previous-plan-status-${food.id}`}>
                                Confirmação do consumo
                              </label>
                              <select
                                className={`${clinicalInputClass} mt-1 bg-white`}
                                disabled={!editable || food.previousPlanComparison.status === "ADDED"}
                                id={`previous-plan-status-${food.id}`}
                                onChange={(event) =>
                                  updateFood(meal.id, food.id, (current) => ({
                                    ...current,
                                    previousPlanComparison: current.previousPlanComparison
                                      ? {
                                          ...current.previousPlanComparison,
                                          status: previousPlanConsumptionStatus(
                                            event.target.value,
                                          ),
                                        }
                                      : undefined,
                                  }))
                                }
                                value={food.previousPlanComparison.status}
                              >
                                {food.previousPlanComparison.status === "ADDED" ? (
                                  <option value="ADDED">Acrescentou outro alimento</option>
                                ) : (
                                  <>
                                    <option value="">Confirmar…</option>
                                    <option value="AS_PRESCRIBED">Consumiu conforme prescrito</option>
                                    <option value="DIFFERENT_QUANTITY">Consumiu quantidade diferente</option>
                                    <option value="SUBSTITUTED">Substituiu</option>
                                    <option value="NOT_CONSUMED">Não consumiu</option>
                                  </>
                                )}
                              </select>
                            </div>
                          ) : null}

                          {food.source === "UNSELECTED" ? (
                            <div className="mt-2">
                              <label
                                className="text-xs font-bold text-slate-700"
                                htmlFor={"food-search-" + food.id}
                              >
                                Buscar alimento na base alimentar
                              </label>
                              <div className="mt-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                                <div className="relative">
                                  <input
                                    aria-autocomplete="list"
                                    className={clinicalInputClass}
                                    disabled={!editable}
                                    id={"food-search-" + food.id}
                                    onChange={(event) =>
                                      scheduleFoodSearch(
                                        food.id,
                                        event.target.value,
                                        search.sourceName,
                                      )
                                    }
                                    placeholder="Digite o nome do alimento, por exemplo: pão francês"
                                    value={search.query}
                                  />
                                  {search.loading ? (
                                    <span
                                      className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-500"
                                      role="status"
                                    >
                                      Buscando…
                                    </span>
                                  ) : null}
                                </div>
                                <select
                                  aria-label="Filtrar pela fonte alimentar"
                                  className={clinicalInputClass}
                                  disabled={!editable}
                                  onChange={(event) =>
                                    scheduleFoodSearch(
                                      food.id,
                                      search.query,
                                      event.target.value,
                                    )
                                  }
                                  value={search.sourceName}
                                >
                                  <option value="ALL">Todas</option>
                                  {foodSourceOptions.map((source) => (
                                    <option key={source.value} value={source.value}>
                                      {source.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {search.error ? (
                                <p
                                  className="mt-1 text-xs font-bold text-rose-700"
                                  role="alert"
                                >
                                  {search.error}
                                </p>
                              ) : null}
                              {search.items.length ? (
                                <div
                                  aria-label="Resultados da base alimentar"
                                  className="mt-2 grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                                  role="listbox"
                                >
                                  {search.items.map((candidate) => {
                                    const calculable =
                                      catalogFoodIsCalculable(candidate);
                                    return (
                                      <button
                                        aria-label={
                                          "Selecionar " + candidate.officialName
                                        }
                                        aria-selected={false}
                                        className="rounded-lg border border-transparent px-2 py-2 text-left hover:border-slate-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700"
                                        key={candidate.id}
                                        onClick={() =>
                                          selectLocalFood(
                                            meal.id,
                                            food,
                                            candidate,
                                          )
                                        }
                                        role="option"
                                        type="button"
                                      >
                                        <span className="block text-xs font-black text-slate-800">
                                          {candidate.officialName}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] text-slate-600">
                                          Fonte: {candidate.source.name}
                                          {candidate.sourceCode
                                            ? " · Código " + candidate.sourceCode
                                            : ""}
                                          {candidate.preparationState
                                            ? " · " + candidate.preparationState
                                            : ""}
                                        </span>
                                        <span
                                          className={
                                            "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold " +
                                            (calculable
                                              ? "bg-emerald-100 text-emerald-900"
                                              : "bg-amber-100 text-amber-900")
                                          }
                                        >
                                          {calculable
                                            ? "Possui composição calculável"
                                            : "Sem composição calculável"}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : search.query.trim().length >= 2 &&
                                !search.loading &&
                                !search.error ? (
                                <p className="mt-2 text-xs text-slate-500">
                                  Nenhum resultado para esta busca e fonte.
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                                <p className="text-[11px] text-slate-500">
                                  Use o registro manual somente se o alimento não
                                  existir na base.
                                </p>
                                <Button
                                  disabled={!editable}
                                  onClick={() => makeFoodManual(meal.id, food)}
                                  size="small"
                                  type="button"
                                  variant="ghost"
                                >
                                  Registro manual
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {food.source === "LOCAL_DATABASE" ? (
                            <div className="mt-2 space-y-2">
                              <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2">
                                <p className="text-sm font-black text-slate-900">
                                  {food.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-600">
                                  Fonte: {food.catalogSource}
                                  {food.catalogSourceCode
                                    ? " · Código " + food.catalogSourceCode
                                    : ""}
                                </p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <ClinicalField
                                  id={"food-quantity-" + food.id}
                                  label="Quantidade"
                                >
                                  <input
                                    className={clinicalInputClass}
                                    disabled={!editable}
                                    id={"food-quantity-" + food.id}
                                    min="0.01"
                                    onChange={(event) =>
                                      updateFood(
                                        meal.id,
                                        food.id,
                                        (current) => ({
                                          ...current,
                                          quantity: positiveNumber(
                                            event.target.value,
                                          ),
                                        }),
                                      )
                                    }
                                    step="0.01"
                                    type="number"
                                    value={food.quantity ?? ""}
                                  />
                                </ClinicalField>
                                <ClinicalField
                                  id={"food-measure-" + food.id}
                                  label="Medida caseira"
                                >
                                  <select
                                    className={clinicalInputClass}
                                    disabled={!editable}
                                    id={"food-measure-" + food.id}
                                    onChange={(event) => {
                                      const option = measures.find(
                                        (candidate) =>
                                          candidate.id === event.target.value,
                                      );
                                      if (!option) return;
                                      updateFood(
                                        meal.id,
                                        food.id,
                                        (current) =>
                                          current.source === "LOCAL_DATABASE"
                                            ? selectRecallMeasure(
                                                current,
                                                option,
                                              )
                                            : current,
                                      );
                                    }}
                                    value={
                                      food.householdMeasureId ?? "TECHNICAL"
                                    }
                                  >
                                    {measures.map((measure) => (
                                      <option
                                        key={measure.id}
                                        value={measure.id}
                                      >
                                        {measure.label}
                                      </option>
                                    ))}
                                  </select>
                                </ClinicalField>
                              </div>
                              <div className="grid gap-2 rounded-lg bg-slate-50 p-2 text-xs sm:grid-cols-2">
                                <p>
                                  <span className="font-bold text-slate-600">
                                    Peso correspondente:
                                  </span>{" "}
                                  <strong className="text-slate-900">
                                    {consumedAmount && food.measureUnit
                                      ? nutritionNumber(
                                          consumedAmount,
                                          food.measureUnit,
                                        )
                                      : "Informe a quantidade"}
                                  </strong>
                                </p>
                                <p>
                                  <span className="font-bold text-slate-600">
                                    Fonte da medida:
                                  </span>{" "}
                                  {food.measureSource ?? "Medida técnica"}
                                </p>
                              </div>
                              {measuresLoaded &&
                              confirmedMeasures.length === 0 ? (
                                <p className="text-xs font-bold text-amber-800">
                                  Não há medida caseira confirmada para este
                                  alimento. Informe diretamente em{" "}
                                  {food.nutritionReferenceUnit === "ml"
                                    ? "mililitros"
                                    : "gramas"}.
                                </p>
                              ) : !measuresLoaded ? (
                                <p className="text-xs text-slate-500">
                                  Carregando medidas confirmadas…
                                </p>
                              ) : null}
                              {preparationDefined ? (
                                <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                                  <strong>Preparo definido no cadastro:</strong>{" "}
                                  {preparationDefined}. Não é necessário informar
                                  novamente.
                                </p>
                              ) : (
                                <ClinicalField
                                  id={"food-preparation-" + food.id}
                                  label="Preparo, quando necessário"
                                >
                                  <select
                                    className={clinicalInputClass}
                                    disabled={!editable}
                                    id={"food-preparation-" + food.id}
                                    onChange={(event) =>
                                      updateFood(
                                        meal.id,
                                        food.id,
                                        (current) => ({
                                          ...current,
                                          preparationOption: event.target
                                            .value as LocalDatabaseRecallFood["preparationOption"],
                                        }),
                                      )
                                    }
                                    value={food.preparationOption ?? ""}
                                  >
                                    <option value="">Selecione</option>
                                    {RETURN_RECALL_PREPARATION_OPTIONS.map(
                                      ([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </ClinicalField>
                              )}
                              {food.preparationOption &&
                              food.preparationOption !== "NOT_APPLICABLE" ? (
                                <p className="text-[11px] text-slate-500">
                                  O preparo informado não altera a composição.
                                  Se houver outro cadastro correspondente,
                                  selecione esse alimento na busca.
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {food.source === "MANUAL" ? (
                            <div className="mt-2 space-y-2">
                              <p className="rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-900">
                                Dado informado manualmente
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <ClinicalField
                                  id={"food-name-" + food.id}
                                  label="Nome"
                                >
                                  <input
                                    className={clinicalInputClass}
                                    disabled={!editable}
                                    id={"food-name-" + food.id}
                                    onChange={(event) =>
                                      updateFood(
                                        meal.id,
                                        food.id,
                                        (current) =>
                                          current.source === "MANUAL"
                                            ? {
                                                ...current,
                                                name: event.target.value,
                                              }
                                            : current,
                                      )
                                    }
                                    value={food.name}
                                  />
                                </ClinicalField>
                                <ClinicalField
                                  id={"food-quantity-" + food.id}
                                  label="Quantidade consumida"
                                >
                                  <input
                                    className={clinicalInputClass}
                                    disabled={!editable}
                                    id={"food-quantity-" + food.id}
                                    min="0.01"
                                    onChange={(event) =>
                                      updateFood(
                                        meal.id,
                                        food.id,
                                        (current) => ({
                                          ...current,
                                          quantity: positiveNumber(
                                            event.target.value,
                                          ),
                                        }),
                                      )
                                    }
                                    step="0.01"
                                    type="number"
                                    value={food.quantity ?? ""}
                                  />
                                </ClinicalField>
                                <ClinicalField
                                  id={"food-unit-" + food.id}
                                  label="Unidade"
                                >
                                  <input
                                    className={clinicalInputClass}
                                    disabled={!editable}
                                    id={"food-unit-" + food.id}
                                    onChange={(event) =>
                                      updateFood(
                                        meal.id,
                                        food.id,
                                        (current) => ({
                                          ...current,
                                          unit: event.target.value,
                                        }),
                                      )
                                    }
                                    placeholder="Ex.: porção, unidade"
                                    value={food.unit}
                                  />
                                </ClinicalField>
                                <ClinicalField
                                  id={"food-weight-" + food.id}
                                  label="Peso consumido"
                                >
                                  <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-1">
                                    <input
                                      className={clinicalInputClass}
                                      disabled={!editable}
                                      id={"food-weight-" + food.id}
                                      min="0.01"
                                      onChange={(event) =>
                                        updateFood(
                                          meal.id,
                                          food.id,
                                          (current) =>
                                            current.source === "MANUAL"
                                              ? {
                                                  ...current,
                                                  consumedWeight:
                                                    positiveNumber(
                                                      event.target.value,
                                                    ),
                                                }
                                              : current,
                                        )
                                      }
                                      step="0.01"
                                      type="number"
                                      value={food.consumedWeight ?? ""}
                                    />
                                    <select
                                      aria-label="Unidade do peso consumido"
                                      className={clinicalInputClass}
                                      disabled={!editable}
                                      onChange={(event) =>
                                        updateFood(
                                          meal.id,
                                          food.id,
                                          (current) =>
                                            current.source === "MANUAL"
                                              ? {
                                                  ...current,
                                                  consumedWeightUnit: event
                                                    .target.value as "g" | "ml",
                                                }
                                              : current,
                                        )
                                      }
                                      value={food.consumedWeightUnit ?? "g"}
                                    >
                                      <option value="g">g</option>
                                      <option value="ml">ml</option>
                                    </select>
                                  </div>
                                </ClinicalField>
                              </div>
                              <ClinicalField
                                id={"manual-basis-" + food.id}
                                label="Composição nutricional"
                              >
                                <select
                                  className={clinicalInputClass}
                                  disabled={!editable}
                                  id={"manual-basis-" + food.id}
                                  onChange={(event) => {
                                    const basis = event.target
                                      .value as ManualRecallFood["nutritionBasis"];
                                    updateFood(
                                      meal.id,
                                      food.id,
                                      (current) =>
                                        current.source === "MANUAL"
                                          ? {
                                              ...current,
                                              nutritionBasis: basis,
                                              compositionStatus:
                                                basis === "NONE"
                                                  ? "MANUAL"
                                                  : "MANUAL_WITH_COMPOSITION",
                                              nutrients:
                                                current.nutrients ??
                                                emptyManualNutrients(),
                                            }
                                          : current,
                                    );
                                  }}
                                  value={food.nutritionBasis ?? "NONE"}
                                >
                                  <option value="NONE">
                                    Não informar composição
                                  </option>
                                  <option value="PER_100">
                                    Informar por 100 g/ml
                                  </option>
                                  <option value="PER_PORTION">
                                    Informar para a porção consumida
                                  </option>
                                </select>
                              </ClinicalField>
                              {food.nutritionBasis &&
                              food.nutritionBasis !== "NONE" ? (
                                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                                  {(
                                    [
                                      ["energyKcal", "Energia", "kcal"],
                                      ["carbohydratesGrams", "Carboidratos", "g"],
                                      ["proteinGrams", "Proteínas", "g"],
                                      ["fatsGrams", "Gorduras", "g"],
                                      ["fiberGrams", "Fibras", "g"],
                                      ["sodiumMg", "Sódio", "mg"],
                                    ] as const
                                  ).map(([key, label, unit]) => (
                                    <ClinicalField
                                      id={"manual-" + key + "-" + food.id}
                                      key={key}
                                      label={label + " (" + unit + ")"}
                                    >
                                      <input
                                        className={clinicalInputClass}
                                        disabled={!editable}
                                        id={"manual-" + key + "-" + food.id}
                                        min="0"
                                        onChange={(event) =>
                                          updateFood(
                                            meal.id,
                                            food.id,
                                            (current) =>
                                              current.source === "MANUAL"
                                                ? {
                                                    ...current,
                                                    compositionStatus:
                                                      "MANUAL_WITH_COMPOSITION",
                                                    nutrients: {
                                                      ...(current.nutrients ??
                                                        emptyManualNutrients()),
                                                      [key]: nonNegativeNumber(
                                                        event.target.value,
                                                      ),
                                                    },
                                                  }
                                                : current,
                                          )
                                        }
                                        step="0.01"
                                        type="number"
                                        value={food.nutrients?.[key] ?? ""}
                                      />
                                    </ClinicalField>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs font-bold text-amber-800">
                                  Não calculado — composição não informada.
                                </p>
                              )}
                            </div>
                          ) : null}

                          {food.source !== "UNSELECTED" ? (
                            <div className="mt-2">
                              <ClinicalField
                                id={"food-notes-" + food.id}
                                label="Observações"
                              >
                                <input
                                  className={clinicalInputClass}
                                  disabled={!editable}
                                  id={"food-notes-" + food.id}
                                  onChange={(event) =>
                                    updateFood(
                                      meal.id,
                                      food.id,
                                      (current) => ({
                                        ...current,
                                        observations: event.target.value,
                                      }),
                                    )
                                  }
                                  value={food.observations}
                                />
                              </ClinicalField>
                            </div>
                          ) : null}

                          {calculatedFood ? (
                            <dl className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2 sm:grid-cols-4 xl:grid-cols-7">
                              <div>
                                <dt className="text-[10px] font-bold text-slate-500">
                                  Peso
                                </dt>
                                <dd className="text-xs font-black">
                                  {nutritionNumber(
                                    calculatedFood.consumedAmount,
                                    calculatedFood.consumedUnit,
                                  )}
                                </dd>
                              </div>
                              {(
                                [
                                  ["energyKcal", "Energia", "kcal"],
                                  ["carbohydratesGrams", "Carboidratos", "g"],
                                  ["proteinGrams", "Proteínas", "g"],
                                  ["fatsGrams", "Gorduras", "g"],
                                  ["fiberGrams", "Fibras", "g"],
                                  ["sodiumMg", "Sódio", "mg"],
                                ] as const
                              ).map(([key, label, unit]) => (
                                <div key={key}>
                                  <dt className="text-[10px] font-bold text-slate-500">
                                    {label}
                                  </dt>
                                  <dd className="text-xs font-black">
                                    {nutritionNumber(
                                      calculatedFood.nutrients[key],
                                      unit,
                                    )}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : food.source === "LOCAL_DATABASE" &&
                            food.compositionStatus === "UNAVAILABLE" ? (
                            <p className="mt-2 text-xs font-bold text-amber-800">
                              Não calculado — composição indisponível na base.
                            </p>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>

                  {calculation?.meals.find(
                    (candidate) => candidate.mealId === meal.id,
                  )?.totals ? (
                    <section className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                      <p className="text-xs font-black text-slate-700">
                        Subtotal da refeição
                      </p>
                      <dl className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {(
                          [
                            ["energyKcal", "Energia", "kcal"],
                            ["carbohydratesGrams", "Carboidratos", "g"],
                            ["proteinGrams", "Proteínas", "g"],
                            ["fatsGrams", "Gorduras", "g"],
                            ["fiberGrams", "Fibras", "g"],
                            ["sodiumMg", "Sódio", "mg"],
                          ] as const
                        ).map(([key, label, unit]) => (
                          <div key={key}>
                            <dt className="text-[10px] font-bold text-slate-500">
                              {label}
                            </dt>
                            <dd className="text-xs font-black text-slate-900">
                              {nutritionNumber(
                                calculation.meals.find(
                                  (candidate) => candidate.mealId === meal.id,
                                )?.totals?.[key],
                                unit,
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}

                  {editable ? (
                    <Button
                      className="mt-2"
                      onClick={() =>
                        appendRecallFood(
                          meal.id,
                          emptyUnselectedFood(
                            view.previousReference.mealPlan.entryId,
                          ),
                        )
                      }
                      size="small"
                      type="button"
                      variant="secondary"
                    >
                      Adicionar alimento
                    </Button>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                Nenhuma refeição adicionada.
              </p>
            )}

            {editable ? (
              <Button
                onClick={() =>
                  updateRecall((current) => ({
                    ...current,
                    meals: [...current.meals, emptyMeal()],
                  }))
                }
                size="small"
                type="button"
                variant="secondary"
              >
                Adicionar refeição
              </Button>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["water", "Água"],
                  ["beverages", "Outras bebidas"],
                  ["alcohol", "Álcool"],
                  ["supplements", "Suplementos"],
                ] as const
              ).map(([key, label]) => (
                <ClinicalField id={`recall-${key}`} key={key} label={label}>
                  <input
                    className={clinicalInputClass}
                    disabled={!editable}
                    id={`recall-${key}`}
                    onChange={(event) =>
                      updateRecall((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    value={recall[key]}
                  />
                </ClinicalField>
              ))}
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900">
                  Cálculo local do consumo
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Sem IA · sem internet
                </span>
              </div>
              {calculation?.totals ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {(
                    [
                      ["energyKcal", "Energia", "kcal"],
                      ["proteinGrams", "Proteínas", "g"],
                      ["carbohydratesGrams", "Carboidratos", "g"],
                      ["fatsGrams", "Gorduras", "g"],
                      ["fiberGrams", "Fibras", "g"],
                      ["sodiumMg", "Sódio", "mg"],
                    ] as const
                  ).map(([key, label, unit]) => (
                    <div className="rounded-lg bg-white p-2" key={key}>
                      <dt className="text-xs font-bold text-slate-500">{label}</dt>
                      <dd className="font-black text-slate-900">
                        {nutritionNumber(calculation.totals?.[key], unit)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Nenhum item com composição e quantidade consumida calculável.
                </p>
              )}
              {calculation?.partial ? (
                <p className="mt-2 text-xs font-black text-amber-800">
                  Totais parciais: os valores exibidos incluem somente nutrientes conhecidos dos consumos confirmados.
                </p>
              ) : null}
              {calculation ? (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>
                    <strong>{calculation.calculatedFoods.length}</strong>{" "}
                    item(ns) calculado(s)
                  </span>
                  <span>
                    <strong>
                      {calculation.foodsWithoutComposition.length}
                    </strong>{" "}
                    sem composição
                  </span>
                  <span>
                    <strong>Fontes:</strong>{" "}
                    {calculation.sourcesUsed.length
                      ? calculation.sourcesUsed.join(", ")
                      : "nenhuma"}
                  </span>
                </div>
              ) : null}
              {calculation?.foodsWithoutComposition.length ? (
                <p className="mt-2 text-xs font-bold text-amber-800">
                  Sem composição: {calculation.foodsWithoutComposition.join(", ")}.
                  Nenhum valor foi inventado para esses itens.
                </p>
              ) : null}
              {calculation?.foodsWithoutQuantifiableMeasure.length ? (
                <p className="mt-1 text-xs font-bold text-amber-800">
                  Sem quantidade ou medida calculável:{" "}
                  {calculation.foodsWithoutQuantifiableMeasure.join(", ")}.
                </p>
              ) : null}
              {calculation?.missingNutrients.length ? (
                <div className="mt-1 text-xs font-bold text-amber-800">
                  {calculation.missingNutrients.map((item) => (
                    <p key={item.itemId}>
                      {item.itemName}: indisponíveis {item.nutrients.join(", ")}.
                    </p>
                  ))}
                </div>
              ) : null}
              {calculation?.unconfirmedPreviousPlanItems ? (
                <p className="mt-1 text-xs font-bold text-amber-800">
                  {calculation.unconfirmedPreviousPlanItems} item(ns) da prescrição anterior aguardam confirmação de consumo e não entram nos totais.
                </p>
              ) : null}
              {calculation?.unselectedFoods ? (
                <p className="mt-1 text-xs font-bold text-amber-800">
                  {calculation.unselectedFoods} linha(s) não selecionada(s) não
                  entram no cálculo nem serão persistidas.
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </OptionalCard>

      <OptionalCard
        activationLabel="Fazer análise detalhada"
        active={Boolean(detailed)}
        description="Use somente quando for necessário investigar quais refeições foram seguidas, omitidas ou substituídas."
        disabled={!editable}
        onActivate={() => {
          change((current) => ({
            ...current,
            detailedAdherence:
              current.detailedAdherence ?? emptyDetailedReturnAdherence(),
          }));
          setShowDetailedAdherence(true);
        }}
        onOpenChange={setShowDetailedAdherence}
        onRemove={removeDetailedAdherence}
        open={showDetailedAdherence}
        removeLabel="Remover análise deste retorno"
        title="Análise detalhada da adesão"
      >
        {detailed ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["followedMeals", "Refeições mais seguidas"],
                ["omittedMeals", "Refeições omitidas"],
                ["substitutions", "Substituições realizadas"],
                ["hungerSatietyTolerance", "Fome, saciedade e tolerância"],
                ["professionalObservation", "Observação complementar"],
              ] as const
            ).map(([key, label]) => (
              <ClinicalField id={`detailed-${key}`} key={key} label={label}>
                <textarea
                  className={compactAreaClass}
                  disabled={!editable}
                  id={`detailed-${key}`}
                  onChange={(event) =>
                    updateDetailed((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  value={detailed[key]}
                />
              </ClinicalField>
            ))}
          </div>
        ) : null}
      </OptionalCard>

      {notice ? (
        <p
          className={`rounded-xl border px-3 py-2 text-sm font-bold ${
            notice.tone === "SUCCESS"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
          role={notice.tone === "ERROR" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:px-4">
        <div>
          <p className="text-xs font-bold text-slate-600">
            {dirty ? "Alterações não salvas" : "Sem alterações pendentes"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Salvar rascunho não conclui a etapa. Os blocos opcionais não impedem a conclusão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!editable || !dirty || saving !== null}
            loading={saving === "DRAFT"}
            onClick={() => void save("DRAFT")}
            type="button"
            variant="secondary"
          >
            Salvar rascunho
          </Button>
          <Button
            disabled={!editable || saving !== null}
            loading={saving === "COMPLETE"}
            onClick={() => void save("COMPLETE")}
            type="button"
          >
            Concluir anamnese do retorno
          </Button>
        </div>
      </section>
    </div>
  );
}
