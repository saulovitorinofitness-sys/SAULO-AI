import "dotenv/config";

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { prisma } from "@/lib/database/prisma";

import {
  EVONUT_AUTHORIZED_SHEETS,
  parseEvonutWorkbook,
} from "./evonut-audit";
import { normalizeFoodSearchText } from "./normalization";

const workbookPath = resolve("data/imports/food/raw/Evonut.xlsm");

async function parseRealWorkbook() {
  return parseEvonutWorkbook(await readFile(workbookPath));
}

test("audita somente BD_Alimentos e BD_Medidas sem alterar o XLSM", async () => {
  const beforeBytes = await readFile(workbookPath);
  const beforeStat = await stat(workbookPath);
  const parsed = parseEvonutWorkbook(beforeBytes);
  const afterBytes = await readFile(workbookPath);
  const afterStat = await stat(workbookPath);
  const hash = (bytes: Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex").toUpperCase();

  assert.deepEqual(EVONUT_AUTHORIZED_SHEETS, ["BD_Alimentos", "BD_Medidas"]);
  assert.equal(parsed.foodHeaderRow, 3);
  assert.equal(parsed.measureHeaderRow, 3);
  assert.equal(hash(beforeBytes), hash(afterBytes));
  assert.equal(beforeStat.size, afterStat.size);
  assert.equal(beforeStat.mtimeMs, afterStat.mtimeMs);
});

test("preserva código, fonte, nutrientes e relaciona medidas pelo código Evonut", async () => {
  const parsed = await parseRealWorkbook();
  const required = [
    "arroz, integral, cozido",
    "feijão, carioca, cozido",
    "pão, trigo, francês",
    "banana, prata, crua",
    "abacaxi, cru",
    "café, infusão 10%",
    "leite, vaca, integral",
    "ovo, galinha",
    "frango",
    "batata-doce",
    "=macaxeira cozido(a)",
  ];

  for (const query of required) {
    const exact = query.startsWith("=");
    const normalizedQuery = normalizeFoodSearchText(exact ? query.slice(1) : query);
    const food = parsed.validFoods.find((candidate) =>
      exact
        ? candidate.normalizedName === normalizedQuery
        : candidate.normalizedName.includes(normalizedQuery),
    );
    assert.ok(food, `Alimento real não encontrado: ${query}`);
    assert.ok(food.sourceCode);
    assert.ok(food.originalSource);
    assert.equal(typeof food.nutrients.Energia, "number");
    const measures = parsed.measures.filter(
      (measure) => measure.foodSourceCode === food.sourceCode,
    );
    assert.ok(measures.length > 0, `Medidas não encontradas para ${food.originalName}`);
    assert.ok(
      measures.every(
        (measure) =>
          measure.foodName === food.originalName &&
          measure.originalNutritionSource === food.originalSource,
      ),
    );
  }
});

test("mantém ausências como null e rejeita valores negativos sem criar zero", async () => {
  const parsed = await parseRealWorkbook();
  assert.ok(parsed.validFoods.some((food) => food.missingNutrients.length > 0));
  assert.ok(
    parsed.invalidFoods.some((food) =>
      food.reasons.some((reason) => reason.startsWith("NUTRIENTE_INVALIDO:")),
    ),
  );
  assert.equal(parsed.measures.some((measure) => measure.measureValue <= 0), false);
});

test("a auditoria não modifica o PostgreSQL", async () => {
  const before = await Promise.all([
    prisma.food.count(),
    prisma.foodNutrients.count(),
    prisma.foodHouseholdMeasure.count(),
    prisma.foodHouseholdMeasureReference.count(),
  ]);
  await parseRealWorkbook();
  const after = await Promise.all([
    prisma.food.count(),
    prisma.foodNutrients.count(),
    prisma.foodHouseholdMeasure.count(),
    prisma.foodHouseholdMeasureReference.count(),
  ]);
  assert.deepEqual(after, before);
});

test.after(async () => {
  await prisma.$disconnect();
});
