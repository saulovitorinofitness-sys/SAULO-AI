import type {
  ScientificLibraryArea,
  ScientificLibraryDomain,
  ScientificLibraryItem,
} from "./contracts";
import { SCIENTIFIC_LIBRARY_AREAS } from "./contracts";

export { SCIENTIFIC_LIBRARY_AREAS };
export type { ScientificLibraryArea };

export const scientificLibraryAreaLabels: Readonly<
  Record<ScientificLibraryArea, string>
> = {
  NUTRITION: "Nutrição",
  PERFORMANCE: "Exercício & Performance",
  POSTURAL: "Avaliação Postural",
};

export const scientificLibraryAreaDomains: Readonly<
  Record<ScientificLibraryArea, readonly ScientificLibraryDomain[]>
> = {
  NUTRITION: [
    "FOOD",
    "RECIPE",
    "DATA_SOURCE",
    "EQUATION",
    "ACTIVITY_FACTOR",
    "PATHOLOGY",
    "SUPPLEMENT",
    "FORMULATION",
    "LABORATORY_EXAM",
    "ASSESSMENT",
    "PROTOCOL",
  ],
  PERFORMANCE: ["EXERCISE", "TRAINING_METHOD", "ASSESSMENT", "PROTOCOL"],
  POSTURAL: ["POSTURAL_CHANGE", "POSTURAL_CONDITION", "ASSESSMENT", "PROTOCOL"],
};

export function scientificLibraryAreaForItem(
  item: ScientificLibraryItem,
): ScientificLibraryArea {
  return item.area;
}

export function itemBelongsToScientificArea(
  item: ScientificLibraryItem,
  area: "ALL" | ScientificLibraryArea,
) {
  return area === "ALL" || scientificLibraryAreaForItem(item) === area;
}

function searchableText(item: ScientificLibraryItem) {
  return [
    item.name,
    item.category,
    item.description,
    item.source,
    ...item.tags,
    ...Object.values(item.attributes).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    ),
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export function filterScientificLibraryItems(
  items: readonly ScientificLibraryItem[],
  input: {
    area: "ALL" | ScientificLibraryArea;
    domain: "ALL" | ScientificLibraryDomain;
    query?: string;
    favoritesOnly?: boolean;
    favorites?: ReadonlySet<string>;
  },
) {
  const normalized = input.query?.trim().toLocaleLowerCase("pt-BR") ?? "";
  return items.filter(
    (item) =>
      itemBelongsToScientificArea(item, input.area) &&
      (input.domain === "ALL" || item.domain === input.domain) &&
      (!input.favoritesOnly || input.favorites?.has(item.id)) &&
      (!normalized || searchableText(item).includes(normalized)),
  );
}
