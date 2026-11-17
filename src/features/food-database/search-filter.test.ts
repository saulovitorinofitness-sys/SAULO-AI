import assert from "node:assert/strict";
import test from "node:test";

import type { FoodSearchInput } from "./contracts";
import {
  buildFoodSearchWhere,
  resolveFoodCategorySearchAliases,
  resolveFoodSearchPagination,
} from "./search-filter";

function expectedSourceFilter(source: "TACO" | "TBCA" | "IBGE") {
  return {
    is: {
      OR: [
        { kind: source },
        { name: { equals: source, mode: "insensitive" } },
      ],
    },
  };
}

test("TACO oficial combina pela origem kind", () => {
  const where = buildFoodSearchWhere({ source: "TACO" });

  assert.deepEqual(where.source, expectedSourceFilter("TACO"));
  assert.deepEqual(where.source?.is?.OR?.[0], { kind: "TACO" });
});

test("TACO via Evonut combina pelo nome cientifico", () => {
  const where = buildFoodSearchWhere({ source: "TACO" });

  assert.deepEqual(where.source, expectedSourceFilter("TACO"));
  assert.deepEqual(where.source?.is?.OR?.[1], {
    name: { equals: "TACO", mode: "insensitive" },
  });
});

test("TBCA via Evonut combina pelo nome cientifico", () => {
  const where = buildFoodSearchWhere({ source: "TBCA" });

  assert.deepEqual(where.source, expectedSourceFilter("TBCA"));
  assert.deepEqual(where.source?.is?.OR?.[1], {
    name: { equals: "TBCA", mode: "insensitive" },
  });
});

test("IBGE via Evonut combina pelo nome cientifico", () => {
  const where = buildFoodSearchWhere({ source: "IBGE" });

  assert.deepEqual(where.source, expectedSourceFilter("IBGE"));
  assert.deepEqual(where.source?.is?.OR?.[1], {
    name: { equals: "IBGE", mode: "insensitive" },
  });
});

test("Todas nao aplica filtro de fonte", () => {
  const where = buildFoodSearchWhere({ category: "Frutas", source: "ALL" });

  assert.equal(where.OR, undefined);
  assert.equal(where.source, undefined);
  assert.deepEqual(resolveFoodCategorySearchAliases("Frutas"), ["fruta"]);
  assert.match(JSON.stringify(where.category), /fruta/);
});

test("filtro por nome usa somente fontes reais fornecidas pelo banco", () => {
  const where = buildFoodSearchWhere({
    query: "pão francês",
    sourceName: "TBCA",
  });

  assert.deepEqual(where.source, {
    is: { name: { equals: "TBCA", mode: "insensitive" } },
  });
});

test("busca combina nome normalizado, palavras, sinônimos e código da fonte", () => {
  const serialized = JSON.stringify(
    buildFoodSearchWhere({ query: "pão francês" }),
  );

  assert.match(serialized, /officialName/);
  assert.match(serialized, /normalizedName/);
  assert.match(serialized, /synonyms/);
  assert.match(serialized, /sourceCode/);
  assert.match(serialized, /pao/);
  assert.match(serialized, /frances/);
});

test("preserva texto, categoria, status, fonte e paginacao", () => {
  const input = {
    query: "banana",
    category: "Frutas",
    source: "TACO",
    status: "INACTIVE",
    page: 2,
    pageSize: 12,
  } satisfies FoodSearchInput;
  const where = buildFoodSearchWhere(input);
  const filter = JSON.stringify(where);

  assert.equal(where.status, "INACTIVE");
  assert.deepEqual(where.source, expectedSourceFilter("TACO"));
  assert.match(filter, /"normalizedName":\{"contains":"fruta"\}/);
  assert.match(filter, /"normalizedName":\{"contains":"banana"\}/);
  assert.deepEqual(resolveFoodSearchPagination(input), {
    page: 2,
    pageSize: 12,
  });
});

test("todas as categorias simplificadas possuem aliases de pesquisa", () => {
  const expected = [
    "Cereais e tubérculos",
    "Frutas",
    "Carnes",
    "Ovos",
    "Laticínios",
    "Leguminosas",
    "Verduras e legumes",
    "Bebidas",
    "Oleaginosas",
  ];

  for (const category of expected) {
    assert.ok(resolveFoodCategorySearchAliases(category).length > 0, category);
  }
});

test("categoria original não simplificada mantém correspondência exata", () => {
  assert.deepEqual(resolveFoodCategorySearchAliases("Frutas e derivados"), [
    "frutas e derivados",
  ]);
});
