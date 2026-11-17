import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

const unit = "11111111-1111-4111-8111-111111111111";
const receiptId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
type Element = { type: string; props: Record<string, unknown> };

function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!node || typeof node !== "object" || !("type" in node)) return [];
  const element = node as Element;
  return [element, ...walk(element.props.children)];
}

async function harness(authorized: boolean) {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let reads = 0;
  let writes = 0;
  const item = { id: receiptId, documentKind: "SALARY_RECEIPT", documentState: "BANK_PROVEN", businessUnitId: unit, payrollStatementId: "statement-1", employmentId: "employment-1", employeeId: "employee-1", documentNumber: "SAL-01", version: 2, employeeName: "Funcionária A", employmentCode: "MAT-1", businessUnitName: "Unidade A", competence: new Date("2026-09-01T00:00:00Z"), issuedAt: new Date("2026-09-10T12:00:00Z"), issuerName: "Emissor persistido" };
  const filters: Record<string, unknown>[] = [];
  const repo = {
    listUnits: async () => { reads++; return [{ id: unit, name: "Unidade A" }]; },
    list: async (query: Record<string, unknown>) => { reads++; filters.push(query); return { items: [item], total: 41, page: query.page, pageSize: 20, totalPages: 3 }; },
    create: () => { writes++; },
  };
  const testModule = { exports: {} as { default: (props: { searchParams: Promise<Record<string, string>> }) => Promise<unknown> } };
  runInNewContext(compiled, { module: testModule, exports: testModule.exports, Date, Intl, Number, URLSearchParams, Promise, require(id: string) {
    if (id === "react/jsx-runtime") return { jsx: (type: string, props: Record<string, unknown>) => ({ type, props }), jsxs: (type: string, props: Record<string, unknown>) => ({ type, props }) };
    if (id === "next/link") return { default: "Link" };
    if (id === "next/navigation") return { notFound: () => { throw new Error("NOT_FOUND"); } };
    if (id === "@/features/financial/management-documents/repository") return { managementDocumentsRepository: repo };
    if (id === "@/features/mvp") return { mvpService: { getSession: async () => ({ user: authorized ? { id: "saulo" } : { id: "outro" } }) } };
    if (id === "@/modules/permissions") return { BUILT_IN_IDS: { users: { sauloXavierVitorino: "saulo" } } };
    throw new Error(id);
  } });
  return { page: testModule.exports.default, reads: () => reads, writes: () => writes, filters };
}

test("página exige autorização real antes de qualquer leitura", async () => {
  const { page, reads } = await harness(false);
  await assert.rejects(page({ searchParams: Promise.resolve({}) }), /NOT_FOUND/);
  assert.equal(reads(), 0);
});

test("cartão identifica recibo comprovado e vincula somente o ID exato à rota privada", async () => {
  const { page, writes } = await harness(true);
  const tree = walk(await page({ searchParams: Promise.resolve({ unidade: unit, funcionario: "MAT-1", competencia: "2026-09", numero: "PAG", pagina: "2" }) }));
  const link = tree.find((element) => element.props.children === "Visualizar");
  const href = String(link?.props.href);
  assert.match(href, new RegExp(receiptId));
  assert.doesNotMatch(href, /businessUnitId|payrollStatementId|employmentId|employeeId/);
  assert.ok(tree.some((element) => element.props.children === "Imprimir" && String(element.props.href).includes(`${receiptId}?print=1&intent=PRINT`)));
  assert.ok(tree.some((element) => element.props.children === "Salvar em PDF" && String(element.props.href).includes(`${receiptId}?print=1&intent=SAVE_PDF`)));
  assert.match(JSON.stringify(tree), /Recibo de pagamento salarial|Pagamento comprovado/);
  assert.equal(writes(), 0);
});

test("filtros, situação documental e paginação passam ao repositório sem escrita", async () => {
  const { page, filters, writes } = await harness(true);
  const tree = walk(await page({ searchParams: Promise.resolve({ unidade: unit, funcionario: "Ana", competencia: "2026-09", numero: "SAL", status: "BANK_PROVEN", pagina: "2" }) }));
  assert.equal(filters[0]?.businessUnitId, unit);
  assert.equal(filters[0]?.employee, "Ana");
  assert.equal(filters[0]?.receiptNumber, "SAL");
  assert.equal(filters[0]?.state, "BANK_PROVEN");
  assert.equal(filters[0]?.page, 2);
  assert.ok(tree.some((element) => String(element.props.href).includes("pagina=3")));
  assert.equal(writes(), 0);
});

test("status fora do escopo não consulta recibos nem exibe documentos de serviço, férias ou 13º", async () => {
  const { page, filters } = await harness(true);
  const tree = walk(await page({ searchParams: Promise.resolve({ status: "DRAFT" }) }));
  assert.equal(filters.length, 0);
  assert.equal(tree.filter((element) => element.type === "article").length, 0);
  assert.doesNotMatch(JSON.stringify(tree), /Recibo de prestação de serviço|Férias|13º salário/);
});

test("botão da Folha abre o mesmo visualizador pelo ID emitido", async () => {
  const source = await readFile(new URL("../folha-pagamento/page.tsx", import.meta.url), "utf8");
  const open = source.slice(source.indexOf("  function openPaymentReceipt("), source.indexOf("  function changeBusinessUnit("));
  assert.match(open, /recibos-pagamento\/\$\{encodeURIComponent\(receipt.id\)\}/);
  for (const id of ["businessUnitId", "payrollStatementId", "employmentId", "employeeId"]) assert.match(open, new RegExp(id));
  assert.match(source, /disabled=\{receipt.status !== "ISSUED"\}/);
  assert.match(source, /Confirmar pagamento e emitir recibo/);
  assert.match(source, /SalaryPaymentConfirmation/);
  assert.doesNotMatch(source, /issue-payment-receipt/);
  assert.doesNotMatch(open, /document\.write|payrollReceipt\.create/);
});
