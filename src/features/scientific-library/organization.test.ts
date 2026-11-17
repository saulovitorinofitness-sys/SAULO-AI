import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ScientificLibraryDetails } from "@/components/scientific-library/scientific-library-details";

import type { ScientificLibraryItem } from "./contracts";
import {
  filterScientificLibraryItems,
  itemBelongsToScientificArea,
  scientificLibraryAreaDomains,
  scientificLibraryAreaForItem,
} from "./organization";
import {
  parseScientificAttributeValue,
  scientificAttributeLabel,
} from "./presentation";

function item(
  domain: ScientificLibraryItem["domain"],
  input: Partial<ScientificLibraryItem> = {},
): ScientificLibraryItem {
  return {
    id: `${domain}-test`,
    area:
      domain === "EXERCISE" || domain === "TRAINING_METHOD" || domain === "ASSESSMENT"
        ? "PERFORMANCE"
        : domain === "POSTURAL_CHANGE" || domain === "POSTURAL_CONDITION"
          ? "POSTURAL"
          : "NUTRITION",
    domain,
    name: "Item de teste",
    category: "Categoria",
    description: "Descrição",
    source: "Fonte",
    tags: [],
    attributes: {},
    reusableBy: [],
    reviewedAt: "2026-07-16T17:40:00-03:00",
    reviewedBy: "Saulo Xavier Vitorino",
    initiallyFavorite: false,
    ...input,
  };
}

test("organiza domínios exclusivos sem duplicar registros", () => {
  const food = item("FOOD");
  const exercise = item("EXERCISE");
  const posture = item("POSTURAL_CHANGE");

  assert.equal(scientificLibraryAreaForItem(food), "NUTRITION");
  assert.equal(scientificLibraryAreaForItem(exercise), "PERFORMANCE");
  assert.equal(scientificLibraryAreaForItem(posture), "POSTURAL");
  assert.equal(itemBelongsToScientificArea(food, "PERFORMANCE"), false);
  assert.equal(itemBelongsToScientificArea(food, "ALL"), true);
});

test("usa a área explícita para protocolos e avaliações compartilhados", () => {
  const physicalProtocol = item("PROTOCOL", {
    area: "PERFORMANCE",
    category: "PHYSICAL_ASSESSMENT_PROTOCOL",
  });
  const posturalProtocol = item("PROTOCOL", {
    area: "POSTURAL",
    category: "POSTURAL_ASSESSMENT_PROTOCOL",
  });
  const nutritionProtocol = item("PROTOCOL", {
    area: "NUTRITION",
    category: "CLINICAL_PROTOCOL",
  });
  const physicalAssessment = item("ASSESSMENT", {
    area: "PERFORMANCE",
    reusableBy: ["Avaliação Física"],
  });

  assert.equal(scientificLibraryAreaForItem(physicalProtocol), "PERFORMANCE");
  assert.equal(scientificLibraryAreaForItem(posturalProtocol), "POSTURAL");
  assert.equal(scientificLibraryAreaForItem(physicalAssessment), "PERFORMANCE");
  assert.equal(scientificLibraryAreaForItem(nutritionProtocol), "NUTRITION");
  assert.ok(scientificLibraryAreaDomains.NUTRITION.includes("ASSESSMENT"));
});

test("interpreta JSON estruturado somente para apresentação", () => {
  const stored =
    '[{"name":"colher de sopa","equivalentAmount":25,"unit":"g","demonstrative":true,"officialSource":null}]';
  const parsed = parseScientificAttributeValue(stored);

  assert.ok(Array.isArray(parsed));
  assert.deepEqual(parsed, [
    {
      name: "colher de sopa",
      equivalentAmount: 25,
      unit: "g",
      demonstrative: true,
      officialSource: null,
    },
  ]);
  assert.equal(scientificAttributeLabel("equivalentAmount"), "Quantidade equivalente");
  assert.equal(stored.startsWith("[{"), true);
});

test("mantém texto comum e JSON inválido sem perda", () => {
  assert.equal(parseScientificAttributeValue("Não informado"), "Não informado");
  assert.equal(parseScientificAttributeValue("[valor incompleto"), "[valor incompleto");
});

test("combina área, domínio, busca e favoritos sem alterar itens", () => {
  const foods = [
    item("FOOD", { id: "food-1", name: "Arroz integral", initiallyFavorite: true }),
    item("FOOD", { id: "food-2", name: "Aveia em flocos" }),
  ];
  const exercises = [
    item("EXERCISE", { id: "exercise-1", name: "Agachamento" }),
  ];
  const items = [...foods, ...exercises];
  const favorites = new Set(["food-1"]);

  assert.deepEqual(
    filterScientificLibraryItems(items, {
      area: "NUTRITION",
      domain: "FOOD",
      query: "arroz",
      favoritesOnly: true,
      favorites,
    }).map((entry) => entry.id),
    ["food-1"],
  );
  assert.deepEqual(
    filterScientificLibraryItems(items, {
      area: "PERFORMANCE",
      domain: "ALL",
      query: "agachamento",
    }).map((entry) => entry.id),
    ["exercise-1"],
  );
  assert.equal(items.length, 3);
});

test("renderiza valor estruturado sem expor JSON bruto", () => {
  const food = item("FOOD", {
    name: "Arroz integral",
    attributes: {
      "Porção mockada":
        '[{"name":"colher de sopa","equivalentAmount":25,"unit":"g"}]',
    },
  });
  const html = renderToStaticMarkup(
    createElement(ScientificLibraryDetails, { item: food }),
  );

  assert.match(html, /Quantidade equivalente/);
  assert.match(html, /colher de sopa/);
  assert.doesNotMatch(html, /\[\{&quot;name&quot;/);
});
