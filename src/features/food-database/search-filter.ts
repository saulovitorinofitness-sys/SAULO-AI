import type { Prisma } from "@/generated/prisma/client";

import type { FoodSearchInput } from "./contracts";
import { normalizeFoodSearchText } from "./normalization";

const categoryAliases: Readonly<Record<string, readonly string[]>> = {
  "cereais e tuberculos": [
    "cereal",
    "tuberculo",
    "raizes",
    "farinha",
    "fecula",
    "massa",
  ],
  frutas: ["fruta"],
  carnes: [
    "carne",
    "pescado",
    "peixe",
    "frutos do mar",
    "aves",
    "visceras",
  ],
  ovos: ["ovo"],
  laticinios: ["laticinio", "leite e derivados"],
  leguminosas: ["leguminosa"],
  "verduras e legumes": ["verdura", "hortalica", "legume", "vegetal"],
  bebidas: ["bebida"],
  oleaginosas: ["oleaginosa", "nozes", "sementes", "castanhas"],
};

export function resolveFoodCategorySearchAliases(category: string) {
  const normalizedCategory = normalizeFoodSearchText(category);
  return categoryAliases[normalizedCategory] ?? [normalizedCategory];
}

export function resolveFoodSearchPagination(input: FoodSearchInput) {
  return {
    page: Math.max(1, input.page ?? 1),
    pageSize: Math.min(50, Math.max(1, input.pageSize ?? 20)),
  };
}

function resolveFoodSourceSearchFilter(
  source: Exclude<FoodSearchInput["source"], "ALL" | undefined>,
): Prisma.NutritionSourceScalarRelationFilter {
  const normalizedSource = normalizeFoodSearchText(source).toUpperCase();

  return {
    is: {
      OR: [
        { kind: source },
        {
          name: {
            equals: normalizedSource,
            mode: "insensitive",
          },
        },
      ],
    },
  };
}

export function buildFoodSearchWhere(
  input: FoodSearchInput,
): Prisma.FoodWhereInput {
  const query = input.query?.trim();
  const normalizedQuery = normalizeFoodSearchText(query ?? "");
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const categorySearchAliases = input.category
    ? resolveFoodCategorySearchAliases(input.category)
    : [];

  return {
    status: input.status ?? "ACTIVE",
    category: categorySearchAliases.length
      ? {
          is: {
            OR: categorySearchAliases.map((alias) => ({
              normalizedName: { contains: alias },
            })),
          },
        }
      : undefined,
    source: input.sourceName?.trim()
      ? {
          is: {
            name: {
              equals: input.sourceName.trim(),
              mode: "insensitive",
            },
          },
        }
      : input.source && input.source !== "ALL"
        ? resolveFoodSourceSearchFilter(input.source)
        : undefined,
    OR: query
      ? [
          {
            officialName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            sourceOriginalName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            professionalName: {
              contains: query,
              mode: "insensitive",
            },
          },
          { normalizedName: { contains: normalizedQuery } },
          { sourceCode: { contains: query, mode: "insensitive" } },
          {
            AND: queryTokens.map((token) => ({
              OR: [
                { normalizedName: { contains: token } },
                {
                  synonyms: {
                    some: { normalizedName: { contains: token } },
                  },
                },
              ],
            })),
          },
          {
            description: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            foodGroup: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            preparationState: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            presentation: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            synonyms: {
              some: {
                normalizedName: { contains: normalizedQuery },
              },
            },
          },
          {
            category: {
              name: { contains: query, mode: "insensitive" },
            },
          },
          {
            source: {
              name: { contains: query, mode: "insensitive" },
            },
          },
        ]
      : undefined,
  };
}
