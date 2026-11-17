import "dotenv/config";

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { parseEvonutWorkbook } from "../src/features/food-database/evonut-audit";
import { importEvonutFoodsAndMeasures } from "../src/features/food-database/evonut-import";
import { prisma } from "../src/lib/database/prisma";

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--dry-run")
    ? "dry-run"
    : null;

if (!mode || (process.argv.includes("--apply") && process.argv.includes("--dry-run"))) {
  throw new Error("Informe exatamente um modo: --dry-run ou --apply.");
}

const sourcePath = resolve(
  process.argv.find((argument) => argument.toLocaleLowerCase().endsWith(".xlsm")) ??
    "data/imports/food/raw/Evonut.xlsm",
);

async function main() {
  const beforeStat = await stat(sourcePath);
  const parsed = parseEvonutWorkbook(await readFile(sourcePath));
  const result = await importEvonutFoodsAndMeasures(prisma, parsed, mode!);
  const afterStat = await stat(sourcePath);
  if (beforeStat.size !== afterStat.size || beforeStat.mtimeMs !== afterStat.mtimeMs) {
    throw new Error("O arquivo Evonut.xlsm foi alterado durante a importação.");
  }
  console.log(JSON.stringify({ sourcePath, sourceSize: afterStat.size, sourceModifiedAt: afterStat.mtime.toISOString(), ...result }, null, 2));
}

await main().finally(() => prisma.$disconnect());
