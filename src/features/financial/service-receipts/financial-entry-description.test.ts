import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildProfessionalServiceFinancialEntryDescription } from "./financial-entry-description";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("monta descrição futura com serviço, cliente e prestador reais", () => {
  assert.equal(buildProfessionalServiceFinancialEntryDescription({
    serviceDescriptions: ["Personal training"],
    customerName: "marcelo da silva",
    providerName: "Maria de Lourdes Gomes",
  }), "Personal training — Marcelo da Silva — Maria de Lourdes Gomes");
});

test("preserva descrições distintas e elimina repetições vazias", () => {
  assert.equal(buildProfessionalServiceFinancialEntryDescription({
    serviceDescriptions: ["Avaliação postural", "", "Avaliação postural", "Plano de corrida"],
    customerName: "ANA DE SOUZA",
    providerName: "saulo xavier vitorino",
  }), "Avaliação postural + Plano de corrida — Ana de Souza — Saulo Xavier Vitorino");
});

test("usa fallbacks seguros sem inventar nomes ou serviços", () => {
  assert.equal(buildProfessionalServiceFinancialEntryDescription({
    serviceDescriptions: [null, "  "],
    customerName: null,
    providerName: "",
  }), "Serviço profissional — Cliente não identificado — Prestador não identificado");
});

test("integra a descrição sem alterar transação, idempotência ou unidade financeira", () => {
  const payment = repository.slice(repository.indexOf("async recordPayment"), repository.indexOf("async issueReceipt"));
  assert.match(payment, /buildProfessionalServiceFinancialEntryDescription/u);
  assert.doesNotMatch(payment, /Recebimento de servico profissional/u);
  assert.match(payment, /prisma\.\$transaction/u);
  assert.match(payment, /pg_advisory_xact_lock/u);
  assert.match(payment, /where: \{ idempotencyKey: input\.idempotencyKey \}/u);
  assert.match(payment, /businessUnit\.findUnique\(\{ where: \{ code: "PERSONAL" \} \}\)/u);
  assert.match(payment, /input\.charge\.provider\.key === "ACADEMIA_SAULO_FITNESS"/u);
});
