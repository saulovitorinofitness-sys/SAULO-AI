import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";

import ts from "typescript";

import { employmentTypeLabel, salaryLineDescription } from "../../features/financial/payroll/salary-document-presentation";

type Element = { type: unknown; props: Record<string, unknown> };

function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!node || typeof node !== "object" || !("type" in node)) return [];
  const element = node as Element;
  if (typeof element.type === "function") return walk(element.type(element.props));
  return [element, ...walk(element.props.children)];
}

async function render(override: Record<string, unknown> = {}) {
  const source = await readFile(new URL("./payroll-receipt-document.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let prints = 0;
  const testModule = { exports: {} as { PayrollReceiptDocument: (props: { receipt: Record<string, unknown> }) => unknown } };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  runInNewContext(compiled, { module: testModule, exports: testModule.exports, Intl, Number, crypto: { randomUUID }, window: { print: () => { prints++; } }, require(id: string) {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (id === "react") return {
      useEffect: (effect: () => void | (() => void)) => effect(),
      useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
    };
    if (id === "next/link") return { default: "Link" };
    if (id === "@/features/financial/payroll/salary-document-presentation") return { employmentTypeLabel, salaryLineDescription };
    throw new Error(id);
  } });
  const receipt = {
    id: "receipt-1",
    documentKind: "DEMONSTRATIVE",
    documentState: "DEMONSTRATIVE_AVAILABLE",
    documentNumber: "DEM-202609-01",
    version: 3,
    businessUnitName: "Academia Saulo Fitness",
    employeeName: "Funcionária A",
    employmentCode: "MAT-1",
    employmentType: "EMPLOYEE",
    jobRole: "Cargo",
    competence: new Date("2026-09-01T00:00:00Z"),
    issuedAt: new Date("2026-09-10T12:00:00Z"),
    issuerName: "Saulo Xavier Vitorino",
    lineItems: [
      { code: "SALARY", description: "SALARY", type: "EARNING", amount: "100.00" },
      { code: "DEDUCTION", description: "Desconto previdenciário", type: "DEDUCTION", amount: "10.00" },
    ],
    totals: { gross: "100.00", benefits: "0.00", deductions: "10.00", adjustments: "0.00", net: "90.00" },
    ...override,
  };
  return { tree: walk(testModule.exports.PayrollReceiptDocument({ receipt })), prints: () => prints };
}

function renderedText(tree: Element[]) { return JSON.stringify(tree); }

test("demonstrativo usa pagadora, descrições profissionais e não alega recebimento", async () => {
  const { tree } = await render();
  const text = renderedText(tree);
  assert.match(text, /Academia Saulo Fitness/);
  assert.match(text, /Identificação legal incompleta no cadastro da unidade/);
  assert.match(text, /Salário base/);
  assert.match(text, /Este documento é apenas um demonstrativo salarial e não comprova o recebimento ou a quitação do pagamento/);
  assert.match(text, /Líquido demonstrado/);
  assert.doesNotMatch(text, /Saulo Xavier Vitorino|Emissor registrado|Declaro ter recebido|Assinatura do funcionário/);
  assert.doesNotMatch(text, />SALARY<|>EARNING<|>DEDUCTION</);
});

test("demonstrativo legado permanece informativo e sem declaração ou assinatura", async () => {
  const { tree } = await render({ documentKind: "LEGACY_DEMONSTRATIVE", documentState: "LEGACY_UNCONFIRMED", documentNumber: "PAG-01" });
  const text = renderedText(tree);
  assert.match(text, /Demonstrativo salarial legado/);
  assert.match(text, /Demonstrativo legado · pagamento não confirmado/);
  assert.match(text, /não comprova o recebimento ou a quitação/);
  assert.doesNotMatch(text, /Declaração de recebimento|Assinatura do funcionário/);
});

test("recibo bancário confirmado usa snapshot do pagador, declaração, comprovante e assinatura complementar", async () => {
  const { tree } = await render({
    documentKind: "SALARY_RECEIPT",
    documentState: "BANK_PROVEN",
    documentNumber: "REC-202609-abc",
    employer: { unitName: "Academia Saulo Fitness", legalName: "Academia Saulo Fitness Ltda.", tradeName: "Academia Saulo Fitness", legalTaxIdType: "CNPJ", maskedLegalTaxId: "**.***.***/****-12", address: "Rua A, 1" },
    employee: { fullName: "Funcionária A", maskedCpf: "***.***.***-34", maskedIdentityDocument: "••••1234", maskedSocialSecurityNumber: "••••5678", employmentCode: "MAT-1", employmentType: "EMPLOYEE", jobRole: "Cargo" },
    payment: { paidAt: "2026-09-10", method: "PIX", amount: "90.00", bankReference: "E2E-123456", proofUrl: "/api/gestao/folha-pagamento/recibos-salariais/r/comprovantes/e" },
  });
  const text = renderedText(tree);
  assert.match(text, /Recibo de pagamento salarial|Pagamento comprovado/);
  assert.match(text, /Empregador \/ pagador|Academia Saulo Fitness Ltda/);
  assert.match(text, /Declaro ter recebido de/);
  assert.match(text, /Comprovante bancário disponível/);
  assert.match(text, /Assinatura do funcionário|Assinatura não registrada/);
  assert.match(text, /Nome|CPF|Local e data|Situação/);
  assert.match(text, /RG|PIS\/NIS|Este módulo não substitui obrigações trabalhistas ou contábeis/);
  assert.doesNotMatch(text, /Saulo Xavier Vitorino|Emissor registrado|Unidade responsável|Nome fantasia/);
  assert.doesNotMatch(text, /dados persistidos e congelados|Alterações posteriores não modificam/);
});

test("recibo em dinheiro reserva assinatura ampla e explicita obrigatoriedade manual", async () => {
  const { tree } = await render({
    documentKind: "SALARY_RECEIPT",
    documentState: "CASH_AWAITING_SIGNATURE",
    employer: { unitName: "Academia Saulo Fitness", legalName: "Academia Saulo Fitness Ltda.", tradeName: null, legalTaxIdType: "CNPJ", maskedLegalTaxId: "**.***.***/****-12", address: "Rua A, 1" },
    employee: { fullName: "Funcionária A", maskedCpf: "***.***.***-34", maskedIdentityDocument: null, maskedSocialSecurityNumber: null, employmentCode: "MAT-1", employmentType: "EMPLOYEE", jobRole: "Cargo" },
    payment: { paidAt: "2026-09-10", method: "CASH", amount: "90.00", bankReference: null, proofUrl: null },
  });
  const text = renderedText(tree);
  assert.match(text, /Aguardando assinatura manual/);
  assert.match(text, /assinatura manual obrigatória/);
  assert.doesNotMatch(text, /Comprovante bancário|Não se aplica/);
  assert.ok(tree.some((element) => element.type === "div" && String(element.props.className).includes("signature-space")));
});

test("recibo continua imprimivel sem CPF, RG, PIS/NIS ou dados bancarios do funcionario", async () => {
  const { tree, prints } = await render({
    documentKind: "SALARY_RECEIPT",
    documentState: "CASH_AWAITING_SIGNATURE",
    employer: { unitName: "Academia Saulo Fitness", legalName: "Academia Saulo Fitness Ltda.", tradeName: null, legalTaxIdType: "CNPJ", maskedLegalTaxId: "**.***.***/****-12", address: "Rua A, 1" },
    employee: { fullName: "Funcionária sem documentos", maskedCpf: null, maskedIdentityDocument: null, maskedSocialSecurityNumber: null, employmentCode: "MAT-SEM-DOC", employmentType: "EMPLOYEE", jobRole: "Cargo" },
    payment: { paidAt: "2026-09-10", method: "CASH", amount: "90.00", bankReference: null, proofUrl: null },
  });
  const text = renderedText(tree);
  assert.match(text, /Funcionária sem documentos|MAT-SEM-DOC|Cargo/);
  assert.ok((text.match(/Não informado/g) ?? []).length >= 4);
  const button = tree.find((element) => element.type === "button" && element.props.children === "Imprimir");
  (button?.props.onClick as () => void)();
  assert.equal(prints(), 1);
});

test("recibo cancelado mantém histórico, marca de cancelamento e impressão do documento histórico", async () => {
  const { tree, prints } = await render({
    documentKind: "SALARY_RECEIPT", documentState: "VOIDED", documentNumber: "SAL-TESTE",
    employer: { unitName: "academia saulo fitness", legalName: "academia saulo fitness ltda.", tradeName: null, legalTaxIdType: "CNPJ", maskedLegalTaxId: "**.***.***/****-12", address: "rua aeroporto, 1 · juazeiro do norte/CE" },
    employee: { fullName: "aniethy ribeiro oliveira", maskedCpf: null, maskedIdentityDocument: null, maskedSocialSecurityNumber: null, employmentCode: "MAT-1", employmentType: "EMPLOYEE", jobRole: "recepcionista" },
    payment: { paidAt: "2026-09-30", method: "CASH", amount: "810.00", bankReference: null, proofUrl: null },
    voiding: { reason: "Pagamento criado somente para teste", at: new Date("2026-09-25T22:00:00Z"), by: "Saulo Xavier Vitorino" },
  });
  const text = renderedText(tree);
  assert.match(text, /CANCELADO · SEM VALIDADE|RECIBO CANCELADO — SEM VALIDADE/);
  assert.match(text, /Pagamento criado somente para teste/);
  assert.match(text, /Aniethy Ribeiro Oliveira|Juazeiro do Norte\/CE|Rua Aeroporto/);
  const printButton = tree.find((element) => element.type === "button" && element.props.children === "Imprimir");
  const pdfButton = tree.find((element) => element.type === "button" && element.props.children === "Salvar em PDF");
  assert.ok(printButton);
  assert.ok(pdfButton);
  (printButton?.props.onClick as () => void)();
  assert.equal(prints(), 1);
});

test("botão imprime pelo navegador e controles administrativos somem na impressão", async () => {
  const { tree, prints } = await render();
  const button = tree.find((element) => element.type === "button" && element.props.children === "Imprimir");
  assert.equal(button?.props.children, "Imprimir");
  (button?.props.onClick as () => void)();
  assert.equal(prints(), 1);
  assert.ok(tree.some((element) => element.type === "Link" && element.props.href === "/gestao/documentos"));
  const css = tree.find((element) => element.type === "style")?.props.children;
  assert.match(String(css), /@media print/);
  assert.match(String(css), /body:has\(#management-payroll-receipt\) header/);
  assert.match(String(css), /body:has\(#management-payroll-receipt\) aside/);
  assert.match(String(css), /body:has\(#management-payroll-receipt\) nav/);
  assert.match(String(css), /body:has\(#management-payroll-receipt\) button/);
  assert.match(String(css), /body:has\(#management-payroll-receipt\) \.receipt-controls/);
  assert.match(String(css), /font-size: 9\.5pt/);
  assert.match(String(css), /break-inside: avoid !important/);
  assert.match(String(css), /@page \{ size: A4 portrait; margin: 9mm/);
});
