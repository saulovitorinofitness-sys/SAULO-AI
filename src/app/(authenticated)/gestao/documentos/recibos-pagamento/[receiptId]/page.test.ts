import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

const ids = {
  receiptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  businessUnitId: "11111111-1111-4111-8111-111111111111",
  payrollStatementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  employmentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  employeeId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};

async function harness(authorized = true, found = true) {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const calls: Record<string, string>[] = [];
  const idCalls: string[] = [];
  let writes = 0;
  const receipt = { id: ids.receiptId, receiptNumber: "PAG-01", version: 2, issuerName: "Emissor persistido" };
  const testModule = { exports: {} as { default: (props: { params: Promise<{ receiptId: string }>; searchParams: Promise<Record<string, string>> }) => Promise<{ props: { receipt: typeof receipt } }> } };
  runInNewContext(compiled, { module: testModule, exports: testModule.exports, Promise, require(id: string) {
    if (id === "react/jsx-runtime") return { jsx: (type: string, props: Record<string, unknown>) => ({ type, props }) };
    if (id === "next/navigation") return { notFound: () => { throw new Error("NOT_FOUND"); } };
    if (id === "@/components/financial/payroll-receipt-document") return { PayrollReceiptDocument: "PayrollReceiptDocument" };
    if (id === "@/features/financial/management-documents/repository") return { managementDocumentsRepository: { findExact: async (identity: Record<string, string>) => { calls.push(identity); return found ? receipt : null; }, findByReceiptId: async (receiptId: string) => { idCalls.push(receiptId); return found ? receipt : null; }, create: () => { writes++; } } };
    if (id === "@/features/mvp") return { mvpService: { getSession: async () => ({ user: { id: authorized ? "saulo" : "outro" } }) } };
    if (id === "@/modules/permissions") return { BUILT_IN_IDS: { users: { sauloXavierVitorino: "saulo" } } };
    throw new Error(id);
  } });
  const open = (query: Record<string, string> = {}) => testModule.exports.default({ params: Promise.resolve({ receiptId: ids.receiptId }), searchParams: Promise.resolve(query) });
  return { open, calls, idCalls, writes: () => writes };
}

test("detalhe exige autorização administrativa antes de consultar", async () => {
  const { open, calls } = await harness(false);
  await assert.rejects(open(), /NOT_FOUND/);
  assert.equal(calls.length, 0);
});

test("abre exatamente o ID solicitado, preservando número, versão e emissor persistidos", async () => {
  const { open, calls, idCalls, writes } = await harness();
  const element = await open(ids);
  assert.equal(element.props.receipt.id, ids.receiptId);
  assert.equal(element.props.receipt.version, 2);
  assert.equal(element.props.receipt.issuerName, "Emissor persistido");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ids);
  assert.equal(idCalls.length, 0);
  assert.equal(writes(), 0);
});

test("abre o recibo retornado pela confirmação usando somente seu ID", async () => {
  const { open, calls, idCalls } = await harness();
  const element = await open();
  assert.equal(element.props.receipt.id, ids.receiptId);
  assert.deepEqual(idCalls, [ids.receiptId]);
  assert.equal(calls.length, 0);
});

test("IDs ausentes ou inválidos falham sem busca e sem fallback", async () => {
  const { open, calls } = await harness();
  await assert.rejects(open({ businessUnitId: ids.businessUnitId }), /NOT_FOUND/);
  await assert.rejects(open({ ...ids, businessUnitId: "outra-unidade" }), /NOT_FOUND/);
  assert.equal(calls.length, 0);
});

test("recibo inexistente ou vínculo incompatível é rejeitado", async () => {
  const { open, idCalls } = await harness(true, false);
  await assert.rejects(open(), /NOT_FOUND/);
  assert.equal(idCalls.length, 1);
});
