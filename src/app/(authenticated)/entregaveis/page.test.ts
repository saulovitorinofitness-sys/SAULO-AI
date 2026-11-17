import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import type { DocumentIndexFilters, DocumentIndexItem, DocumentIndexPage } from "@/features/deliverables/document-index-repository";

type Element = { type: string; props: Record<string, unknown> };

const now = new Date("2026-09-12T12:00:00.000Z");
const item: DocumentIndexItem = {
  id: "entry-1",
  patientId: "patient-1",
  patientName: "Paciente Teste",
  patientCode: "SV-01",
  masterRecordId: "master-1",
  attendanceId: "attendance-1",
  attendanceDate: now,
  consultationType: "POSTURAL_ASSESSMENT",
  type: "postural",
  status: "postural-completed",
  version: 3,
  versionId: "version-1",
  professionalName: "Profissional da versão",
  updatedAt: now,
};

function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!node || typeof node !== "object" || !("type" in node)) return [];
  const element = node as Element;
  return [element, ...walk(element.props.children)];
}

async function harness(input: {
  permissions?: readonly string[];
  result?: Partial<DocumentIndexPage>;
} = {}) {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const calls: DocumentIndexFilters[] = [];
  let writes = 0;
  const permissions = input.permissions ?? ["MASTER_RECORD", "MEAL_PLAN", "POSTURAL_ASSESSMENT", "WORKOUT_PLAN"];
  const pageResult: DocumentIndexPage = {
    items: [item], page: 1, pageSize: 20, total: 1, totalPages: 1,
    ...input.result,
  };
  const testModule = { exports: {} as { default: (props: { searchParams: Promise<Record<string, string>> }) => Promise<unknown> } };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    Date,
    URLSearchParams,
    Intl,
    require(id: string) {
      if (id === "react/jsx-runtime") {
        const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
        return { jsx, jsxs: jsx };
      }
      if (id === "next/link") return "Link";
      if (id === "@/components/ui/page-heading") return { PageHeading: "PageHeading" };
      if (id === "@/components/ui/page-state") return { PageState: "PageState" };
      if (id === "@/features/deliverables/document-index-repository") {
        return { documentIndexRepository: { list: async (filters: DocumentIndexFilters) => {
          calls.push(filters);
          return pageResult;
        } } };
      }
      if (id === "@/features/mvp") {
        return {
          mvpService: { getSession: async () => ({ user: { id: "user-1" } }) },
          canAccess: (_access: unknown, key: string, action: string) => action === "READ" && permissions.includes(key),
        };
      }
      throw new Error(`Unexpected import: ${id}`);
    },
    write: () => { writes++; throw new Error("Unexpected write"); },
  });
  return {
    render: (query: Record<string, string> = {}) => testModule.exports.default({ searchParams: Promise.resolve(query) }),
    calls,
    get writes() { return writes; },
  };
}

test("abrir e atualizar a Central são somente leitura e usam o link oficial contextual", async () => {
  const page = await harness();
  const first = walk(await page.render());
  const second = walk(await page.render());
  const expectedHref = "/clinica/plano-alimentar/entregavel?patientId=patient-1&attendanceId=attendance-1&view=postural&source=global-deliverables&masterRecordId=master-1&entryId=entry-1&versionId=version-1";
  const expectedPrintHref = "/clinica/plano-alimentar/entregavel/imprimir?patientId=patient-1&attendanceId=attendance-1&documentType=postural&intent=PRINT&masterRecordId=master-1&entryId=entry-1&versionId=version-1";
  const expectedPdfHref = expectedPrintHref.replace("intent=PRINT", "intent=SAVE_PDF");
  assert.equal(first.find((element) => element.type === "Link" && element.props.href === expectedHref)?.props.children, "Visualizar");
  assert.equal(first.find((element) => element.type === "Link" && element.props.href === expectedPrintHref)?.props.children, "Imprimir");
  assert.equal(first.find((element) => element.type === "Link" && element.props.href === expectedPdfHref)?.props.children, "Salvar em PDF");
  assert.ok(second.some((element) => element.type === "Link" && element.props.href === expectedHref));
  assert.ok(second.some((element) => element.type === "Link" && element.props.href === expectedPrintHref));
  assert.equal(page.calls.length, 2);
  assert.equal(page.writes, 0);
  assert.ok(first.some((element) => element.type === "form" && element.props.method === "get" && element.props.action === "/entregaveis"));
});

test("links de Performance e Plano Alimentar usam a versão oficial selecionada", async () => {
  const performance: DocumentIndexItem = {
    ...item, id: "workout-1", type: "performance", status: "performance-finalized",
    versionId: "official-1",
  };
  const nutrition: DocumentIndexItem = {
    ...item, id: "meal-1", type: "nutrition", status: "nutrition-ready",
    version: 4, versionId: "meal-version-4",
  };
  const page = await harness({ result: { items: [performance, nutrition], total: 2 } });
  const links = walk(await page.render()).filter((element) => element.type === "Link");
  const performanceHref = String(links.find((element) => String(element.props.href).includes("view=performance"))?.props.href);
  const nutritionHref = String(links.find((element) => String(element.props.href).includes("view=meal-plan"))?.props.href);
  const completeNutritionHref = String(links.find((element) =>
    element.props.children === "Visualizar entregável completo",
  )?.props.href);
  assert.ok(performanceHref.includes("entryId=workout-1&versionId=official-1"));
  assert.ok(completeNutritionHref.includes("attendanceId=attendance-1"));
  assert.ok(completeNutritionHref.includes("view=nutrition"));
  assert.ok(completeNutritionHref.includes("source=global-deliverables"));
  assert.ok(!completeNutritionHref.includes("entryId="));
  assert.ok(nutritionHref.includes("attendanceId=attendance-1"));
  assert.ok(nutritionHref.includes("entryId=meal-1"));
  assert.ok(nutritionHref.includes("versionId=meal-version-4"));
  assert.ok(links.some((element) => element.props.children === "Imprimir plano"));
  assert.ok(links.some((element) => element.props.children === "Salvar plano em PDF"));
  assert.equal(page.writes, 0);
});

test("Relatório Nutricional oficial abre o documento persistido selecionado", async () => {
  const nutrition: DocumentIndexItem = {
    ...item,
    id: "document-1",
    documentId: "document-1",
    type: "nutrition",
    status: "nutrition-approved",
    version: 2,
    versionId: undefined,
  };
  const page = await harness({ result: { items: [nutrition] } });
  const tree = walk(await page.render());
  const link = tree.find((element) =>
    element.type === "Link" &&
    String(element.props.href).includes("view=nutrition"),
  );
  assert.ok(String(link?.props.href).includes("deliverableId=document-1"));
  assert.equal(link?.props.children, "Visualizar");
  assert.ok(tree.some((element) =>
    element.type === "dt" &&
    element.props.children === "Versão do documento: ",
  ));
  assert.equal(page.writes, 0);
});

test("Atendimento mostra tipo, data e hora sem expor UUID no cartão", async () => {
  const page = await harness();
  const tree = walk(await page.render());
  const details = tree
    .filter((element) => element.type === "dd")
    .map((element) => element.props.children);

  assert.ok(details.some((value) =>
    typeof value === "string" &&
    value.includes("Avaliação postural") &&
    value.includes("12/09/2026") &&
    value.includes("09:00"),
  ));
  assert.ok(!details.some((value) => String(value).includes(item.attendanceId)));
  assert.ok(tree.some((element) => element.type === "Link" &&
    String(element.props.href).includes(`attendanceId=${item.attendanceId}`)));
});

test("sem tipo de consulta, Atendimento mostra somente data e hora", async () => {
  const page = await harness({ result: { items: [{ ...item, consultationType: undefined }] } });
  const tree = walk(await page.render());
  const details = tree
    .filter((element) => element.type === "dd")
    .map((element) => element.props.children);

  assert.ok(details.some((value) =>
    typeof value === "string" &&
    value.includes("12/09/2026") &&
    value.includes("09:00") &&
    !value.includes("Avaliação postural") &&
    !value.includes("attendance-1"),
  ));
});

test("dois atendimentos da mesma paciente mantêm cartões e links distintos", async () => {
  const second = {
    ...item,
    id: "entry-2",
    attendanceId: "attendance-2",
    attendanceDate: new Date("2026-09-13T14:30:00.000Z"),
  } satisfies DocumentIndexItem;
  const page = await harness({
    result: { items: [item, second], total: 2 },
  });
  const tree = walk(await page.render());
  const links = tree.filter((element) => element.type === "Link");
  const details = tree
    .filter((element) => element.type === "dd")
    .map((element) => element.props.children);

  assert.equal(tree.filter((element) => element.type === "li").length, 2);
  assert.ok(links.some((element) => String(element.props.href).includes("attendanceId=attendance-1")));
  assert.ok(links.some((element) => String(element.props.href).includes("attendanceId=attendance-2")));
  assert.ok(details.some((value) => String(value).includes("12/09/2026") && String(value).includes("09:00")));
  assert.ok(details.some((value) => String(value).includes("13/09/2026") && String(value).includes("11:30")));
  assert.equal(page.writes, 0);
});

test("permissões de prontuário e de cada tipo são aplicadas no servidor", async () => {
  const denied = await harness({ permissions: ["POSTURAL_ASSESSMENT"] });
  const deniedTree = walk(await denied.render());
  assert.equal(deniedTree[0].type, "PageState");
  assert.equal(denied.calls.length, 0);

  const posturalOnly = await harness({ permissions: ["MASTER_RECORD", "POSTURAL_ASSESSMENT"] });
  const tree = walk(await posturalOnly.render());
  assert.deepEqual(Array.from(posturalOnly.calls[0].allowedTypes), ["postural"]);
  assert.ok(!tree.some((element) => element.type === "option" && element.props.value === "nutrition"));
  assert.equal(posturalOnly.writes, 0);
});

test("filtros e paginação usam apenas GET e preservam a pesquisa", async () => {
  const page = await harness({ result: { total: 41, totalPages: 3, page: 2 } });
  const tree = walk(await page.render({
    patient: "SV-01", type: "postural", status: "postural-completed",
    from: "2026-09-01", to: "2026-09-30", page: "2",
  }));
  assert.equal(page.calls[0].patient, "SV-01");
  assert.equal(page.calls[0].type, "postural");
  assert.equal(page.calls[0].status, "postural-completed");
  assert.equal(page.calls[0].page, 2);
  assert.equal(page.calls[0].from?.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(page.calls[0].toExclusive?.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.ok(tree.some((element) => element.type === "Link" && String(element.props.href).includes("patient=SV-01") && String(element.props.href).includes("page=3")));
  assert.equal(page.writes, 0);
});

test("ausência de documentos não cria registros nem mostra links de visualização", async () => {
  const page = await harness({ result: { items: [], total: 0, totalPages: 0 } });
  const tree = walk(await page.render());
  assert.ok(tree.some((element) => element.type === "PageState" && element.props.title === "Nenhum entregável encontrado"));
  assert.ok(!tree.some((element) => element.type === "Link" && String(element.props.href).includes("/clinica/plano-alimentar/entregavel")));
  assert.equal(page.writes, 0);
});
