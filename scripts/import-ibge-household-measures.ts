import "dotenv/config";

import { resolve } from "node:path";

import { importIbgeHouseholdMeasures } from "../src/features/food-database/ibge-household-measure-import";
import { prisma } from "../src/lib/database/prisma";

const input = process.argv[2] ?? "data/imports/food/raw/liv50000.pdf";

async function main() {
  const result = await importIbgeHouseholdMeasures(resolve(input));
  console.log(JSON.stringify(result, null, 2));
}

await main().finally(() => prisma.$disconnect());
