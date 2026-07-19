"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Input, PageState, Select } from "@/components/ui";
import type { PrescriptionEntryKind } from "@/features/nutrition-prescription";
import type { ScientificLibraryItem } from "@/features/scientific-library";
import {
  parseDemonstrativeMeasureAssociations,
  type DemonstrativeMeasureAssociation,
} from "@/features/shared-data/household-measure-catalog";

type LibraryTab =
  | "RECENT"
  | "FAVORITE"
  | "ALL"
  | "RECIPE"
  | "SUPPLEMENT";

export interface QuickAddValues {
  readonly quantity: string;
  readonly measureAssociationId: string;
  readonly measureLabel: string;
  readonly unitEquivalence: number | null;
  readonly totalAmount: number;
  readonly unit: "g" | "ml";
  readonly estimated: boolean;
  readonly demonstrative: true;
  readonly officialSource: string | null;
}

const tabLabels: Record<LibraryTab, string> = {
  RECENT: "Recentes",
  FAVORITE: "Favoritos",
  ALL: "Todos",
  RECIPE: "Receitas",
  SUPPLEMENT: "Suplementos",
};

const attribute = (item: ScientificLibraryItem, key: string): string => {
  const value = item.attributes[key];
  return typeof value === "string" ? value : value?.join(" ") ?? "";
};

function measureOptions(
  item: ScientificLibraryItem,
): readonly DemonstrativeMeasureAssociation[] {
  const serialized =
    attribute(item, "Porção mockada") ||
    attribute(item, "Apresentação") ||
    attribute(item, "Medidas demonstrativas");
  return parseDemonstrativeMeasureAssociations(serialized);
}

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

function numericValue(value: string): number {
  return Number(value.replace(",", "."));
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function matchesSearch(item: ScientificLibraryItem, normalizedQuery: string) {
  const text = [
    item.name,
    item.category,
    item.source,
    ...item.tags,
    attribute(item, "Sinônimos"),
    attribute(item, "Grupo alimentar"),
  ].join(" ");
  return normalizeSearch(text).includes(normalizedQuery);
}

function matchesAdvancedFilters(
  item: ScientificLibraryItem,
  group: string,
  source: string,
  category: string,
) {
  const itemGroup = attribute(item, "Grupo alimentar") || item.category;
  return (
    (group === "ALL" || itemGroup === group) &&
    (source === "ALL" || item.source === source) &&
    (category === "ALL" || item.category === category)
  );
}

function kindFor(item: ScientificLibraryItem): PrescriptionEntryKind {
  return item.domain === "RECIPE"
    ? "RECIPE"
    : item.domain === "SUPPLEMENT"
      ? "SUPPLEMENT"
      : "FOOD";
}

export function NutritionLibraryPanel({
  foods,
  recipes,
  supplements,
  favorites,
  onToggleFavorite,
  onAdd,
}: {
  foods: readonly ScientificLibraryItem[];
  recipes: readonly ScientificLibraryItem[];
  supplements: readonly ScientificLibraryItem[];
  favorites: ReadonlySet<string>;
  onToggleFavorite: (id: string) => void;
  onAdd: (
    item: ScientificLibraryItem,
    kind: PrescriptionEntryKind,
    values?: QuickAddValues,
  ) => void;
}) {
  const allItems = useMemo(
    () => [...foods, ...recipes, ...supplements],
    [foods, recipes, supplements],
  );
  const [tab, setTab] = useState<LibraryTab>("RECENT");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [recentIds, setRecentIds] = useState<readonly string[]>(() =>
    foods.slice(0, 6).map((item) => item.id),
  );
  const [selectedId, setSelectedId] = useState(foods[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [measureLabel, setMeasureLabel] = useState(
    foods[0] ? measureOptions(foods[0])[0]?.name ?? "" : "",
  );
  const [manualAmount, setManualAmount] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  const tabItems = useMemo(() => {
    if (tab === "RECIPE") return recipes;
    if (tab === "SUPPLEMENT") return supplements;
    if (tab === "FAVORITE") {
      return allItems.filter((item) => favorites.has(item.id));
    }
    if (tab === "RECENT") {
      return recentIds
        .map((id) => allItems.find((item) => item.id === id))
        .filter((item): item is ScientificLibraryItem => Boolean(item));
    }
    return allItems;
  }, [allItems, favorites, recentIds, recipes, supplements, tab]);
  const groups = useMemo(
    () => [
      ...new Set(
        tabItems.map(
          (item) => attribute(item, "Grupo alimentar") || item.category,
        ),
      ),
    ],
    [tabItems],
  );
  const sources = useMemo(
    () => [...new Set(tabItems.map((item) => item.source))],
    [tabItems],
  );
  const categories = useMemo(
    () => [...new Set(tabItems.map((item) => item.category))],
    [tabItems],
  );
  const visible = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return normalizedQuery
      ? allItems.filter((item) => matchesSearch(item, normalizedQuery))
      : tabItems.filter((item) =>
          matchesAdvancedFilters(item, group, source, category),
        );
  }, [allItems, category, group, query, source, tabItems]);
  const selected = allItems.find((item) => item.id === selectedId);
  const quickOptions = selected && !visible.some((item) => item.id === selected.id)
    ? [selected, ...visible]
    : visible;
  const selectedOptions = selected ? measureOptions(selected) : [];
  const selectedMeasure =
    selectedOptions.find((option) => option.name === measureLabel) ??
    selectedOptions[0];
  const manualEntry = selectedMeasure?.equivalentAmount === null;
  const quantityValue = numericValue(quantity);
  const manualValue = numericValue(manualAmount);
  const totalAmount = selectedMeasure
    ? manualEntry
      ? manualValue
      : quantityValue * selectedMeasure.equivalentAmount
    : Number.NaN;

  function selectItem(item: ScientificLibraryItem) {
    const firstMeasure = measureOptions(item)[0];
    setSelectedId(item.id);
    setMeasureLabel(firstMeasure?.name ?? "");
    setQuantity("1");
    setManualAmount("");
    setValidationMessage("");
  }

  function clearSelection() {
    setSelectedId("");
    setMeasureLabel("");
    setQuantity("1");
    setManualAmount("");
    setValidationMessage("");
  }

  function changeQuery(nextQuery: string) {
    const normalizedQuery = normalizeSearch(nextQuery);
    const nextResults = normalizedQuery
      ? allItems.filter((item) => matchesSearch(item, normalizedQuery))
      : tabItems.filter((item) =>
          matchesAdvancedFilters(item, group, source, category),
        );

    setQuery(nextQuery);
    if (nextResults[0]) selectItem(nextResults[0]);
    else clearSelection();
  }

  function remember(item: ScientificLibraryItem) {
    setRecentIds((current) => [
      item.id,
      ...current.filter((id) => id !== item.id),
    ].slice(0, 8));
  }

  function addDefault(item: ScientificLibraryItem) {
    if (item.id !== selected?.id) {
      selectItem(item);
      setValidationMessage(
        "Confirme a medida e informe uma quantidade válida para adicionar.",
      );
      return;
    }
    addConfigured();
  }

  function addConfigured() {
    if (!selected) {
      setValidationMessage("Selecione um alimento.");
      return;
    }
    if (!selectedMeasure) {
      setValidationMessage("Selecione uma medida.");
      return;
    }
    if (manualEntry ? !(manualValue > 0) : !(quantityValue > 0)) {
      setValidationMessage(
        manualEntry
          ? `Informe um valor válido em ${selectedMeasure.unit}.`
          : "Informe uma quantidade válida de medidas.",
      );
      return;
    }

    remember(selected);
    onAdd(selected, kindFor(selected), {
      quantity: manualEntry ? "" : quantity,
      measureAssociationId: selectedMeasure.id,
      measureLabel: selectedMeasure.name,
      unitEquivalence: selectedMeasure.equivalentAmount,
      totalAmount,
      unit: selectedMeasure.unit,
      estimated: !manualEntry,
      demonstrative: selectedMeasure.demonstrative,
      officialSource: selectedMeasure.officialSource,
    });
    setValidationMessage("Item adicionado à refeição ativa.");
  }

  function changeTab(next: LibraryTab) {
    const nextItems =
      next === "RECIPE"
        ? recipes
        : next === "SUPPLEMENT"
          ? supplements
          : next === "FAVORITE"
            ? allItems.filter((item) => favorites.has(item.id))
            : next === "RECENT"
              ? recentIds
                  .map((id) => allItems.find((item) => item.id === id))
                  .filter(
                    (item): item is ScientificLibraryItem => Boolean(item),
                  )
              : allItems;

    setTab(next);
    setGroup("ALL");
    setSource("ALL");
    setCategory("ALL");
    const normalizedQuery = normalizeSearch(query);
    const nextSelection = normalizedQuery
      ? allItems.find((item) => matchesSearch(item, normalizedQuery))
      : nextItems[0];
    if (nextSelection) selectItem(nextSelection);
    else clearSelection();
  }

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
            Inclusão rápida
          </p>
          <h2 className="mt-0.5 font-black text-[var(--text-primary)]">
            Biblioteca nutricional
          </h2>
        </div>
        <Badge tone="info">Dados demonstrativos</Badge>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Buscar alimento ou receita</span>
        <Input
          onChange={(event) => changeQuery(event.target.value)}
          placeholder="Buscar alimento ou receita"
          type="search"
          value={query}
        />
      </label>

      <div
        aria-label="Categorias da biblioteca"
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
      >
        {(Object.keys(tabLabels) as LibraryTab[]).map((value) => (
          <button
            aria-selected={tab === value}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-black ${
              tab === value
                ? "border-[var(--primary)] bg-[var(--secondary)] text-[var(--primary-hover)]"
                : "border-[var(--line)] bg-white text-[var(--text-secondary)]"
            }`}
            key={value}
            onClick={() => changeTab(value)}
            role="tab"
            type="button"
          >
            {tabLabels[value]}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="mt-3 grid gap-2 rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,2fr)_minmax(9rem,1fr)_7rem_minmax(9rem,1fr)_auto] lg:items-end">
          <label>
            <span className="text-xs font-black text-[var(--text-secondary)]">
              Alimento
            </span>
            <Select
              className="mt-1"
              onChange={(event) => {
                const item = allItems.find(
                  (candidate) => candidate.id === event.target.value,
                );
                if (item) selectItem(item);
              }}
              value={selected.id}
            >
              {quickOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>

          <label>
            <span className="text-xs font-black text-[var(--text-secondary)]">
              Medida caseira
            </span>
            <Select
              className="mt-1"
              onChange={(event) => {
                setSelectedId(selected.id);
                setMeasureLabel(event.target.value);
                setValidationMessage("");
              }}
              value={selectedMeasure?.name ?? ""}
            >
              {selectedOptions.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
            </Select>
          </label>

          <label>
            <span className="text-xs font-black text-[var(--text-secondary)]">
              Quantidade
            </span>
            <Input
              className="mt-1"
              disabled={manualEntry}
              inputMode="decimal"
              onChange={(event) => {
                setQuantity(event.target.value);
                setValidationMessage("");
              }}
              placeholder={manualEntry ? "Não necessário" : "Ex.: 2"}
              value={quantity}
            />
          </label>

          <label>
            <span className="text-xs font-black text-[var(--text-secondary)]">
              Peso ou volume manual
            </span>
            <Input
              className="mt-1"
              disabled={!manualEntry}
              inputMode="decimal"
              onChange={(event) => {
                setManualAmount(event.target.value);
                setValidationMessage("");
              }}
              placeholder={
                manualEntry
                  ? `Informe em ${selectedMeasure?.unit ?? "g"}`
                  : "Calculado pela medida"
              }
              value={manualAmount}
            />
          </label>

          <Button onClick={addConfigured} size="small" type="button">
            Adicionar
          </Button>

          <div className="sm:col-span-2 lg:col-span-5">
            {selectedMeasure ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                {manualEntry ? (
                  <p>
                    Entrada manual em {selectedMeasure.unit}; quantidade de
                    medidas não é necessária.
                  </p>
                ) : (
                  <>
                    <p>
                      1 {selectedMeasure.name} ={" "}
                      {numberFormatter.format(
                        selectedMeasure.equivalentAmount ?? 0,
                      )}{" "}
                      {selectedMeasure.unit}
                    </p>
                    <p className="font-black text-[var(--primary-hover)]">
                      Total estimado:{" "}
                      {quantityValue > 0
                        ? numberFormatter.format(totalAmount)
                        : "—"}{" "}
                      {selectedMeasure.unit}
                    </p>
                  </>
                )}
                {manualEntry && manualValue > 0 ? (
                  <p className="font-black text-[var(--primary-hover)]">
                    Total informado: {numberFormatter.format(manualValue)}{" "}
                    {selectedMeasure.unit}
                  </p>
                ) : null}
              </div>
            ) : null}

            <p
              aria-live="polite"
              className={`mt-1 text-xs font-bold ${
                validationMessage.startsWith("Item adicionado")
                  ? "text-emerald-700"
                  : "text-[var(--danger)]"
              }`}
              role={
                validationMessage &&
                !validationMessage.startsWith("Item adicionado")
                  ? "alert"
                  : undefined
              }
            >
              {validationMessage}
            </p>
            <p className="mt-1 text-[0.68rem] text-[var(--muted)]">
              Equivalências exclusivamente demonstrativas; a decisão e a
              validação permanecem com o nutricionista.
            </p>
          </div>
        </div>
      ) : null}

      <details className="mt-3 rounded-xl border border-[var(--line)] bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-black text-[var(--text-secondary)]">
          Mais filtros
        </summary>
        <div className="grid gap-2 border-t border-[var(--line)] p-3 sm:grid-cols-3">
          <label>
            <span className="text-xs font-bold text-[var(--muted)]">
              Grupo alimentar
            </span>
            <Select
              className="mt-1"
              onChange={(event) => setGroup(event.target.value)}
              value={group}
            >
              <option value="ALL">Todos</option>
              {groups.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>

          <label>
            <span className="text-xs font-bold text-[var(--muted)]">
              Fonte mockada
            </span>
            <Select
              className="mt-1"
              onChange={(event) => setSource(event.target.value)}
              value={source}
            >
              <option value="ALL">Todas</option>
              {sources.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>

          <label>
            <span className="text-xs font-bold text-[var(--muted)]">
              Categoria
            </span>
            <Select
              className="mt-1"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              <option value="ALL">Todas</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </details>

      <p aria-live="polite" className="mt-3 text-xs font-bold text-[var(--muted)]">
        {normalizeSearch(query) ? "Resultados da busca · " : ""}
        {visible.length} opção(ões) demonstrativa(s)
      </p>

      {visible.length ? (
        <ul
          className="mt-2 grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
          role="list"
        >
          {visible.map((item) => (
            <li
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--text-primary)]">
                  {item.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                  {item.category} · {item.source}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  aria-label={
                    favorites.has(item.id)
                      ? `Remover ${item.name} dos favoritos`
                      : `Favoritar ${item.name}`
                  }
                  aria-pressed={favorites.has(item.id)}
                  className="grid size-9 place-items-center rounded-full border border-[var(--line)] text-amber-600"
                  onClick={() => onToggleFavorite(item.id)}
                  type="button"
                >
                  {favorites.has(item.id) ? "★" : "☆"}
                </button>
                <Button
                  onClick={() => addDefault(item)}
                  size="small"
                  type="button"
                >
                  Adicionar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <PageState
            description="Ajuste a busca ou os filtros demonstrativos."
            title="Nenhum item encontrado"
          />
        </div>
      )}
    </Card>
  );
}
