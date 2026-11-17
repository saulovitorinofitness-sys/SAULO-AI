import "dotenv/config";

import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import {
  importLocalFoodPackages,
  parseLocalFoodPackages,
} from "../src/features/food-database/local-import";
import { readTacoWorkbook } from "../src/features/food-database/taco-xlsx";
import { prisma } from "../src/lib/database/prisma";

const input =
  process.argv[2] ?? "data/imports/food/raw/Taco-4a-Edicao.xlsx";

const filePath = resolve(input);
const extension = extname(filePath).toLowerCase();

async function main() {
  let rejected = 0;
  const packages =
    extension === ".xlsx"
      ? await readTacoWorkbook(filePath).then((parsed) => {
          rejected = parsed.rejected.length;
          for (const warning of parsed.warnings) {
            console.warn(
              `Aviso na linha ${warning.row}${warning.code ? `, código ${warning.code}` : ""}: ${warning.reason}`,
            );
          }
          for (const row of parsed.rejected) {
            console.error(
              `Linha ${row.row}${row.code ? `, código ${row.code}` : ""}: ${row.reason}`,
            );
          }
          return parseLocalFoodPackages(parsed.package);
        })
      : extension === ".json"
        ? parseLocalFoodPackages(
            JSON.parse(await readFile(filePath, "utf8")) as unknown,
          )
        : (() => {
            throw new Error(
              "Formato não suportado. Utilize a planilha TACO .xlsx ou o JSON canônico local.",
            );
          })();

  const result = await importLocalFoodPackages(packages);
  console.log(
    `Carga local concluída: ${result.created} criado(s), ${result.updated} atualizado(s), ${rejected} rejeitado(s), ${result.total} processado(s).`,
  );
}

await main().finally(() => prisma.$disconnect());
