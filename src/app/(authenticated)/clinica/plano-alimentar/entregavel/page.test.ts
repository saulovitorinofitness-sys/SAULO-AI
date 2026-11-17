import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

type Element = { type: string; props: Record<string, unknown> };
const ids = {
  masterRecordId: "11111111-1111-4111-8111-111111111111",
  entryId: "22222222-2222-4222-8222-222222222222",
  versionId: "33333333-3333-4333-8333-333333333333",
};

function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!node || typeof node !== "object" || !("type" in node)) return [];
  const element = node as Element;
  return [element, ...walk(element.props.children)];
}

async function render(
  source?: string,
  view: "central" | "nutrition" | "meal-plan" | "postural" | "performance" = "postural",
  options: { query?: Record<string, string | undefined>; rejectSelected?: boolean } = {},
) {
  const code = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const identityCalls: string[] = [];
  const selectedCalls: Record<string, unknown>[] = [];
  const testModule = { exports: {} as {
    default: (props: { searchParams: Promise<Record<string, string | undefined>> }) => Promise<unknown>;
  } };
  const history = [{
    assessmentId: "assessment-1",
    masterRecordId: ids.masterRecordId,
    attendanceId: "attendance-1",
    assessedAt: "2026-09-01T12:00:00.000Z",
    status: "FINALIZED",
    data: { completionStatus: "COMPLETED" },
    audit: { professionalUserId: "author-1", professionalName: "Profissional Registrado" },
  }];
  const selected = {
    ...history[0], assessmentId: ids.entryId,
    masterRecordId: ids.masterRecordId, patientId: "patient-1",
    assessedAt: "2026-09-10T12:00:00.000Z",
    data: { completionStatus: "COMPLETED", notes: "Snapshot selecionado" },
    audit: { professionalUserId: "author-selected", professionalName: "Autor da versão", version: 3 },
  };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    URLSearchParams,
    require(id: string) {
      if (id === "react/jsx-runtime") {
        const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
        return { jsx, jsxs: jsx };
      }
      if (id === "next/navigation") return { notFound: () => { throw new Error("Unexpected notFound"); } };
      if (id === "@/components/deliverables/nutrition-deliverable-preview") return { NutritionDeliverablePreview: "NutritionDeliverablePreview" };
      if (id === "@/components/deliverables/performance-deliverable-preview") return { PerformanceDeliverablePreview: "PerformanceDeliverablePreview" };
      if (id === "@/components/deliverables/postural-deliverable-preview") return { PosturalDeliverablePreview: "PosturalDeliverablePreview" };
      if (id === "@/components/nutrition-clinical-flow/clinical-flow-navigation") return { ClinicalFlowNavigation: "ClinicalFlowNavigation" };
      if (id === "@/components/ui") return { Badge: "Badge", Button: "Button", ButtonLink: "ButtonLink", Card: "Card", PageState: "PageState" };
      if (id === "@/features/clinical-collection") return { CLINICAL_COLLECTION_SCENARIO_KEYS: ["complete", "partial"] };
      if (id === "@/features/clinical-collection/repository") {
        return { clinicalCollectionRepository: {
          findAttendanceIds: async () => ["attendance-1"],
          getPosturalEvolution: async () => ({ history, comparisons: [] }),
          getOfficialPosturalAssessment: async (input: Record<string, unknown>) => {
            selectedCalls.push(input);
            return options.rejectSelected ? null : selected;
          },
          getCollection: async () => ({
            attendanceId: "attendance-1", patientName: "Paciente Teste",
            patientCode: "SV-01", patientAge: 30,
          }),
        } };
      }
      if (id === "@/features/clinical-collection/postural-history") return {
        buildPosturalEvolutionTimeline: (sources: unknown[]) => sources,
      };
      if (id === "@/features/mvp") return {
        mvpService: { getSession: async () => ({ user: { id: "viewer-1" } }) },
        canAccess: () => true,
      };
      if (id === "@/features/nutrition-deliverables/service") return {
        nutritionDeliverableService: {
          createDraft: async () => ({ patientId: "patient-1", attendanceId: "attendance-1" }),
          getFinalizedPlanSource: async () => ({
            entryId: ids.entryId,
            versionId: ids.versionId,
            version: 4,
          }),
        },
      };
      if (id === "@/features/nutrition-deliverables/persistence") return {
        nutritionDeliverablePersistence: {
          getOfficial: async () => options.rejectSelected ? null : ({
            id: ids.versionId,
            version: 2,
            snapshot: { patientId: "patient-1", attendanceId: "attendance-1", status: "APPROVED" },
          }),
          listOfficial: async () => [],
        },
      };
      if (id === "@/features/nutrition-clinical-flow") return { nutritionClinicalFlowHref: () => "/unused" };
      if (id === "@/features/nutrition-clinical-flow/repository") {
        return { nutritionClinicalFlowRepository: { getFlow: async () => ({
          flow: [
            { id: "NUTRITION_STRATEGY", status: "COMPLETED" },
            { id: "MEAL_PLAN", status: "COMPLETED" },
            { id: "POSTURAL_ASSESSMENT", status: "COMPLETED" },
            { id: "PERFORMANCE", status: "COMPLETED" },
          ],
        }) } };
      }
      if (id === "@/features/nutrition-strategy/clinical-panel-repository") return { nutritionClinicalPanelRepository: { get: async () => ({ attendanceId: "attendance-1" }) } };
      if (id === "@/features/nutrition-strategy") return { nutritionStrategyService: { canAccess: () => true } };
      if (id === "@/features/performance-endurance/workout-repository") return { getLatestOfficialWorkoutPlan: async (input: Record<string, unknown>) => {
        selectedCalls.push(input);
        return options.rejectSelected ? null : {
          entryId: input.entryId ?? "workout-1", attendanceId: "attendance-1",
          responsibleProfessionalId: "author-workout", responsibleProfessional: "Profissional do plano",
          version: 4, draft: { status: "FINALIZED" },
        };
      } };
      if (id === "@/features/professional-responsibility/document-identity") {
        return { physicalDocumentProfessionalIdentity: async (userId: string, fullName: string) => {
          identityCalls.push(userId);
          return { userId, fullName, registrations: [] };
        } };
      }
      if (id === "@/lib/database/prisma") return { prisma: {
        masterRecordEntry: { findFirst: async () => ({
          id: "workout-1",
          masterRecordId: ids.masterRecordId,
          attendanceId: "attendance-1",
          status: "FINALIZED",
        }) },
        recordVersion: { findFirst: async (input: { where: { entityType: string } }) => ({
          id: input.where.entityType === "WORKOUT_PLAN" ? ids.versionId : "44444444-4444-4444-8444-444444444444",
          version: input.where.entityType === "WORKOUT_PLAN" ? 4 : 2,
        }) },
      } };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  const tree = walk(await testModule.exports.default({
    searchParams: Promise.resolve({
      patientId: "patient-1", attendanceId: "attendance-1",
      view, ...(source ? { source } : {}),
      ...(source === "global-deliverables" && view !== "nutrition" ? ids : {}),
      ...options.query,
    }),
  }));
  return { tree, identityCalls, selectedCalls };
}

test("origem global mostra o snapshot postural indicado e sua autoria", async () => {
  const { tree, identityCalls, selectedCalls } = await render("global-deliverables");
  assert.ok(!tree.some((element) => element.type === "ClinicalFlowNavigation"));
  assert.ok(tree.some((element) => String(element.props.className).includes("global-deliverable-view") && String(element.props.className).includes("max-w-[76rem]")));
  assert.ok(tree.some((element) => element.type === "style" && String(element.props.children).includes("@media screen")));
  assert.ok(tree.some((element) => element.type === "ButtonLink" && element.props.href === "/entregaveis"));
  const preview = tree.find((element) => element.type === "PosturalDeliverablePreview");
  assert.equal((preview?.props.professional as { userId: string }).userId, "author-selected");
  assert.equal((preview?.props.history as { data: { notes?: string } }[]).at(-1)?.data.notes, "Snapshot selecionado");
  assert.equal(selectedCalls[0].versionId, ids.versionId);
  assert.deepEqual(identityCalls, ["author-selected"]);
});

test("acesso contextual preserva a navegação de etapas", async () => {
  const { tree, selectedCalls } = await render();
  assert.ok(tree.some((element) => element.type === "ClinicalFlowNavigation"));
  assert.ok(!tree.some((element) => String(element.props.className).includes("global-deliverable-view")));
  assert.ok(!tree.some((element) => element.type === "ButtonLink" && element.props.href === "/entregaveis"));
  assert.equal(selectedCalls.length, 0);
});

test("URL de preparação continua abrindo o entregável completo", async () => {
  const { tree, selectedCalls } = await render(undefined, "nutrition", {
    query: { prepare: "nutrition-report" },
  });
  assert.ok(tree.some((element) => element.type === "ClinicalFlowNavigation"));
  assert.ok(tree.some((element) => element.type === "NutritionDeliverablePreview"));
  assert.equal(selectedCalls.length, 0);
});

test("URL antiga de Nutrição abre diretamente a prévia completa", async () => {
  const { tree } = await render(undefined, "nutrition");
  assert.ok(tree.some((element) => element.type === "ClinicalFlowNavigation"));
  const preview = tree.find((element) =>
    element.type === "NutritionDeliverablePreview",
  );
  assert.ok(preview);
  assert.equal(preview.props.documentType, undefined);
  assert.equal(
    (preview.props.initialDraft as { attendanceId: string }).attendanceId,
    "attendance-1",
  );
});

test("Central prioriza o entregável completo e mantém o plano isolado adicional", async () => {
  const { tree } = await render(undefined, "central");
  const links = tree.filter((element) => element.type === "ButtonLink");
  assert.ok(links.some((element) =>
    element.props.children === "Visualizar entregável completo" &&
    String(element.props.href).includes("view=nutrition")
  ));
  assert.ok(links.some((element) =>
    element.props.children === "Visualizar" &&
    String(element.props.href).includes("view=meal-plan") &&
    String(element.props.href).includes(`entryId=${ids.entryId}`) &&
    String(element.props.href).includes(`versionId=${ids.versionId}`)
  ));
  assert.ok(links.some((element) =>
    element.props.children === "Imprimir" &&
    String(element.props.href).includes("documentType=meal-plan") &&
    String(element.props.href).includes("intent=PRINT")
  ));
  assert.ok(links.some((element) =>
    element.props.children === "Salvar em PDF" &&
    String(element.props.href).includes("documentType=meal-plan") &&
    String(element.props.href).includes("intent=SAVE_PDF")
  ));
});

test("Nutrição oficial reabre o snapshot persistido e a versão selecionada", async () => {
  const { tree } = await render("global-deliverables", "nutrition", {
    query: { deliverableId: ids.versionId },
  });
  const preview = tree.find((element) =>
    element.type === "NutritionDeliverablePreview",
  );
  assert.equal(preview?.props.focused, true);
  assert.equal(preview?.props.officialVersion, 2);
  assert.equal(
    (preview?.props.initialDraft as { status: string }).status,
    "APPROVED",
  );
});

test("Plano Alimentar finalizado abre a versão congelada sem relatório publicado", async () => {
  const { tree } = await render("global-deliverables", "meal-plan", {
    query: { entryId: ids.entryId, versionId: ids.versionId },
  });
  const preview = tree.find((element) =>
    element.type === "NutritionDeliverablePreview",
  );
  assert.equal(preview?.props.focused, true);
  assert.equal(preview?.props.documentType, "meal-plan");
  assert.equal(preview?.props.sourceEntryId, ids.entryId);
  assert.equal(preview?.props.sourceVersionId, ids.versionId);
  assert.equal(preview?.props.officialVersion, 4);
  assert.ok(!tree.some((element) => element.type === "ClinicalFlowNavigation"));
});

test("Performance aberta pela Central usa a entrada e a versão indicadas", async () => {
  const { tree, identityCalls, selectedCalls } = await render("global-deliverables", "performance");
  assert.ok(tree.some((element) => element.type === "PerformanceDeliverablePreview"));
  assert.ok(tree.some((element) => element.type === "ButtonLink" && element.props.href === "/entregaveis"));
  assert.ok(!tree.some((element) => element.type === "ButtonLink" && String(element.props.href).startsWith("/performance-endurance")));
  assert.deepEqual(identityCalls, ["author-workout"]);
  assert.equal(selectedCalls[0].entryId, ids.entryId);
  assert.equal(selectedCalls[0].versionId, ids.versionId);
});

test("impressão contextual de Performance lê o plano oficial sem salvar ou exigir novo seletor", async () => {
  const { tree, selectedCalls } = await render(undefined, "performance", {
    query: { print: "1" },
  });
  const preview = tree.find((element) =>
    element.type === "PerformanceDeliverablePreview",
  );
  assert.equal(preview?.props.printMode, true);
  assert.ok(tree.some((element) =>
    String(element.props.className).includes("print-document-page"),
  ));
  assert.ok(!tree.some((element) => element.type === "ClinicalFlowNavigation"));
  assert.equal(selectedCalls[0].entryId, undefined);
  assert.equal(selectedCalls[0].versionId, undefined);
});

test("Central rejeita seletor ausente, malformado ou sem documento correspondente", async () => {
  await assert.rejects(render("global-deliverables", "postural", {
    query: { entryId: undefined },
  }), /Unexpected notFound/);
  await assert.rejects(render("global-deliverables", "performance", {
    query: { versionId: "invalid" },
  }), /Unexpected notFound/);
  await assert.rejects(render("global-deliverables", "postural", {
    rejectSelected: true,
  }), /Unexpected notFound/);
  await assert.rejects(render("global-deliverables", "performance", {
    rejectSelected: true,
  }), /Unexpected notFound/);
  await assert.rejects(render(undefined, "postural", {
    query: ids,
  }), /Unexpected notFound/);
});

test("Avaliações e Performance imprimem a página oficial sem janela temporária nem menus", async () => {
  const [actions, css] = await Promise.all([
    readFile(
      new URL("../../../../../components/deliverables/document-print-actions.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../../../globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /window\.print\(\)/);
  assert.match(actions, /Imprimir/);
  assert.match(actions, /Salvar em PDF/);
  assert.doesNotMatch(actions, /window\.open\(|document\.write\(/);
  assert.match(css, /body:has\(#postural-deliverable-report\) aside/);
  assert.match(css, /body:has\(#performance-deliverable-report\) aside/);
  assert.match(css, /#postural-deliverable-report,[\s\S]*#performance-deliverable-report/);
});
