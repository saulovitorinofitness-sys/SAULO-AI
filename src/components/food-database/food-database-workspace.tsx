"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  NumberInput,
  PageState,
  Select,
  StatusBadge,
} from "@/components/ui";
import type {
  FoodDuplicateCandidate,
  FoodSearchResult,
  NutritionSourceKind,
  ProfessionalFood,
} from "@/features/food-database/contracts";
import { FOOD_CATEGORY_FILTER_OPTIONS } from "@/features/food-database/contracts";

const sourceOptions: readonly {
  value: NutritionSourceKind | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "Todas" },
  { value: "TACO", label: "TACO" },
  { value: "TBCA", label: "TBCA" },
  { value: "IBGE", label: "IBGE" },
  { value: "EVONUT", label: "Tucunduva" },
  { value: "PHILIPS", label: "PHILIPS" },
  { value: "USDA", label: "USDA" },
  { value: "CLINIC_SV", label: "Clínica SV" },
];

function scientificSourceLabel(
  source: Pick<ProfessionalFood["source"], "kind" | "name">,
) {
  if (source.kind !== "EVONUT") {
    return source.kind === "CLINIC_SV" ? source.name : source.kind;
  }

  return ["TACO", "TBCA", "IBGE", "Tucunduva"].includes(source.name)
    ? source.name
    : "Fonte não identificada";
}
const formatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

function nutrient(value: number | null | undefined, suffix: string) {
  return value === null || value === undefined
    ? "Não informado"
    : `${formatter.format(value)} ${suffix}`;
}

interface FoodFormState {
  officialName: string;
  category: string;
  foodGroup: string;
  preparationState: string;
  presentation: string;
  sourceCode: string;
  energyKcal: string;
  proteinGrams: string;
  carbohydratesGrams: string;
  fatsGrams: string;
  fiberGrams: string;
  measureName: string;
  measureGrams: string;
  synonyms: string;
}

const emptyForm: FoodFormState = {
  officialName: "",
  category: "",
  foodGroup: "",
  preparationState: "",
  presentation: "",
  sourceCode: "",
  energyKcal: "",
  proteinGrams: "",
  carbohydratesGrams: "",
  fatsGrams: "",
  fiberGrams: "",
  measureName: "",
  measureGrams: "",
  synonyms: "",
};

function nullableNutrients() {
  return {
    sugarsGrams: null,
    cholesterolMg: null,
    saturatedFatsGrams: null,
    monounsaturatedFatsGrams: null,
    polyunsaturatedFatsGrams: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMg: null,
    manganeseMg: null,
    seleniumMcg: null,
    vitaminAMcg: null,
    vitaminCMg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    thiamineMg: null,
    riboflavinMg: null,
    niacinMg: null,
    vitaminB6Mg: null,
    folateMcg: null,
    vitaminB12Mcg: null,
  };
}

export function FoodDatabaseWorkspace({
  scenario,
  canManage,
}: {
  scenario: string;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] =
    useState<NutritionSourceKind | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<FoodSearchResult>();
  const [selected, setSelected] = useState<ProfessionalFood>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [duplicates, setDuplicates] = useState<
    readonly FoodDuplicateCandidate[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      scenario,
      query,
      source,
      page: String(page),
      pageSize: "12",
    });
    if (category) params.set("category", category);

    try {
      const response = await fetch(`/api/foods?${params}`);
      if (!response.ok) throw new Error();
      const next = (await response.json()) as FoodSearchResult;
      setResult(next);
      setSelected((current) =>
        current && next.items.some((item) => item.id === current.id)
          ? current
          : next.items[0],
      );
      setMessage("");
    } catch {
      setMessage("Não foi possível carregar o banco de alimentos.");
    } finally {
      setLoading(false);
    }
  }, [category, page, query, scenario, source]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setField<Key extends keyof FoodFormState>(
    key: Key,
    value: FoodFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicates([]);
    setMessage("");
  }

  async function saveFood(confirmDuplicate = false) {
    const numeric = [
      form.energyKcal,
      form.proteinGrams,
      form.carbohydratesGrams,
      form.fatsGrams,
      form.fiberGrams,
      form.measureGrams,
    ].map(Number);
    if (
      !form.officialName.trim() ||
      !form.category.trim() ||
      !form.foodGroup.trim() ||
      !form.measureName.trim() ||
      numeric.some((value) => !Number.isFinite(value) || value < 0) ||
      Number(form.measureGrams) <= 0
    ) {
      setMessage("Preencha os campos obrigatórios com valores válidos.");
      return;
    }

    const response = await fetch(`/api/foods?scenario=${scenario}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        officialName: form.officialName,
        category: form.category,
        foodGroup: form.foodGroup,
        preparationState: form.preparationState || undefined,
        presentation: form.presentation || undefined,
        sourceCode: form.sourceCode || undefined,
        referenceServingGrams: 100,
        nutrients: {
          energyKcal: Number(form.energyKcal),
          proteinGrams: Number(form.proteinGrams),
          carbohydratesGrams: Number(form.carbohydratesGrams),
          fatsGrams: Number(form.fatsGrams),
          fiberGrams: Number(form.fiberGrams),
          ...nullableNutrients(),
        },
        householdMeasures: [
          {
            name: form.measureName,
            quantity: 1,
            grams: Number(form.measureGrams),
            isDefault: true,
            active: true,
          },
        ],
        synonyms: form.synonyms
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: "ACTIVE",
        confirmDuplicate,
      }),
    });
    const body = (await response.json()) as {
      message?: string;
      duplicates?: readonly FoodDuplicateCandidate[];
    };

    if (response.status === 409 && body.duplicates) {
      setDuplicates(body.duplicates);
      setMessage(body.message ?? "Possível duplicidade encontrada.");
      return;
    }
    if (!response.ok) {
      setMessage(body.message ?? "Não foi possível cadastrar o alimento.");
      return;
    }

    setForm(emptyForm);
    setDuplicates([]);
    setMessage("Alimento da Clínica SV cadastrado.");
    await load();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_12rem]">
          <FormField id="food-search" label="Pesquisar">
            <Input
              id="food-search"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Nome, sinônimo, fonte ou apresentação"
              type="search"
              value={query}
            />
          </FormField>
          <FormField id="food-category" label="Categoria">
            <Select
              id="food-category"
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              value={category}
            >
              <option value="">Todas</option>
              {FOOD_CATEGORY_FILTER_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="food-source" label="Fonte">
            <Select
              id="food-source"
              onChange={(event) => {
                setSource(
                  event.target.value as NutritionSourceKind | "ALL",
                );
                setPage(1);
              }}
              value={source}
            >
              {sourceOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Busca paginada no servidor, normalizada sem distinção de acentos ou
          maiúsculas.
        </p>
      </Card>

      {message ? (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {loading ? (
        <PageState
          description="Consultando alimentos e fontes nutricionais."
          title="Carregando banco de alimentos"
        />
      ) : result?.items.length ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-2">
            {result.items.map((food) => (
              <button
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.id === food.id
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-[var(--line)] bg-white hover:border-emerald-300"
                }`}
                key={food.id}
                onClick={() => setSelected(food)}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-[var(--text-primary)]">
                      {food.officialName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {food.category} · {food.source.name}
                    </p>
                  </div>
                  <Badge
                    tone={
                      food.source.origin === "DEMONSTRATIVE"
                        ? "warning"
                        : "success"
                    }
                  >
                    {food.source.origin === "DEMONSTRATIVE"
                      ? "Demonstrativo"
                      : scientificSourceLabel(food.source)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs font-bold text-[var(--text-secondary)]">
                  100 g · {nutrient(food.nutrients?.energyKcal, "kcal")} · P{" "}
                  {nutrient(food.nutrients?.proteinGrams, "g")} · C{" "}
                  {nutrient(food.nutrients?.carbohydratesGrams, "g")} · L{" "}
                  {nutrient(food.nutrients?.fatsGrams, "g")}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {food.description || "Sem descrição complementar"}
                  {food.householdMeasures[0]
                    ? ` · ${food.householdMeasures[0].name} = ${formatter.format(food.householdMeasures[0].grams)} g`
                    : ""}
                </p>
              </button>
            ))}
            <div className="flex items-center justify-between pt-2">
              <Button
                disabled={result.page <= 1}
                onClick={() => setPage((current) => current - 1)}
                size="small"
                variant="outline"
              >
                Anterior
              </Button>
              <span className="text-xs font-bold text-[var(--muted)]">
                Página {result.page} de {result.totalPages} · {result.total}{" "}
                alimentos
              </span>
              <Button
                disabled={result.page >= result.totalPages}
                onClick={() => setPage((current) => current + 1)}
                size="small"
                variant="outline"
              >
                Próxima
              </Button>
            </div>
          </div>

          {selected ? (
            <Card className="p-4 xl:sticky xl:top-24 xl:self-start">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{selected.officialName}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {selected.preparationState || "Estado não informado"} ·{" "}
                    {selected.presentation || "Apresentação não informada"}
                  </p>
                </div>
                <StatusBadge
                  label={selected.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  status={selected.status === "ACTIVE" ? "active" : "inactive"}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-[var(--muted)]">Energia</dt>
                  <dd className="font-black">
                    {nutrient(selected.nutrients?.energyKcal, "kcal")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Proteína</dt>
                  <dd className="font-black">
                    {nutrient(selected.nutrients?.proteinGrams, "g")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Carboidrato</dt>
                  <dd className="font-black">
                    {nutrient(selected.nutrients?.carbohydratesGrams, "g")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Lipídio</dt>
                  <dd className="font-black">
                    {nutrient(selected.nutrients?.fatsGrams, "g")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Fibra</dt>
                  <dd className="font-black">
                    {nutrient(selected.nutrients?.fiberGrams, "g")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Fonte</dt>
                  <dd className="font-black">{selected.source.name}</dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-[var(--line)] pt-3">
                <p className="text-xs font-black">Medidas caseiras</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {selected.householdMeasures.map((measure) => (
                    <li key={measure.id}>
                      {measure.quantity} {measure.name} ={" "}
                      {formatter.format(measure.grams)} g
                      {measure.isDefault ? " · padrão" : ""}
                    </li>
                  ))}
                </ul>
              </div>
              {selected.synonyms.length ? (
                <p className="mt-3 text-xs">
                  <strong>Sinônimos:</strong> {selected.synonyms.join(", ")}
                </p>
              ) : null}
              {!selected.source.editable ? (
                <p className="mt-3 rounded-lg bg-slate-100 p-2 text-xs font-bold text-slate-600">
                  Fonte protegida. Alterações diretas não são permitidas.
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : (
        <PageState
          description="Ajuste a pesquisa ou os filtros selecionados."
          title="Nenhum alimento encontrado"
        />
      )}

      {canManage ? (
        <details className="rounded-2xl border border-[var(--line)] bg-white">
          <summary className="cursor-pointer px-4 py-3 font-black">
            Cadastrar alimento da Clínica SV
          </summary>
          <div className="grid gap-3 border-t border-[var(--line)] p-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["officialName", "Nome oficial"],
              ["category", "Categoria"],
              ["foodGroup", "Grupo alimentar"],
              ["preparationState", "Estado"],
              ["presentation", "Apresentação"],
              ["sourceCode", "Código interno"],
              ["measureName", "Medida caseira padrão"],
              ["synonyms", "Sinônimos separados por vírgula"],
            ].map(([key, label]) => (
              <FormField id={`clinic-food-${key}`} key={key} label={label}>
                <Input
                  id={`clinic-food-${key}`}
                  onChange={(event) =>
                    setField(key as keyof FoodFormState, event.target.value)
                  }
                  value={form[key as keyof FoodFormState]}
                />
              </FormField>
            ))}
            {[
              ["energyKcal", "Energia por 100 g"],
              ["proteinGrams", "Proteína por 100 g"],
              ["carbohydratesGrams", "Carboidrato por 100 g"],
              ["fatsGrams", "Lipídio por 100 g"],
              ["fiberGrams", "Fibra por 100 g"],
              ["measureGrams", "Equivalente da medida em gramas"],
            ].map(([key, label]) => (
              <FormField id={`clinic-food-${key}`} key={key} label={label}>
                <NumberInput
                  id={`clinic-food-${key}`}
                  min={0}
                  onChange={(event) =>
                    setField(key as keyof FoodFormState, event.target.value)
                  }
                  value={form[key as keyof FoodFormState]}
                />
              </FormField>
            ))}
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button onClick={() => void saveFood(false)}>
                Cadastrar alimento
              </Button>
              {duplicates.length ? (
                <Button
                  onClick={() => void saveFood(true)}
                  variant="outline"
                >
                  Confirmar após revisão
                </Button>
              ) : null}
            </div>
            {duplicates.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs sm:col-span-2 lg:col-span-3">
                <p className="font-black text-amber-950">
                  Possíveis duplicidades
                </p>
                <ul className="mt-2 space-y-1 text-amber-900">
                  {duplicates.map((duplicate) => (
                    <li key={duplicate.id}>
                      {duplicate.officialName} · {duplicate.source.name} ·{" "}
                      {duplicate.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
