import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILT_IN_IDS } from "@/modules/permissions";

import type {
  ProfessionalReceiptListFilters,
  ProfessionalReceiptListPage,
  ProfessionalServiceReceiptRepository,
} from "./repository";
import {
  createProfessionalServiceReceiptService,
  ProfessionalServiceReceiptServiceError,
} from "./service";

const page: ProfessionalReceiptListPage = {
  items: [{
    id: "00000000-0000-4000-8000-000000000401",
    receiptId: "00000000-0000-4000-8000-000000000501",
    customerName: "Cliente real",
    customerCode: "SV000001",
    providerKey: "SAULO_XAVIER_VITORINO",
    status: "PARTIALLY_PAID",
    amount: "100.00",
    receivedAmount: "40.00",
    createdAt: new Date("2026-09-22T12:00:00.000Z"),
    series: "SV",
    sequence: 1,
    paymentCount: 1,
  }],
  page: 2,
  pageSize: 10,
  total: 24,
  totalPages: 3,
  indicators: { receivedAmount: "40.00", pending: 2, partial: 1, cancelled: 3, refunded: 4 },
};

function listingService() {
  const calls: ProfessionalReceiptListFilters[] = [];
  const repository = {
    async listReceipts(filters: ProfessionalReceiptListFilters) {
      calls.push(filters);
      return page;
    },
  } as unknown as ProfessionalServiceReceiptRepository;
  return { calls, service: createProfessionalServiceReceiptService(repository) };
}

test("Saulo lista todos os recibos com filtros e paginação normalizados", async () => {
  const { calls, service } = listingService();
  const result = await service.listReceipts({
    query: "  Cliente real  ",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    providerKey: "SAULO_XAVIER_VITORINO",
    status: "PARTIALLY_PAID",
    page: 2,
    pageSize: 10,
    actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
  });
  assert.equal(result.total, 24);
  assert.equal(calls[0]?.visibility, "ALL");
  assert.equal(calls[0]?.query, "Cliente real");
  assert.equal(calls[0]?.page, 2);
  assert.equal(calls[0]?.pageSize, 10);
  assert.equal(calls[0]?.periodEndExclusive?.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(result.items[0]?.managementAction, null);
});

test("Maria recebe escopo restrito à Educação Física acessível", async () => {
  const { calls, service } = listingService();
  await service.listReceipts({ actorUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes });
  assert.equal(calls[0]?.visibility, "MARIA_PHYSICAL_EDUCATION");
});

test("outro usuário não consulta e não alcança o repository", async () => {
  const { calls, service } = listingService();
  await assert.rejects(
    service.listReceipts({ actorUserId: "00000000-0000-4000-8000-000000000099" }),
    (error: unknown) => error instanceof ProfessionalServiceReceiptServiceError && error.code === "NOT_AUTHORIZED",
  );
  assert.equal(calls.length, 0);
});

test("paginação e período inválidos são rejeitados antes da consulta", async () => {
  const { calls, service } = listingService();
  await assert.rejects(
    service.listReceipts({ actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino, pageSize: 101 }),
    (error: unknown) => error instanceof ProfessionalServiceReceiptServiceError && error.code === "INVALID_INPUT",
  );
  await assert.rejects(
    service.listReceipts({ actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino, periodStart: "2026-10-01", periodEnd: "2026-09-01" }),
    (error: unknown) => error instanceof ProfessionalServiceReceiptServiceError && error.code === "INVALID_INPUT",
  );
  assert.equal(calls.length, 0);
});

test("listagem contém indicadores sem CPF ou comprovante privado", async () => {
  const { service } = listingService();
  const result = await service.listReceipts({ actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino });
  const serialized = JSON.stringify(result);
  assert.deepEqual(result.indicators, { receivedAmount: "40.00", pending: 2, partial: 1, cancelled: 3, refunded: 4 });
  assert.doesNotMatch(serialized, /cpf|proof|comprovante|bytes|storageKey/iu);
});

test("consulta persistente aplica busca, paginação e escopo de Maria sem selecionar dados privados", () => {
  const source = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
  const listQuery = source.slice(source.indexOf("function receiptListBase"), source.indexOf("export const professionalServiceReceiptRepository"));
  assert.match(listQuery, /patient\."fullName" ILIKE/u);
  assert.match(listQuery, /MARIA_PHYSICAL_EDUCATION/u);
  assert.match(listQuery, /NUTRITION_CONSULTATION/u);
  assert.match(listQuery, /physical_registration\."council" = 'CREF'/u);
  assert.match(listQuery, /ProfessionalServiceProviderType/u);
  assert.doesNotMatch(listQuery, /ProfessionalServiceLegalProviderType/u);
  assert.doesNotMatch(listQuery, /customerCpf|payloadCiphertext|ProfessionalServicePaymentProof/u);
  assert.match(source, /LIMIT \$\{filters\.pageSize\} OFFSET \$\{offset\}/u);
  assert.match(listQuery, /charge\."status" = 'CANCELLED'[\s\S]*THEN 0/u);
});
